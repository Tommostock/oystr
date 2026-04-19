/**
 * API Route: /api/rail/departures
 *
 * Proxies live National Rail departure board requests to the Rail Data
 * Marketplace "Live Arrival and Departure Boards" REST API using the
 * GetArrDepBoardWithDetails endpoint.
 *
 * Why WithDetails? It returns every train's full calling-point list
 * inline with the main response. That means the "tap a train to see
 * its route" feature works off this one response — no second API
 * round-trip when the user opens a service. It also means the app
 * only needs ONE RDM subscription instead of two.
 *
 * The upstream API returns arrivals + departures mixed into a single
 * trainServices array. We filter to departures only (entries with a
 * populated std) and normalise the shape for the client.
 *
 * Query params:
 *   ?crs=KGX              — 3-letter CRS code of the origin station (REQUIRED)
 *   ?filterCrs=LDS        — optional: only show trains calling at this destination
 *   ?numRows=10           — optional: number of rows to return (default 10, max 150)
 *
 * Returns:
 *   Array<RailDeparture>, sorted by scheduled departure time ascending.
 *   Each RailDeparture.callingPoints is an ordered list of stops.
 *
 * Errors:
 *   503 { error, notConfigured: true }  — when RDM_API_KEY is not set
 *   400 { error }                       — when CRS is missing
 *   500 { error }                       — upstream fetch failed
 */

import { NextRequest, NextResponse } from "next/server";
import { RDM_API_BASE } from "@/lib/constants";
import type { CallingPoint, RailDeparture } from "@/lib/rail-types";

/* ========================================
 * UPSTREAM RESPONSE SHAPES
 * These mirror what RDM returns so we can parse it safely.
 * Only the fields we use are typed.
 * ======================================== */
interface RdmCallingPoint {
  locationName?: string;
  crs?: string;
  st?: string; /* Scheduled time at this calling point */
  et?: string; /* Estimated time — "On time" or HH:mm or "Cancelled" */
  isCancelled?: boolean;
}

interface RdmCallingPointList {
  callingPoint?: RdmCallingPoint[];
}

interface RdmService {
  serviceID?: string;
  serviceIdGuid?: string;
  operator?: string;
  operatorCode?: string;
  platform?: string | null;
  std?: string; /* Scheduled time of departure — present for departures */
  etd?: string; /* Estimated time of departure */
  sta?: string; /* Scheduled time of arrival — present for arrivals */
  destination?: { location?: Array<{ locationName?: string }> };
  origin?: { location?: Array<{ locationName?: string }> };
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  length?: number;
  /* Subsequent calling points — stops AFTER the current station */
  subsequentCallingPoints?: {
    callingPointList?: RdmCallingPointList[];
  };
}

interface RdmStationBoard {
  trainServices?: { service?: RdmService[] } | null;
  busServices?: { service?: RdmService[] } | null;
}

/* ========================================
 * NORMALISATION HELPERS
 * ======================================== */

function readLocationName(
  field?: { location?: Array<{ locationName?: string }> }
): string {
  return field?.location?.[0]?.locationName || "";
}

function normaliseCallingPoint(cp: RdmCallingPoint): CallingPoint {
  const scheduled = cp.st || "";
  const estimated = cp.et || "";
  return {
    crs: (cp.crs || "").toUpperCase(),
    name: cp.locationName || "",
    scheduledTime: scheduled,
    estimatedTime: estimated,
    cancelled: !!cp.isCancelled || estimated === "Cancelled",
  };
}

/**
 * Flatten the nested calling-point structure into a simple ordered array.
 * Services that split/join in route have multiple callingPointList entries
 * — we use the first (primary) one which is the typical case.
 */
function extractCallingPoints(service: RdmService): CallingPoint[] {
  const raw =
    service.subsequentCallingPoints?.callingPointList?.[0]?.callingPoint || [];
  return raw.map(normaliseCallingPoint);
}

/**
 * Normalise a single RDM service to our flat RailDeparture shape.
 */
function normaliseService(service: RdmService): RailDeparture {
  const scheduled = service.std || "";
  const estimated = service.etd || "";
  const cancelled = !!service.isCancelled || estimated === "Cancelled";
  const delayed =
    !cancelled &&
    estimated !== "" &&
    estimated !== "On time" &&
    estimated !== scheduled;

  return {
    serviceId: service.serviceIdGuid || service.serviceID || "",
    operator: service.operatorCode || service.operator || "",
    platform: service.platform ?? null,
    scheduledDeparture: scheduled,
    estimatedDeparture: estimated,
    destination: readLocationName(service.destination),
    origin: readLocationName(service.origin),
    cancelled,
    delayed,
    delayReason: service.delayReason || undefined,
    cancelReason: service.cancelReason || undefined,
    length: service.length,
    callingPoints: extractCallingPoints(service),
  };
}

/* ========================================
 * ROUTE HANDLER
 * ======================================== */
export async function GET(request: NextRequest) {
  const crs = request.nextUrl.searchParams.get("crs");
  const filterCrs = request.nextUrl.searchParams.get("filterCrs");
  const numRowsRaw = request.nextUrl.searchParams.get("numRows");

  if (!crs) {
    return NextResponse.json(
      { error: "crs query parameter is required" },
      { status: 400 }
    );
  }

  /* Graceful degradation: API key missing in env — return 503 with a flag
     so the UI can show a friendly "unavailable" message rather than crash. */
  if (!process.env.RDM_API_KEY) {
    return NextResponse.json(
      {
        error: "Rail service not configured",
        notConfigured: true,
      },
      { status: 503 }
    );
  }

  /* Clamp numRows to RDM's valid range (1-150), default 10 */
  let numRows = 10;
  if (numRowsRaw) {
    const parsed = parseInt(numRowsRaw, 10);
    if (!isNaN(parsed)) {
      numRows = Math.max(1, Math.min(150, parsed));
    }
  }

  /* Build upstream URL with optional destination filter */
  const params = new URLSearchParams({ numRows: String(numRows) });
  if (filterCrs) {
    params.set("filterCrs", filterCrs.toUpperCase());
    /* "to" = only show trains calling AT the destination after this station */
    params.set("filterType", "to");
  }

  /*
   * GetArrDepBoardWithDetails returns arrivals + departures + full
   * calling-point lists for every service in one response. One call,
   * all the data we need.
   */
  const url = `${RDM_API_BASE}/GetArrDepBoardWithDetails/${crs.toUpperCase()}?${params}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "x-apikey": process.env.RDM_API_KEY,
        Accept: "application/json",
      },
      /* Live data — no cache */
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data: RdmStationBoard = await upstream.json();
    const services = data.trainServices?.service || [];

    /*
     * Filter to departures only — services with a scheduled departure
     * time (std). Pure arrivals (sta but no std) are excluded from our
     * departure board view.
     */
    const departures = services.filter((s) => !!s.std);

    /* Normalise + sort by scheduled time (HH:mm strings sort lexically) */
    const normalised: RailDeparture[] = departures
      .map(normaliseService)
      .sort((a, b) =>
        a.scheduledDeparture.localeCompare(b.scheduledDeparture)
      );

    return NextResponse.json(normalised);
  } catch (error) {
    console.error("Rail departures error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rail departures" },
      { status: 500 }
    );
  }
}
