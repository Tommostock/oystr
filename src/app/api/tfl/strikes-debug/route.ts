/**
 * Debug endpoint: /api/tfl/strikes-debug
 *
 * Returns raw TfL API responses so we can see exactly what text
 * TfL uses to describe strikes. Temporary — remove after debugging.
 */

import { NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET() {
  try {
    const params = new URLSearchParams();
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const modes = "tube,overground,dlr,elizabeth-line,tram";
    const today = new Date();
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(today.getDate() + 7);

    const fromDate = formatDate(today);
    const toDate = formatDate(sevenDaysOut);

    /* Fetch all three sources */
    const [disruptionsRes, statusRes, futureStatusRes] = await Promise.all([
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Disruption?${params}`, {
        cache: "no-store",
      }),
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Status?${params}`, {
        cache: "no-store",
      }),
      fetch(
        `${TFL_API_BASE}/Line/Mode/${modes}/Status/${fromDate}/to/${toDate}?detail=true&${params}`,
        { cache: "no-store" }
      ),
    ]);

    /* Parse all responses */
    const disruptions = disruptionsRes.ok
      ? await disruptionsRes.json()
      : { error: disruptionsRes.status };

    const status = statusRes.ok
      ? await statusRes.json()
      : { error: statusRes.status };

    const futureStatus = futureStatusRes.ok
      ? await futureStatusRes.json()
      : { error: futureStatusRes.status };

    /*
     * For the future status, extract just the interesting bits:
     * lines that have non-"Good Service" statuses, plus any
     * disruption objects and reason text.
     */
    let futureStatusSummary: Record<string, unknown>[] = [];
    if (Array.isArray(futureStatus)) {
      futureStatusSummary = futureStatus.map((line: Record<string, unknown>) => ({
        id: line.id,
        name: line.name,
        disruptions: line.disruptions,
        lineStatuses: (line.lineStatuses as Array<Record<string, unknown>> || []).map(
          (ls: Record<string, unknown>) => ({
            statusSeverity: ls.statusSeverity,
            statusSeverityDescription: ls.statusSeverityDescription,
            reason: ls.reason,
            disruption: ls.disruption,
            validityPeriods: ls.validityPeriods,
          })
        ),
      }));
    }

    return NextResponse.json({
      dateRange: { from: fromDate, to: toDate },
      disruptionCount: Array.isArray(disruptions) ? disruptions.length : 0,
      disruptions: Array.isArray(disruptions) ? disruptions : disruptions,
      futureStatusLineCount: futureStatusSummary.length,
      futureStatus: futureStatusSummary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
