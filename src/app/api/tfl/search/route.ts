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
    if (data.children && Array.isArray(data.children)) {
      for (const child of data.children) {
        /* Only include children that have a stop letter */
        if (child.stopLetter || child.indicator) {
          children.push({
            naptanId: child.naptanId,
            name: child.commonName || parent.name,
            lat: child.lat ?? parent.lat,
            lon: child.lon ?? parent.lon,
            modes: parent.modes,
            lines: parent.lines,
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
        lines: { id: string; name: string }[];
      }) => ({
        naptanId: match.id,
        name: match.name,
        lat: match.lat,
        lon: match.lon,
        modes: match.modes || [],
        lines: match.lines || [],
      })
    );

    /*
     * Expand bus parent groups into individual stops with letters.
     *
     * Bus stop group IDs start with "490G" (e.g. "490G00008174").
     * These parents don't have stop letters — their children do.
     * We expand each parent into its children so the search dropdown
     * shows individual stops like "Oxford Street (Stop H)".
     *
     * Non-bus results (tube, DLR, etc.) pass through unchanged.
     */
    const expandPromises = rawStations.map((station) => {
      if (station.naptanId.startsWith("490G")) {
        return expandBusParent(station);
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
