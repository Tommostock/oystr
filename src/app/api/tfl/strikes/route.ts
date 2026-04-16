/**
 * API Route: /api/tfl/strikes
 *
 * Fetches disruption data from TfL and filters for strike /
 * industrial action related disruptions.
 *
 * Uses three data sources:
 *   1. /Line/Mode/{modes}/Disruption — planned and real-time disruptions
 *   2. /Line/Mode/{modes}/Status — current line statuses (reasons may mention strikes)
 *   3. /Line/Mode/{modes}/Status/{from}/to/{to} — status for the next 7 days
 *      to catch planned strikes that haven't started yet
 *
 * Strike-related disruptions are identified by keywords like
 * "strike", "industrial action", "walk out", "walkout" in the
 * description or reason text.
 *
 * Strikes are shown from 7 days before through to the strike date.
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

    const fromDate = formatDate(today);
    const toDate = formatDate(sevenDaysOut);

    /*
     * Fetch disruptions, current status, and future status in parallel.
     *
     * - Disruptions include planned works with validity date ranges
     * - Current status catches any active strikes right now
     * - Future status (7-day range) catches planned closures due to strikes
     */
    const [disruptionsRes, statusRes, futureStatusRes] = await Promise.all([
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Disruption?${params}`, {
        next: { revalidate: 300 }, // Cache for 5 minutes
      }),
      fetch(`${TFL_API_BASE}/Line/Mode/${modes}/Status?${params}`, {
        next: { revalidate: 60 },
      }),
      fetch(
        `${TFL_API_BASE}/Line/Mode/${modes}/Status/${fromDate}/to/${toDate}?${params}`,
        { next: { revalidate: 300 } }
      ),
    ]);

    const strikes: StrikeInfo[] = [];
    const seenDescriptions = new Set<string>();

    /* ---- Process disruptions (best source — includes validity dates) ---- */
    if (disruptionsRes.ok) {
      const disruptions = await disruptionsRes.json();

      for (const disruption of disruptions) {
        const description = disruption.description || "";
        const closureText = disruption.closureText || "";
        const combined = `${description} ${closureText}`;

        if (!isStrikeRelated(combined)) continue;

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

        /*
         * Extract validity dates from the disruption.
         * TfL disruptions have a validity array with fromDate/toDate.
         * Use the earliest fromDate and latest toDate.
         */
        let strikeFrom = "";
        let strikeTo = "";

        if (disruption.validity && disruption.validity.length > 0) {
          const fromDates = disruption.validity
            .map((v: { fromDate: string }) => v.fromDate)
            .filter(Boolean)
            .sort();
          const toDates = disruption.validity
            .map((v: { toDate: string }) => v.toDate)
            .filter(Boolean)
            .sort();

          if (fromDates.length > 0) strikeFrom = fromDates[0];
          if (toDates.length > 0) strikeTo = toDates[toDates.length - 1];
        }

        /*
         * Only include strikes within our 7-day window:
         * - Strike hasn't ended yet (toDate >= today or no toDate)
         * - Strike starts within 7 days (fromDate <= 7 days out or no fromDate)
         */
        if (strikeTo) {
          const strikeEnd = new Date(strikeTo);
          if (strikeEnd < today) continue; // Strike already passed
        }
        if (strikeFrom) {
          const strikeStart = new Date(strikeFrom);
          if (strikeStart > sevenDaysOut) continue; // Too far in the future
        }

        strikes.push({
          id: `disruption-${strikes.length}`,
          description: description.trim(),
          affectedLines,
          lastUpdated: disruption.lastUpdate || disruption.created || "",
          category: disruption.category || "Unknown",
          fromDate: strikeFrom,
          toDate: strikeTo,
        });
      }
    }

    /* ---- Process current line status reasons ---- */
    if (statusRes.ok) {
      const lines = await statusRes.json();
      processStatusLines(lines, strikes, seenDescriptions, "", "");
    }

    /* ---- Process future (7-day) line status reasons ---- */
    if (futureStatusRes.ok) {
      const lines = await futureStatusRes.json();
      processStatusLines(lines, strikes, seenDescriptions, fromDate, toDate);
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
 * Process line status data and extract strike-related entries.
 * Used for both current status and future date-range status.
 */
function processStatusLines(
  lines: Array<{
    id: string;
    name: string;
    lineStatuses?: Array<{
      reason?: string;
      validityPeriods?: Array<{ fromDate: string; toDate: string }>;
    }>;
  }>,
  strikes: StrikeInfo[],
  seenDescriptions: Set<string>,
  defaultFrom: string,
  defaultTo: string
) {
  for (const line of lines) {
    if (!line.lineStatuses) continue;

    for (const status of line.lineStatuses) {
      const reason = status.reason || "";
      if (!reason || !isStrikeRelated(reason)) continue;

      const descKey = reason.trim().toLowerCase();

      if (seenDescriptions.has(descKey)) {
        /* Already seen — just add this line to the existing entry */
        const existing = strikes.find(
          (s) => s.description.trim().toLowerCase() === descKey
        );
        if (existing && !existing.affectedLines.includes(line.name)) {
          existing.affectedLines.push(line.name);
        }
        continue;
      }
      seenDescriptions.add(descKey);

      /* Extract validity dates if available */
      let strikeFrom = defaultFrom;
      let strikeTo = defaultTo;

      if (status.validityPeriods && status.validityPeriods.length > 0) {
        const fromDates = status.validityPeriods
          .map((v) => v.fromDate)
          .filter(Boolean)
          .sort();
        const toDates = status.validityPeriods
          .map((v) => v.toDate)
          .filter(Boolean)
          .sort();

        if (fromDates.length > 0) strikeFrom = fromDates[0];
        if (toDates.length > 0) strikeTo = toDates[toDates.length - 1];
      }

      strikes.push({
        id: `status-${line.id}-${strikes.length}`,
        description: reason.trim(),
        affectedLines: [line.name],
        lastUpdated: new Date().toISOString(),
        category: "RealTime",
        fromDate: strikeFrom,
        toDate: strikeTo,
      });
    }
  }
}
