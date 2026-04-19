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
 * These mirror what the RDM REST API returns so we can parse it safely.
 * Only the fields we use are typed.
 *
 * The REST API has a flatter structure than the original SOAP Darwin API:
 *   - trainServices is a direct array (not nested under .service)
 *   - origin/destination are direct arrays (not nested under .location)
 *   - subsequentCallingPoints is a direct array (not nested under .callingPointList)
 * ======================================== */
interface RdmCallingPoint {
  locationName?: string;
  crs?: string;
  st?: string; /* Scheduled time at this calling point */
  et?: string; /* Estimated time — "On time" or HH:mm or "Cancelled" */
  at?: string; /* Actual time (for already-called points) */
  isCancelled?: boolean;
}

interface RdmCallingPointGroup {
  callingPoint?: RdmCallingPoint[];
}

interface RdmLocation {
  locationName?: string;
  crs?: string;
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
  destination?: RdmLocation[];
  origin?: RdmLocation[];
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  length?: number;
  /* Subsequent calling points — stops AFTER the current station.
     Multiple groups only appear for services that split en route. */
  subsequentCallingPoints?: RdmCallingPointGroup[];
}

interface RdmStationBoard {
  trainServices?: RdmService[] | null;
  busServices?: RdmService[] | null;
}

/* ========================================
 * NORMALISATION HELPERS
 * ======================================== */

/**
 * Read the first location's name from an origin/destination array.
 * Most services have exactly one entry. Multi-entry lists only appear
 * for through services that split en route.
 */
function readLocationName(locations?: RdmLocation[]): string {
  return locations?.[0]?.locationName || "";
}

function normaliseCallingPoint(cp: RdmCallingPoint): CallingPoint {
  const scheduled = cp.st || "";
  /* Prefer "et" (estimated, for future stops); fall back to "at"
     (actual time, for stops already called at) — useful on arrivals */
  const estimated = cp.et || cp.at || "";
  return {
    crs: (cp.crs || "").toUpperCase(),
    name: cp.locationName || "",
    scheduledTime: scheduled,
    estimatedTime: estimated,
    cancelled: !!cp.isCancelled || estimated === "Cancelled",
  };
}

/**
 * Flatten the nested calling-point groups into a simple ordered array.
 * Services that split/join mid-route have multiple groups — we use
 * the first (primary) one which is the typical case.
 */
function extractCallingPoints(service: RdmService): CallingPoint[] {
  const raw = service.subsequentCallingPoints?.[0]?.callingPoint || [];
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
    /* Prefer the full operator name (e.g. "London North Eastern Railway")
       over the short code (e.g. "GR") — friendlier on the board display. */
    operator: service.operator || service.operatorCode || "",
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
    /* trainServices is a flat array in the REST API response */
    const services = Array.isArray(data.trainServices)
      ? data.trainServices
      : [];

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
