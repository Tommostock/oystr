/**
 * API Route: /api/tfl/search
 *
 * Proxies station search requests to the TfL API.
 * This keeps our API key secret on the server side.
 *
 * For bus stops, TfL returns "parent group" stops that don't have
 * a stop letter (H, R, etc.). We expand these into their children
 * so each bus stop shows its letter in the search results.
 *
 * Query params:
 *   ?query=mile end   — the search term
 *
 * Returns:
 *   Array of matching stations with their IDs, names, coordinates,
 *   and for bus stops: stopLetter and indicator.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

/** Shape of a search result we return to the client */
interface SearchStation {
  naptanId: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lines: { id: string; name: string }[];
  /** TfL fare zone (e.g. "1", "2/3") — for tube/rail stations */
  zone?: string;
  /** Bus stop letter (e.g. "H") — only for bus stops */
  stopLetter?: string;
  /** Bus stop indicator text (e.g. "Stop H") — only for bus stops */
  indicator?: string;
}

/**
 * Build API params with the TfL key if available.
 */
function buildParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }
  return params;
}

/**
 * Expand a bus stop parent group into its children.
 *
 * TfL bus stop groups (IDs starting with "490G") don't have a stop letter.
 * The actual individual stops (children) each have a stopLetter like "H"
 * and an indicator like "Stop H".
 *
 * We fetch the parent's details, then return one entry per child stop
 * so the user can pick the specific stop they want.
 *
 * @param parent - The parent bus stop group from the search results
 * @returns Array of individual bus stops with stop letters
 */
async function expandBusParent(parent: SearchStation): Promise<SearchStation[]> {
  try {
    const params = buildParams();
    const response = await fetch(
      `${TFL_API_BASE}/StopPoint/${parent.naptanId}?${params}`,
      {
        /* Cache for 1 hour — bus stop children rarely change */
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      /* If we can't expand, return the parent as-is */
      return [parent];
    }

    const data = await response.json();
    const children: SearchStation[] = [];

    /*
     * Each child has a stopLetter (e.g. "H") and indicator (e.g. "Stop H").
     * We create a search result for each child so the user can pick
     * the specific bus stop they want.
     */
    /*
     * The StopPoint response includes the full lines (bus routes)
     * that the search endpoint doesn't return. Use these instead
     * of the parent's empty lines array.
     */
    const parentLines: { id: string; name: string }[] = (data.lines || []).map(
      (l: { id: string; name: string }) => ({ id: l.id, name: l.name })
    );

    if (data.children && Array.isArray(data.children)) {
      for (const child of data.children) {
        /* Only include children that have a stop letter */
        if (child.stopLetter || child.indicator) {
          /*
           * Use child-specific lines if available (they usually match
           * the parent), otherwise fall back to the parent's lines.
           */
          const childLines: { id: string; name: string }[] =
            child.lines?.length > 0
              ? child.lines.map((l: { id: string; name: string }) => ({
                  id: l.id,
                  name: l.name,
                }))
              : parentLines;

          children.push({
            naptanId: child.naptanId,
            name: child.commonName || parent.name,
            lat: child.lat ?? parent.lat,
            lon: child.lon ?? parent.lon,
            modes: parent.modes,
            lines: childLines,
            stopLetter: child.stopLetter || undefined,
            indicator: child.indicator || undefined,
          });
        }
      }
    }

    /*
     * Cap at 6 children to keep the dropdown manageable.
     * A busy location like Oxford Circus might have 8+ bus stops.
     */
    if (children.length > 0) {
      return children.slice(0, 6);
    }

    /* If no children with letters found, return parent as-is */
    return [parent];
  } catch {
    /* On error, return the parent unchanged */
    return [parent];
  }
}

/**
 * Enrich an individual bus stop with its stop letter.
 *
 * Some bus stops come back from search with IDs like "490000074A"
 * (not a parent group) and don't have a stop letter in the search
 * results. We fetch the stop details to get the letter.
 */
async function enrichBusStop(station: SearchStation): Promise<SearchStation[]> {
  try {
    const params = buildParams();
    const response = await fetch(
      `${TFL_API_BASE}/StopPoint/${station.naptanId}?${params}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) return [station];

    const data = await response.json();

    /*
     * TfL may return the parent group instead of the child directly.
     * If so, find our child in the children array to get the stop letter,
     * and use the parent/child lines for route numbers.
     */
    const lines: { id: string; name: string }[] = (data.lines || []).map(
      (l: { id: string; name: string }) => ({ id: l.id, name: l.name })
    );

    if (data.children && Array.isArray(data.children)) {
      const child = data.children.find(
        (c: { naptanId: string }) => c.naptanId === station.naptanId
      );
      if (child) {
        return [{
          ...station,
          stopLetter: child.stopLetter || undefined,
          indicator: child.indicator || undefined,
          lines: lines.length > 0 ? lines : station.lines,
        }];
      }
    }

    return [{
      ...station,
      stopLetter: data.stopLetter || undefined,
      indicator: data.indicator || undefined,
      lines: lines.length > 0 ? lines : station.lines,
    }];
  } catch {
    return [station];
  }
}

export async function GET(request: NextRequest) {
  /* Extract the search query from the URL */
  const query = request.nextUrl.searchParams.get("query");

  /* Return an error if no search query was provided */
  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    /*
     * Build the TfL API URL.
     * We search for stops that serve tube, bus, DLR, overground, and Elizabeth line.
     * maxResults limits results to avoid overwhelming the autocomplete dropdown.
     */
    const params = new URLSearchParams({
      query: query.trim(),
      modes: "tube,bus,dlr,overground,elizabeth-line",
      maxResults: "10",
    });

    /* Add the API key if we have one (increases rate limit from 50 to 500 req/min) */
    if (process.env.TFL_APP_KEY) {
      params.set("app_key", process.env.TFL_APP_KEY);
    }

    const response = await fetch(
      `${TFL_API_BASE}/StopPoint/Search?${params}`,
      {
        /* Cache the response for 60 seconds to reduce API calls */
        next: { revalidate: 60 },
      }
    );

    /* If TfL returns an error, pass it through */
    if (!response.ok) {
      return NextResponse.json(
        { error: "TfL API error", status: response.status },
        { status: response.statusText === "Too Many Requests" ? 429 : 502 }
      );
    }

    const data = await response.json();

    /*
     * Transform the TfL response into a simpler format.
     * We only need the station ID, name, and which modes it supports.
     */
    const rawStations: SearchStation[] = (data.matches || []).map(
      (match: {
        id: string;
        name: string;
        lat: number;
        lon: number;
        modes: string[];
        zone?: string;
        lines: { id: string; name: string }[];
      }) => ({
        naptanId: match.id,
        name: match.name,
        lat: match.lat,
        lon: match.lon,
        modes: match.modes || [],
        lines: match.lines || [],
        zone: match.zone || undefined,
      })
    );

    /*
     * Expand bus parent groups AND enrich individual bus stops.
     *
     * Bus stop group IDs start with "490G" — expand into children.
     * Individual bus stop IDs start with "490" (not "490G") — fetch
     * their stop letter from the StopPoint API.
     * Non-bus results pass through unchanged.
     */
    const expandPromises = rawStations.map((station) => {
      if (station.naptanId.startsWith("490G")) {
        return expandBusParent(station);
      }
      if (station.naptanId.startsWith("490") && !station.stopLetter) {
        return enrichBusStop(station);
      }
      return Promise.resolve([station]);
    });

    const expandedArrays = await Promise.all(expandPromises);
    const stations = expandedArrays.flat();

    return NextResponse.json(stations);
  } catch (error) {
    console.error("TfL search error:", error);
    return NextResponse.json(
      { error: "Failed to search stations" },
      { status: 500 }
    );
  }
}
