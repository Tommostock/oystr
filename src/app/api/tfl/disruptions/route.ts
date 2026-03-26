/**
 * API Route: /api/tfl/disruptions
 *
 * Returns disruptions and accessibility info for a station.
 * Combines data from TfL's Disruption endpoint and StopPoint
 * facility data (lifts, escalators, step-free access).
 *
 * Query params:
 *   ?stopId=940GZZLUKSX   — the station's Naptan ID
 *
 * Returns:
 *   { disruptions: [...], facilities: { lifts, escalators, stepFree } }
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

function buildParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }
  return params;
}

export async function GET(request: NextRequest) {
  const stopId = request.nextUrl.searchParams.get("stopId");

  if (!stopId) {
    return NextResponse.json(
      { error: "stopId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const params = buildParams();

    /* Fetch disruptions and station details in parallel */
    const [disruptionResp, stationResp] = await Promise.all([
      fetch(`${TFL_API_BASE}/StopPoint/${stopId}/Disruption?${params}`, {
        next: { revalidate: 300 }, /* Cache for 5 minutes */
      }),
      fetch(`${TFL_API_BASE}/StopPoint/${stopId}?${params}`, {
        next: { revalidate: 3600 }, /* Cache for 1 hour — facilities rarely change */
      }),
    ]);

    /* Parse disruptions */
    let disruptions: {
      description: string;
      type: string;
      appearance: string;
      mode: string;
    }[] = [];

    if (disruptionResp.ok) {
      const disruptionData = await disruptionResp.json();
      disruptions = (Array.isArray(disruptionData) ? disruptionData : []).map(
        (d: {
          description: string;
          type: string;
          appearance: string;
          mode: string;
        }) => ({
          description: d.description,
          type: d.type || "Information",
          appearance: d.appearance || "Information",
          mode: d.mode || "",
        })
      );
    }

    /* Parse facilities (lifts, escalators, step-free) */
    let facilities = {
      lifts: 0,
      escalators: 0,
      stepFree: false,
    };

    if (stationResp.ok) {
      const stationData = await stationResp.json();
      const props: { key: string; value: string }[] =
        stationData.additionalProperties || [];

      const liftProp = props.find(
        (p) => p.key.toLowerCase() === "lifts"
      );
      const escalatorProp = props.find(
        (p) => p.key.toLowerCase() === "escalators"
      );

      facilities.lifts = liftProp ? parseInt(liftProp.value) || 0 : 0;
      facilities.escalators = escalatorProp
        ? parseInt(escalatorProp.value) || 0
        : 0;
      /* A station is considered step-free if it has lifts */
      facilities.stepFree = facilities.lifts > 0;
    }

    return NextResponse.json({ disruptions, facilities });
  } catch (error) {
    console.error("TfL disruptions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch disruptions" },
      { status: 500 }
    );
  }
}
