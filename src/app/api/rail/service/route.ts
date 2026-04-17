/**
 * API Route: /api/rail/service
 *
 * Proxies a "Get Service Details" request to the Rail Data Marketplace
 * LDBWS REST API. Returns the full calling points (list of stops) for
 * a specific train service — used by the ServiceDetailSheet when a user
 * taps a row on the departure board.
 *
 * Query params:
 *   ?serviceId=xxx   — unique service ID from a RailDeparture (REQUIRED)
 *
 * Returns:
 *   RailServiceDetails — scheduled info + ordered calling points.
 *
 * Errors:
 *   503 { error, notConfigured: true }  — when RDM_API_KEY is not set
 *   400 { error }                       — when serviceId is missing
 *   500 { error }                       — upstream fetch failed
 */

import { NextRequest, NextResponse } from "next/server";
import { RDM_API_BASE } from "@/lib/constants";
import type { CallingPoint, RailServiceDetails } from "@/lib/rail-types";

/* ========================================
 * UPSTREAM RESPONSE SHAPES
 * ======================================== */
interface RdmCallingPoint {
  locationName?: string;
  crs?: string;
  st?: string; /* Scheduled time */
  et?: string; /* Estimated time — "On time" or HH:mm or "Cancelled" */
  isCancelled?: boolean;
}

interface RdmCallingPointList {
  callingPoint?: RdmCallingPoint[];
}

interface RdmServiceDetails {
  serviceID?: string;
  serviceIdGuid?: string;
  operator?: string;
  operatorCode?: string;
  platform?: string | null;
  std?: string;
  etd?: string;
  destination?: { location?: Array<{ locationName?: string }> };
  length?: number;
  /*
   * Calling points are grouped by list — most services have exactly one
   * subsequentCallingPoints[0] which contains the stops after this station.
   */
  subsequentCallingPoints?: {
    callingPointList?: RdmCallingPointList[];
  };
}

/* ========================================
 * NORMALISATION
 * ======================================== */
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

/* ========================================
 * ROUTE HANDLER
 * ======================================== */
export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId");

  if (!serviceId) {
    return NextResponse.json(
      { error: "serviceId query parameter is required" },
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
   * RDM expects the serviceId URL-encoded (it often contains "=" padding).
   * Using encodeURIComponent keeps "+" and "/" safe in the URL path.
   */
  const url = `${RDM_API_BASE}/GetServiceDetails/${encodeURIComponent(serviceId)}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "x-apikey": process.env.RDM_API_KEY,
        Accept: "application/json",
      },
      /*
       * Calling points don't change often within a minute or two —
       * a short cache reduces upstream load and keeps the sheet snappy
       * if the user opens/closes it quickly.
       */
      next: { revalidate: 60 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data: RdmServiceDetails = await upstream.json();

    /*
     * Flatten all calling-point lists into a single ordered array.
     * Most direct services only have one list; splits/joins have multiple.
     * For our UI (showing the user's journey), the first list is what they care about.
     */
    const rawCallingPoints: RdmCallingPoint[] =
      data.subsequentCallingPoints?.callingPointList?.[0]?.callingPoint || [];

    const callingPoints: CallingPoint[] = rawCallingPoints.map(
      normaliseCallingPoint
    );

    const result: RailServiceDetails = {
      serviceId: data.serviceIdGuid || data.serviceID || serviceId,
      operator: data.operatorCode || data.operator || "",
      scheduledDeparture: data.std || "",
      estimatedDeparture: data.etd || "",
      platform: data.platform ?? null,
      destination:
        data.destination?.location?.[0]?.locationName || "",
      length: data.length,
      callingPoints,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Rail service details error:", error);
    return NextResponse.json(
      { error: "Failed to fetch service details" },
      { status: 500 }
    );
  }
}
