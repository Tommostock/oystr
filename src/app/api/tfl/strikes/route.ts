/**
 * API Route: /api/tfl/strikes
 *
 * Fetches disruption data from TfL and filters for strike /
 * industrial action related disruptions.
 *
 * Uses two data sources:
 *   1. /Line/Mode/{modes}/Disruption — planned and real-time disruptions
 *   2. /Line/Mode/{modes}/Status — current line statuses (reasons may mention strikes)
 *
 * Strike-related disruptions are identified by keywords like
 * "strike", "industrial action", "walk out", "walkout" in the
 * description or reason text.
 *
 * Returns:
 *   Array of StrikeInfo objects with description, affected lines, etc.
 */

import { NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";
import type { StrikeInfo } from "@/lib/tfl-types";

/** Keywords that indicate a strike or industrial action */
const STRIKE_KEYWORDS = [
  "strike",
  "industrial action",
  "walk out",
  "walkout",
  "walk-out",
  "union",
  "rmt",
  "aslef",
  "tssa",
  "unite",
];

/**
 * Check if a text string contains any strike-related keywords.
 * Case-insensitive matching.
 */
function isStrikeRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return STRIKE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export async function GET() {
  try {
    const params = new URLSearchParams();

    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const modes = "tube,overground,dlr,elizabeth-line,tram";

    /*
     * Fetch both disruptions and line status in parallel.
     * Disruptions include planned works (which cover upcoming strikes).
     * Line status reasons may also mention ongoing strike action.
     */
    const [disruptionsRes, statusRes] = await Promise.all([
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Disruption?${params}`, {
        next: { revalidate: 300 }, // Cache for 5 minutes
      }),
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Status?${params}`, {
        next: { revalidate: 60 },
      }),
    ]);

    const strikes: StrikeInfo[] = [];
    const seenDescriptions = new Set<string>();

    /* ---- Process disruptions ---- */
    if (disruptionsRes.ok) {
      const disruptions = await disruptionsRes.json();

      for (const disruption of disruptions) {
        const description = disruption.description || "";
        const closureText = disruption.closureText || "";
        const combined = `${description} ${closureText}`;

        if (isStrikeRelated(combined)) {
          /* Deduplicate by description text */
          const descKey = description.trim().toLowerCase();
          if (seenDescriptions.has(descKey)) continue;
          seenDescriptions.add(descKey);

          /* Extract affected line names */
          const affectedLines: string[] = [];
          if (disruption.affectedRoutes) {
            for (const route of disruption.affectedRoutes) {
              if (route.name && !affectedLines.includes(route.name)) {
                affectedLines.push(route.name);
              }
            }
          }

          strikes.push({
            id: `disruption-${strikes.length}`,
            description: description.trim(),
            affectedLines,
            lastUpdated: disruption.lastUpdate || disruption.created || "",
            category: disruption.category || "Unknown",
          });
        }
      }
    }

    /* ---- Process line status reasons ---- */
    if (statusRes.ok) {
      const lines = await statusRes.json();

      for (const line of lines) {
        if (!line.lineStatuses) continue;

        for (const status of line.lineStatuses) {
          const reason = status.reason || "";
          if (!reason || !isStrikeRelated(reason)) continue;

          /* Deduplicate — the same reason text often appears on multiple lines */
          const descKey = reason.trim().toLowerCase();
          if (seenDescriptions.has(descKey)) {
            /* Already have this strike, but add this line to its affected list */
            const existing = strikes.find(
              (s) => s.description.trim().toLowerCase() === descKey
            );
            if (existing && !existing.affectedLines.includes(line.name)) {
              existing.affectedLines.push(line.name);
            }
            continue;
          }
          seenDescriptions.add(descKey);

          strikes.push({
            id: `status-${line.id}-${strikes.length}`,
            description: reason.trim(),
            affectedLines: [line.name],
            lastUpdated: new Date().toISOString(),
            category: "RealTime",
          });
        }
      }
    }

    return NextResponse.json(strikes);
  } catch (error) {
    console.error("TfL strikes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strike information" },
      { status: 500 }
    );
  }
}
