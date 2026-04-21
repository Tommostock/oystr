/**
 * API Route: /api/rail/tracked
 *
 * Fetches live data for a specific tracked rail service — designed to
 * work even AFTER the train has left its origin station (so the user
 * can track a journey they're already on, not just one they're about
 * to board).
 *
 * Why a separate route from /api/rail/departures?
 *   The regular departures board is keyed on the ORIGIN station.
 *   Once a service has actually left its origin, it drops off that
 *   board. For an in-progress journey we instead query the
 *   DESTINATION's arrivals — where the service is still present
 *   (and will be until it arrives). By filtering the arrivals to
 *   those originating from our FROM station, we can pinpoint the
 *   exact service the user is on via its scheduled departure time.
 *
 * Query params:
 *   ?fromCrs=KGX              — REQUIRED: origin CRS code
 *   ?toCrs=LDS                — REQUIRED: destination CRS code
 *   ?scheduledDeparture=08:10 — REQUIRED: HH:mm departure from origin
 *
 * Returns:
 *   200 { departure: RailDeparture, found: true }   — matching service
 *   200 { found: false }                             — no match in the
 *                                                      current arrival window
 *   400 { error }                                    — missing params
 *   503 { error, notConfigured: true }               — RDM_API_KEY missing
 *
 * RailDeparture.callingPoints on the returned service is the full
 * journey from the stop AFTER origin through to (and including) the
 * destination, with `at` populated on stops the train has already
 * called at so the UI can tell where the train is.
 */

import { NextRequest, NextResponse } from "next/server";
import { RDM_API_BASE } from "@/lib/constants";
import type { CallingPoint, RailDeparture } from "@/lib/rail-types";

/* ---- Upstream types — only fields we use. ---- */
interface RdmCallingPoint {
  locationName?: string;
  crs?: string;
  st?: string; /* scheduled */
  et?: string; /* estimated (future) or "On time" / "Cancelled" */
  at?: string; /* actual (already called) */
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
  std?: string;
  etd?: string;
  sta?: string;
  eta?: string;
  destination?: RdmLocation[];
  origin?: RdmLocation[];
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  length?: number;
  previousCallingPoints?: RdmCallingPointGroup[];
  subsequentCallingPoints?: RdmCallingPointGroup[];
}

interface RdmStationBoard {
  trainServices?: RdmService[] | null;
}

function normaliseCallingPoint(cp: RdmCallingPoint): CallingPoint {
  const scheduled = cp.st || "";
  /* Prefer actual time when the train has already been here, otherwise
     the estimated time for future stops. */
  const estimated = cp.at || cp.et || "";
  return {
    crs: (cp.crs || "").toUpperCase(),
    name: cp.locationName || "",
    scheduledTime: scheduled,
    estimatedTime: estimated,
    cancelled: !!cp.isCancelled || estimated === "Cancelled",
  };
}

export async function GET(request: NextRequest) {
  const fromCrs = request.nextUrl.searchParams.get("fromCrs");
  const toCrs = request.nextUrl.searchParams.get("toCrs");
  const scheduledDeparture = request.nextUrl.searchParams.get(
    "scheduledDeparture"
  );

  if (!fromCrs || !toCrs || !scheduledDeparture) {
    return NextResponse.json(
      { error: "fromCrs, toCrs, scheduledDeparture are all required" },
      { status: 400 }
    );
  }

  if (!process.env.RDM_API_KEY) {
    return NextResponse.json(
      { error: "Rail service not configured", notConfigured: true },
      { status: 503 }
    );
  }

  /*
   * Query the DESTINATION's board with a from-filter. This catches both
   * services about to depart their origin AND services already on their
   * way — both still appear as upcoming arrivals at the destination.
   * 150 rows is the RDM hard cap and enough to cover any realistic
   * arrival window at a major UK terminus.
   */
  const params = new URLSearchParams({
    numRows: "150",
    filterCrs: fromCrs.toUpperCase(),
    filterType: "from",
  });
  const url = `${RDM_API_BASE}/GetArrDepBoardWithDetails/${toCrs.toUpperCase()}?${params}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "x-apikey": process.env.RDM_API_KEY,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data: RdmStationBoard = await upstream.json();
    const services = Array.isArray(data.trainServices)
      ? data.trainServices
      : [];

    /*
     * Match by origin CRS + origin scheduled departure time. The origin
     * is the first entry in previousCallingPoints (train started there).
     * Multiple services a day share an origin+dest pair, so the time
     * is what disambiguates.
     */
    const match = services.find((s) => {
      const previous = s.previousCallingPoints?.[0]?.callingPoint || [];
      if (previous.length === 0) return false;
      const first = previous[0];
      return (
        (first.crs || "").toUpperCase() === fromCrs.toUpperCase() &&
        first.st === scheduledDeparture
      );
    });

    if (!match) {
      return NextResponse.json({ found: false });
    }

    /*
     * Build the full calling-points list the user sees: every stop
     * AFTER the origin, up to and including the destination.
     *
     * previousCallingPoints[0] contains origin + intermediate stops
     * already called at. We skip the origin itself (the popup
     * re-prepends it via the ServiceDetailSheet's origin row).
     *
     * subsequentCallingPoints[0] only applies if this is a through
     * service — for a terminating service at our destination, it's
     * empty and the destination row is synthesized from sta/eta.
     */
    const previousRaw = match.previousCallingPoints?.[0]?.callingPoint || [];
    const previousAfterOrigin = previousRaw.slice(1).map(normaliseCallingPoint);

    /*
     * The destination row itself — synthesised from sta/eta since
     * it's never in either callingPoint array. For through services
     * we include subsequent calling points after this too.
     */
    const destinationRow: CallingPoint = {
      crs: toCrs.toUpperCase(),
      name:
        match.destination?.[0]?.locationName ||
        previousAfterOrigin[previousAfterOrigin.length - 1]?.name ||
        "",
      scheduledTime: match.sta || "",
      estimatedTime: match.eta || "",
      cancelled:
        !!match.isCancelled ||
        match.eta === "Cancelled",
    };
    const subsequentRaw = match.subsequentCallingPoints?.[0]?.callingPoint || [];
    const subsequentAfterDest = subsequentRaw.map(normaliseCallingPoint);

    const callingPoints: CallingPoint[] = [
      ...previousAfterOrigin,
      destinationRow,
      ...subsequentAfterDest,
    ];

    /*
     * Derive "departure from origin" fields for RailDeparture. The
     * origin's scheduled departure = scheduledDeparture (from query);
     * the estimated departure we pull from the first previous-calling-
     * point's at/et so the card can say ON TIME / DELAYED correctly.
     */
    const originCp = previousRaw[0];
    const estimatedDeparture = originCp?.at || originCp?.et || "";
    const cancelled = !!match.isCancelled || estimatedDeparture === "Cancelled";
    const delayed =
      !cancelled &&
      estimatedDeparture !== "" &&
      estimatedDeparture !== "On time" &&
      estimatedDeparture !== scheduledDeparture;

    const departure: RailDeparture = {
      serviceId: match.serviceIdGuid || match.serviceID || "",
      operator: match.operator || match.operatorCode || "",
      platform: match.platform ?? null,
      scheduledDeparture,
      estimatedDeparture,
      destination: match.destination?.[0]?.locationName || "",
      origin: match.origin?.[0]?.locationName || "",
      cancelled,
      delayed,
      delayReason: match.delayReason || undefined,
      cancelReason: match.cancelReason || undefined,
      length: match.length,
      callingPoints,
    };

    return NextResponse.json({ departure, found: true });
  } catch (error) {
    console.error("Rail tracked-service error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracked service" },
      { status: 500 }
    );
  }
}
