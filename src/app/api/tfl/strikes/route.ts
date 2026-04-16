/**
 * API Route: /api/tfl/strikes
 *
 * Fetches disruption data from TfL and identifies strike action
 * and major planned closures for the next 7 days.
 *
 * Detection strategy (two-pronged):
 *
 *   1. KEYWORD MATCHING — Scan all disruption text for strike-related
 *      keywords ("strike", "industrial action", "RMT", etc.)
 *
 *   2. MASS CLOSURE DETECTION — Query TfL's date-range status endpoint
 *      and look for future dates where many tube lines are simultaneously
 *      showing "Planned Closure" or "Suspended". When 3+ lines are all
 *      closed on the same date, that's almost certainly a strike.
 *
 * This two-pronged approach means we catch strikes even if TfL
 * doesn't use the word "strike" in their API descriptions.
 *
 * Returns:
 *   Array of StrikeInfo objects with description, affected lines,
 *   and from/to dates.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";
import type { StrikeInfo } from "@/lib/tfl-types";

/* ========================================
 * KEYWORD MATCHING
 * ======================================== */

/** Keywords that indicate a strike or industrial action */
const STRIKE_KEYWORDS = [
  "strike",
  "industrial action",
  "walk out",
  "walkout",
  "walk-out",
  "rmt",
  "aslef",
  "tssa",
  "unite the union",
];

function isStrikeRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return STRIKE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/* ========================================
 * SEVERITY LEVELS
 * Severities that indicate a major planned disruption.
 * These are the status codes TfL uses for closures.
 * ======================================== */

/** Severity codes that indicate closure / suspension */
const CLOSURE_SEVERITIES = new Set([
  1,  // Closed
  2,  // Suspended
  3,  // Part Suspended
  4,  // Planned Closure
  5,  // Part Closure
  16, // Not Running
  20, // Service Closed
]);

/* ========================================
 * HELPERS
 * ======================================== */

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Try to add a strike entry, deduplicating by description.
 * If the description already exists, merge the affected lines
 * and widen the date range.
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
): void {
  const descKey = entry.description.trim().toLowerCase();

  if (seenDescriptions.has(descKey)) {
    const existing = strikes.find(
      (s) => s.description.trim().toLowerCase() === descKey
    );
    if (existing) {
      for (const line of entry.affectedLines) {
        if (!existing.affectedLines.includes(line)) {
          existing.affectedLines.push(line);
        }
      }
      if (!existing.fromDate && entry.fromDate) existing.fromDate = entry.fromDate;
      if (!existing.toDate && entry.toDate) existing.toDate = entry.toDate;
    }
    return;
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
}

/**
 * Extract the earliest fromDate and latest toDate from validity periods.
 */
function extractDateRange(
  periods: Array<{ fromDate?: string; toDate?: string }> | undefined
): { fromDate: string; toDate: string } {
  if (!periods || periods.length === 0) return { fromDate: "", toDate: "" };

  const fromDates = periods.map((v) => v.fromDate).filter(Boolean).sort() as string[];
  const toDates = periods.map((v) => v.toDate).filter(Boolean).sort() as string[];

  return {
    fromDate: fromDates[0] || "",
    toDate: toDates[toDates.length - 1] || "",
  };
}

function isWithinWindow(from: string, to: string, today: Date, windowEnd: Date): boolean {
  if (!from && !to) return true;
  if (to && new Date(to) < today) return false;
  if (from && new Date(from) > windowEnd) return false;
  return true;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  try {
    /* Check for debug mode via query parameter */
    const debugMode = request.nextUrl.searchParams.get("debug") === "true";

    const params = new URLSearchParams();
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const modes = "tube,overground,dlr,elizabeth-line,tram";
    const today = new Date();
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(today.getDate() + 7);

    const fromDateStr = formatDate(today);
    const toDateStr = formatDate(sevenDaysOut);

    /*
     * The date-range status endpoint uses LINE IDS, not modes.
     * /Line/{ids}/Status/{startDate}/to/{endDate}
     * Use just the core tube lines to avoid 404 from unknown IDs.
     */
    const tubeLineIds = "bakerloo,central,circle,district,hammersmith-city,jubilee,metropolitan,northern,piccadilly,victoria,waterloo-city";

    /* Build URLs for logging */
    const disruptionsUrl = `${TFL_API_BASE}/Line/Mode/${modes}/Disruption?${params}`;
    const statusUrl = `${TFL_API_BASE}/Line/Mode/${modes}/Status?${params}`;
    const futureStatusUrl = `${TFL_API_BASE}/Line/${tubeLineIds}/Status/${fromDateStr}/to/${toDateStr}?${params}`;

    /*
     * Fetch all three data sources in parallel.
     */
    const [disruptionsRes, statusRes, futureStatusRes] = await Promise.all([
      fetch(disruptionsUrl, { next: { revalidate: 300 } }),
      fetch(statusUrl, { next: { revalidate: 60 } }),
      fetch(futureStatusUrl, { next: { revalidate: 300 } }),
    ]);

    const strikes: StrikeInfo[] = [];
    const seenDescriptions = new Set<string>();

    /* Parse all raw responses (needed for both normal + debug mode) */
    const rawDisruptions = disruptionsRes.ok ? await disruptionsRes.json() : null;
    const rawStatus = statusRes.ok ? await statusRes.json() : null;
    const rawFutureStatus = futureStatusRes.ok ? await futureStatusRes.json() : null;

    /* ================================================================
     * DEBUG MODE: Return raw TfL data so we can see what's there
     * Visit /api/tfl/strikes?debug=true to use this.
     * ================================================================ */
    if (debugMode) {
      /* Summarise future status: for each line, show all lineStatus entries
         with their severity, description, reason, disruption, and validity */
      const futureStatusSummary = Array.isArray(rawFutureStatus)
        ? rawFutureStatus.map((line: any) => ({
            id: line.id,
            name: line.name,
            modeName: line.modeName,
            disruptionsCount: line.disruptions?.length || 0,
            disruptions: line.disruptions || [],
            lineStatuses: (line.lineStatuses || []).map((ls: any) => ({
              severity: ls.statusSeverity,
              description: ls.statusSeverityDescription,
              reason: ls.reason || null,
              disruption: ls.disruption || null,
              validityPeriods: ls.validityPeriods || [],
            })),
          }))
        : null;

      return NextResponse.json({
        _debug: true,
        dateRange: { from: fromDateStr, to: toDateStr },
        urls: {
          disruptions: disruptionsUrl.replace(/app_key=[^&]+/, "app_key=REDACTED"),
          status: statusUrl.replace(/app_key=[^&]+/, "app_key=REDACTED"),
          futureStatus: futureStatusUrl.replace(/app_key=[^&]+/, "app_key=REDACTED"),
        },
        responses: {
          disruptions: { ok: disruptionsRes.ok, status: disruptionsRes.status },
          status: { ok: statusRes.ok, status: statusRes.status },
          futureStatus: { ok: futureStatusRes.ok, status: futureStatusRes.status },
        },
        disruptionCount: Array.isArray(rawDisruptions) ? rawDisruptions.length : 0,
        rawDisruptions: rawDisruptions,
        futureStatusLineCount: futureStatusSummary?.length || 0,
        futureStatusSummary: futureStatusSummary,
      });
    }

    /* ================================================================
     * STRATEGY 1: Keyword matching on /Disruption endpoint
     * ================================================================ */
    if (Array.isArray(rawDisruptions)) {
      for (const disruption of rawDisruptions) {
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

        const { fromDate, toDate } = extractDateRange(disruption.validity);
        if (!isWithinWindow(fromDate, toDate, today, sevenDaysOut)) continue;

        addStrike(strikes, seenDescriptions, {
          description,
          affectedLines,
          lastUpdated: disruption.lastUpdate || disruption.created || "",
          category: disruption.category || "PlannedWork",
          fromDate,
          toDate,
        });
      }
    }

    /* ================================================================
     * STRATEGY 2: Keyword matching on current /Status endpoint
     * Check reason text and nested disruption objects.
     * ================================================================ */
    if (Array.isArray(rawStatus)) {
      scanLinesForKeywords(rawStatus, strikes, seenDescriptions, today, sevenDaysOut);
    }

    /* ================================================================
     * STRATEGY 3: Keyword matching on future /Status endpoint
     * Same check but on the 7-day date-range response.
     * ================================================================ */
    const futureLines: any[] = Array.isArray(rawFutureStatus) ? rawFutureStatus : [];
    if (futureLines.length > 0) {
      scanLinesForKeywords(futureLines, strikes, seenDescriptions, today, sevenDaysOut);
    }

    /* ================================================================
     * STRATEGY 4: Mass closure detection on future dates
     *
     * Look at the 7-day date-range status. For each line, check ALL
     * lineStatus entries (not just the first). Find entries with
     * closure-level severity and FUTURE validity periods. Group them
     * by date. When 3+ lines are closed on the same date, that's
     * almost certainly a strike or major industrial action.
     * ================================================================ */
    if (futureLines.length > 0) {
      detectMassClosures(futureLines, strikes, seenDescriptions, today, sevenDaysOut);
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
 * Scan line data for strike-related keywords in all text fields.
 * Checks: line.disruptions[], lineStatuses[].disruption, lineStatuses[].reason
 */
function scanLinesForKeywords(
  lines: any[],
  strikes: StrikeInfo[],
  seenDescriptions: Set<string>,
  today: Date,
  windowEnd: Date
) {
  for (const line of lines) {
    /* Check top-level line.disruptions[] */
    if (Array.isArray(line.disruptions)) {
      for (const d of line.disruptions) {
        const combined = `${d.description || ""} ${d.closureText || ""} ${d.additionalInfo || ""}`;
        if (!isStrikeRelated(combined)) continue;

        const affectedLines = [line.name];
        if (d.affectedRoutes) {
          for (const r of d.affectedRoutes) {
            if (r.name && !affectedLines.includes(r.name)) affectedLines.push(r.name);
          }
        }

        addStrike(strikes, seenDescriptions, {
          description: d.description || d.closureText || combined,
          affectedLines,
          lastUpdated: d.lastUpdate || d.created || "",
          category: d.category || "PlannedWork",
          fromDate: "",
          toDate: "",
        });
      }
    }

    /* Check each lineStatus entry */
    if (!Array.isArray(line.lineStatuses)) continue;

    for (const ls of line.lineStatuses) {
      const { fromDate, toDate } = extractDateRange(ls.validityPeriods);

      /* Check nested disruption object */
      if (ls.disruption) {
        const d = ls.disruption;
        const combined = `${d.description || ""} ${d.closureText || ""} ${d.additionalInfo || ""}`;

        if (isStrikeRelated(combined)) {
          if (!isWithinWindow(fromDate, toDate, today, windowEnd)) continue;

          const affectedLines = [line.name];
          if (d.affectedRoutes) {
            for (const r of d.affectedRoutes) {
              if (r.name && !affectedLines.includes(r.name)) affectedLines.push(r.name);
            }
          }

          addStrike(strikes, seenDescriptions, {
            description: d.description || d.closureText || "",
            affectedLines,
            lastUpdated: d.lastUpdate || d.created || "",
            category: d.category || "PlannedWork",
            fromDate,
            toDate,
          });
          continue;
        }
      }

      /* Check reason text */
      const reason = ls.reason || "";
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

/**
 * MASS CLOSURE DETECTION
 *
 * Look at every lineStatus entry across all lines. For entries
 * with closure-level severity (Planned Closure, Suspended, etc.)
 * that have FUTURE validity periods, group them by date.
 *
 * When 3+ tube lines all show as closed on the same date range,
 * create a strike entry for that date.
 *
 * This catches strikes even when TfL doesn't use the word "strike"
 * anywhere in the API data.
 */
function detectMassClosures(
  lines: any[],
  strikes: StrikeInfo[],
  seenDescriptions: Set<string>,
  today: Date,
  windowEnd: Date
) {
  /*
   * Collect all future closure periods grouped by their date range.
   * Key = "fromDate|toDate", Value = { lines affected, description, dates }
   */
  const closureGroups = new Map<
    string,
    {
      affectedLines: string[];
      fromDate: string;
      toDate: string;
      description: string;
      reasons: string[];
    }
  >();

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (const line of lines) {
    if (!Array.isArray(line.lineStatuses)) continue;

    /* Only count tube lines for mass closure detection */
    const isTube = line.modeName === "tube";

    for (const ls of line.lineStatuses) {
      const severity = ls.statusSeverity ?? 10;

      /* Skip if not a closure-level severity */
      if (!CLOSURE_SEVERITIES.has(severity)) continue;

      /* Check each validity period */
      if (!Array.isArray(ls.validityPeriods)) continue;

      for (const vp of ls.validityPeriods) {
        if (!vp.fromDate) continue;

        const vpFrom = new Date(vp.fromDate);
        const vpTo = vp.toDate ? new Date(vp.toDate) : vpFrom;

        /* Skip if this period has already passed */
        if (vpTo < todayStart) continue;

        /* Skip if entirely in the future beyond our window */
        if (vpFrom > windowEnd) continue;

        /*
         * Only flag FUTURE closures (not current ones — those are
         * already shown in the line status cards).
         * A closure counts as "future" if it starts after right now.
         */
        const isCurrentlyActive = vp.isNow === true;
        const startsTomorrow = vpFrom > today;

        if (!startsTomorrow && !isCurrentlyActive) {
          /* Still include if end date is in the future */
          if (vpTo <= today) continue;
        }

        /* Build a key from the dates (rounded to day) */
        const fromKey = formatDate(vpFrom);
        const toKey = formatDate(vpTo);
        const groupKey = `${fromKey}|${toKey}`;

        if (!closureGroups.has(groupKey)) {
          closureGroups.set(groupKey, {
            affectedLines: [],
            fromDate: vp.fromDate,
            toDate: vp.toDate || vp.fromDate,
            description: "",
            reasons: [],
          });
        }

        const group = closureGroups.get(groupKey)!;

        /* Add this line to the group */
        const lineName = line.name || line.id;
        if (!group.affectedLines.includes(lineName)) {
          group.affectedLines.push(lineName);
        }

        /* Collect reason text */
        const reason = ls.reason || "";
        const desc = ls.disruption?.description || ls.disruption?.closureText || "";
        if (reason && !group.reasons.includes(reason)) group.reasons.push(reason);
        if (desc && !group.reasons.includes(desc)) group.reasons.push(desc);

        /* Only count tube lines for mass closure threshold */
        if (!isTube) continue;
      }
    }
  }

  /*
   * Now check each group. If 3+ lines are affected on the same dates,
   * create a strike entry (unless we already have one for these dates).
   */
  for (const [, group] of closureGroups) {
    if (group.affectedLines.length < 3) continue;

    /* Build a description from available reason text, or generate one */
    let description = group.reasons[0] || "";
    if (!description) {
      const dateFrom = new Date(group.fromDate);
      const dateTo = new Date(group.toDate);
      const fromStr = dateFrom.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const toStr = dateTo.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      if (fromStr === toStr) {
        description = `Planned disruption affecting ${group.affectedLines.length} lines on ${fromStr}. Check TfL for the latest information.`;
      } else {
        description = `Planned disruption affecting ${group.affectedLines.length} lines from ${fromStr} to ${toStr}. Check TfL for the latest information.`;
      }
    }

    addStrike(strikes, seenDescriptions, {
      description,
      affectedLines: group.affectedLines,
      lastUpdated: new Date().toISOString(),
      category: "PlannedWork",
      fromDate: group.fromDate,
      toDate: group.toDate,
    });
  }
}
