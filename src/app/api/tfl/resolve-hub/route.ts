/**
 * API Route: /api/tfl/resolve-hub
 *
 * Resolves a TfL hub ID (e.g. HUBLST, HUBBAN) to the actual
 * tube/rail station naptan ID (e.g. 940GZZLULVT).
 *
 * Hub IDs cause the Journey API to return disambiguation errors
 * or route to street locations. The resolved naptan ID routes
 * station-to-station correctly.
 *
 * Query params:
 *   ?hubId=HUBLST
 *
 * Returns:
 *   { naptanId: "940GZZLULVT", name: "Liverpool Street Underground Station" }
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const hubId = request.nextUrl.searchParams.get("hubId");

  if (!hubId) {
    return NextResponse.json(
      { error: "hubId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams();
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(
      `${TFL_API_BASE}/StopPoint/${hubId}?${params}`,
      { next: { revalidate: 86400 } } /* Cache 24 hours — hub children never change */
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not resolve hub", naptanId: hubId },
        { status: 502 }
      );
    }

    const data = await response.json();
    const children = data.children || [];

    /*
     * Priority order for resolving:
     * 1. Tube station (940GZZLU...) — NaptanMetroStation
     * 2. Rail station (910G...) — NaptanRailStation
     * 3. Any child with a naptan ID
     * 4. Fall back to the hub's own icsCode
     */
    const tubeChild = children.find(
      (c: { naptanId: string; stopType: string }) =>
        c.stopType === "NaptanMetroStation" ||
        c.naptanId?.startsWith("940GZZLU")
    );

    if (tubeChild) {
      return NextResponse.json({
        naptanId: tubeChild.naptanId,
        name: tubeChild.commonName || data.commonName,
      });
    }

    const railChild = children.find(
      (c: { naptanId: string; stopType: string }) =>
        c.stopType === "NaptanRailStation" ||
        c.naptanId?.startsWith("910G")
    );

    if (railChild) {
      return NextResponse.json({
        naptanId: railChild.naptanId,
        name: railChild.commonName || data.commonName,
      });
    }

    /* Any child */
    if (children.length > 0 && children[0].naptanId) {
      return NextResponse.json({
        naptanId: children[0].naptanId,
        name: children[0].commonName || data.commonName,
      });
    }

    /* Last resort: return the hub's icsCode which Journey API also accepts */
    if (data.icsCode) {
      return NextResponse.json({
        naptanId: data.icsCode,
        name: data.commonName,
      });
    }

    /* Nothing found — return the original hub ID */
    return NextResponse.json({ naptanId: hubId, name: data.commonName });
  } catch (error) {
    console.error("Hub resolution error:", error);
    return NextResponse.json({ naptanId: hubId });
  }
}
