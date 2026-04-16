/**
 * API Route: /api/tfl/strikes
 *
 * Fetches disruption data from TfL and filters for strike /
 * industrial action related disruptions.
 *
 * Uses three data sources:
 *   1. /Line/Mode/{modes}/Disruption — planned and real-time disruptions
 *   2. /Line/Mode/{modes}/Status — current line statuses
 *   3. /Line/Mode/{modes}/Status/{from}/to/{to} — status for next 7 days
 *
 * The TfL API stores strike data in multiple places:
 *   - Line.disruptions[] — top-level disruptions on the Line object
 *   - LineStatus.disruption — nested inside each status entry
 *   - LineStatus.reason — free-text reason field
 *   - LineStatus.validityPeriods — date ranges for planned disruptions
 *
 * Strike-related disruptions are identified by keywords like
 * "strike", "industrial action", "walk out" etc.
 *
 * Returns:
 *   Array of StrikeInfo objects with description, affected lines,
 *   and from/to dates.
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

/**
 * Format a date as YYYY-MM-DD for the TfL API date range endpoint.
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Try to add a strike entry, deduplicating by description.
 * If the description already exists, merge the affected lines.
 * Returns true if a new entry was added.
 */
function addStrike(
  strikes: StrikeInfo[],
  seenDescriptions: Set<string>,
  entry: {
    description: string;
    affectedLines: string[];
    lastUpdated: string;
    category: string;
    fromDate: string;
    toDate: string;
  }
): boolean {
  const descKey = entry.description.trim().toLowerCase();

  if (seenDescriptions.has(descKey)) {
    /* Already seen — merge affected lines into the existing entry */
    const existing = strikes.find(
      (s) => s.description.trim().toLowerCase() === descKey
    );
    if (existing) {
      for (const line of entry.affectedLines) {
        if (!existing.affectedLines.includes(line)) {
          existing.affectedLines.push(line);
        }
      }
      /* Update dates if the existing entry has none */
      if (!existing.fromDate && entry.fromDate) existing.fromDate = entry.fromDate;
      if (!existing.toDate && entry.toDate) existing.toDate = entry.toDate;
    }
    return false;
  }

  seenDescriptions.add(descKey);
  strikes.push({
    id: `strike-${strikes.length}`,
    description: entry.description.trim(),
    affectedLines: [...entry.affectedLines],
    lastUpdated: entry.lastUpdated,
    category: entry.category,
    fromDate: entry.fromDate,
    toDate: entry.toDate,
  });
  return true;
}

/**
 * Extract the earliest fromDate and latest toDate from an array
 * of validity periods.
 */
function extractDateRange(
  periods: Array<{ fromDate?: string; toDate?: string }> | undefined
): { fromDate: string; toDate: string } {
  if (!periods || periods.length === 0) return { fromDate: "", toDate: "" };

  const fromDates = periods
    .map((v) => v.fromDate)
    .filter(Boolean)
    .sort() as string[];
  const toDates = periods
    .map((v) => v.toDate)
    .filter(Boolean)
    .sort() as string[];

  return {
    fromDate: fromDates.length > 0 ? fromDates[0] : "",
    toDate: toDates.length > 0 ? toDates[toDates.length - 1] : "",
  };
}

/**
 * Check if a strike falls within our display window.
 * Show strikes that haven't ended yet and start within 7 days.
 */
function isWithinWindow(
  fromDate: string,
  toDate: string,
  today: Date,
  windowEnd: Date
): boolean {
  /* If no dates at all, include it (better to show than hide) */
  if (!fromDate && !toDate) return true;

  if (toDate) {
    const strikeEnd = new Date(toDate);
    if (strikeEnd < today) return false; // Already passed
  }
  if (fromDate) {
    const strikeStart = new Date(fromDate);
    if (strikeStart > windowEnd) return false; // Too far out
  }
  return true;
}

export async function GET() {
  try {
    const params = new URLSearchParams();

    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const modes = "tube,overground,dlr,elizabeth-line,tram";

    /* Build the date range: today to 7 days from now */
    const today = new Date();
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(today.getDate() + 7);

    const fromDateStr = formatDate(today);
    const toDateStr = formatDate(sevenDaysOut);

    /*
     * Fetch all three data sources in parallel:
     *
     * 1. Disruptions — planned and real-time (top-level disruption objects)
     * 2. Current status — live line statuses
     * 3. Future status (7-day range) — includes planned closures/strikes
     *    with validity periods and nested disruption objects
     */
    const [disruptionsRes, statusRes, futureStatusRes] = await Promise.all([
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Disruption?${params}`, {
        next: { revalidate: 300 },
      }),
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Status?${params}`, {
        next: { revalidate: 60 },
      }),
      fetch(
        `${TFL_API_BASE}/Line/Mode/${modes}/Status/${fromDateStr}/to/${toDateStr}?detail=true&${params}`,
        { next: { revalidate: 300 } }
      ),
    ]);

    const strikes: StrikeInfo[] = [];
    const seenDescriptions = new Set<string>();

    /* ---- 1. Process /Disruption endpoint ---- */
    if (disruptionsRes.ok) {
      const disruptions = await disruptionsRes.json();

      for (const disruption of disruptions) {
        const description = disruption.description || "";
        const closureText = disruption.closureText || "";
        const additionalInfo = disruption.additionalInfo || "";
        const combined = `${description} ${closureText} ${additionalInfo}`;

        if (!isStrikeRelated(combined)) continue;

        const affectedLines: string[] = [];
        if (disruption.affectedRoutes) {
          for (const route of disruption.affectedRoutes) {
            if (route.name && !affectedLines.includes(route.name)) {
              affectedLines.push(route.name);
            }
          }
        }

        /* Extract validity dates */
        const { fromDate, toDate } = extractDateRange(disruption.validity);

        if (!isWithinWindow(fromDate, toDate, today, sevenDaysOut)) continue;

        addStrike(strikes, seenDescriptions, {
          description,
          affectedLines,
          lastUpdated: disruption.lastUpdate || disruption.created || "",
          category: disruption.category || "Unknown",
          fromDate,
          toDate,
        });
      }
    }

    /* ---- 2. Process current /Status endpoint ---- */
    if (statusRes.ok) {
      const lines = await statusRes.json();
      processLines(lines, strikes, seenDescriptions, today, sevenDaysOut);
    }

    /* ---- 3. Process future date-range /Status endpoint ---- */
    if (futureStatusRes.ok) {
      const lines = await futureStatusRes.json();
      processLines(lines, strikes, seenDescriptions, today, sevenDaysOut);
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

/**
 * Process Line objects from the TfL /Status endpoints.
 *
 * Checks three places for strike info on each line:
 *   1. line.disruptions[] — top-level disruptions array
 *   2. lineStatuses[].disruption — nested disruption object
 *   3. lineStatuses[].reason — free-text reason field
 *
 * Also extracts validity periods for date display.
 */
function processLines(
  lines: Array<{
    id: string;
    name: string;
    disruptions?: Array<{
      category?: string;
      description?: string;
      closureText?: string;
      additionalInfo?: string;
      affectedRoutes?: Array<{ name?: string }>;
      created?: string;
      lastUpdate?: string;
    }>;
    lineStatuses?: Array<{
      reason?: string;
      statusSeverityDescription?: string;
      disruption?: {
        category?: string;
        description?: string;
        closureText?: string;
        additionalInfo?: string;
        affectedRoutes?: Array<{ name?: string }>;
        created?: string;
        lastUpdate?: string;
      };
      validityPeriods?: Array<{
        fromDate?: string;
        toDate?: string;
        isNow?: boolean;
      }>;
    }>;
  }>,
  strikes: StrikeInfo[],
  seenDescriptions: Set<string>,
  today: Date,
  windowEnd: Date
) {
  for (const line of lines) {
    /* --- Check top-level line.disruptions[] --- */
    if (line.disruptions) {
      for (const disruption of line.disruptions) {
        const desc = disruption.description || "";
        const closure = disruption.closureText || "";
        const additional = disruption.additionalInfo || "";
        const combined = `${desc} ${closure} ${additional}`;

        if (!isStrikeRelated(combined)) continue;

        const affectedLines: string[] = [line.name];
        if (disruption.affectedRoutes) {
          for (const route of disruption.affectedRoutes) {
            if (route.name && !affectedLines.includes(route.name)) {
              affectedLines.push(route.name);
            }
          }
        }

        addStrike(strikes, seenDescriptions, {
          description: desc || closure,
          affectedLines,
          lastUpdated: disruption.lastUpdate || disruption.created || "",
          category: disruption.category || "PlannedWork",
          fromDate: "",
          toDate: "",
        });
      }
    }

    /* --- Check each lineStatus entry --- */
    if (!line.lineStatuses) continue;

    for (const status of line.lineStatuses) {
      /* Extract validity dates for this status entry */
      const { fromDate, toDate } = extractDateRange(status.validityPeriods);

      /* Check the nested disruption object */
      if (status.disruption) {
        const d = status.disruption;
        const desc = d.description || "";
        const closure = d.closureText || "";
        const additional = d.additionalInfo || "";
        const combined = `${desc} ${closure} ${additional}`;

        if (isStrikeRelated(combined)) {
          if (!isWithinWindow(fromDate, toDate, today, windowEnd)) continue;

          const affectedLines: string[] = [line.name];
          if (d.affectedRoutes) {
            for (const route of d.affectedRoutes) {
              if (route.name && !affectedLines.includes(route.name)) {
                affectedLines.push(route.name);
              }
            }
          }

          addStrike(strikes, seenDescriptions, {
            description: desc || closure,
            affectedLines,
            lastUpdated: d.lastUpdate || d.created || "",
            category: d.category || "PlannedWork",
            fromDate,
            toDate,
          });

          /* Already found a strike in this status — don't double-count reason */
          continue;
        }
      }

      /* Check the reason text as fallback */
      const reason = status.reason || "";
      if (reason && isStrikeRelated(reason)) {
        if (!isWithinWindow(fromDate, toDate, today, windowEnd)) continue;

        addStrike(strikes, seenDescriptions, {
          description: reason,
          affectedLines: [line.name],
          lastUpdated: new Date().toISOString(),
          category: "RealTime",
          fromDate,
          toDate,
        });
      }
    }
  }
}
