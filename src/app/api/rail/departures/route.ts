/**
 * API Route: /api/rail/departures
 *
 * Proxies live National Rail departure board requests to the Rail Data
 * Marketplace LDBWS (Live Departure Board Service) REST API.
 *
 * The upstream API returns deeply-nested JSON with XML-ish field names.
 * This route normalises the shape to the flat `RailDeparture[]` format
 * used by the client (see src/lib/rail-types.ts).
 *
 * Query params:
 *   ?crs=KGX              — 3-letter CRS code of the origin station (REQUIRED)
 *   ?filterCrs=LDS        — optional: only show trains calling at this destination
 *   ?numRows=10           — optional: number of rows to return (default 10, max 150)
 *
 * Returns:
 *   Array<RailDeparture>, sorted by scheduled departure time ascending.
 *
 * Errors:
 *   503 { error, notConfigured: true }  — when RDM_API_KEY is not set
 *   400 { error }                       — when CRS is missing
 *   500 { error }                       — upstream fetch failed
 */

import { NextRequest, NextResponse } from "next/server";
import { RDM_API_BASE } from "@/lib/constants";
import type { RailDeparture } from "@/lib/rail-types";

/* ========================================
 * UPSTREAM RESPONSE SHAPES
 * These mirror what RDM returns so we can parse it safely.
 * Only the fields we use are typed — everything else is ignored.
 * ======================================== */
interface RdmService {
  serviceID?: string;
  serviceIdGuid?: string;
  operator?: string;
  operatorCode?: string;
  platform?: string | null;
  std?: string; /* Scheduled time of departure */
  etd?: string; /* Estimated time of departure — "On time", HH:mm, or "Cancelled" */
  destination?: { location?: Array<{ locationName?: string }> };
  origin?: { location?: Array<{ locationName?: string }> };
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  length?: number;
}

interface RdmStationBoard {
  trainServices?: { service?: RdmService[] } | null;
  busServices?: { service?: RdmService[] } | null;
}

/* ========================================
 * NORMALISATION HELPERS
 * ======================================== */

/**
 * Flatten RDM's `destination.location[0].locationName` to a simple string.
 */
function readLocationName(
  field?: { location?: Array<{ locationName?: string }> }
): string {
  return field?.location?.[0]?.locationName || "";
}

/**
 * Normalise a single RDM service to our flat shape.
 */
function normaliseService(service: RdmService): RailDeparture {
  const scheduled = service.std || "";
  const estimated = service.etd || "";
  const cancelled = !!service.isCancelled || estimated === "Cancelled";
  /*
   * "Delayed" in RDM means either:
   *   - etd is a specific HH:mm different from std (e.g. std="13:30", etd="13:35")
   *   - etd is the literal string "Delayed"
   * "On time" etd means no delay.
   */
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

  const url = `${RDM_API_BASE}/GetDepartureBoard/${crs.toUpperCase()}?${params}`;

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

    /* Normalise and sort by scheduled time (HH:mm strings sort lexically) */
    const normalised: RailDeparture[] = services
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
