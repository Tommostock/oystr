/**
 * API Route: /api/tfl/journey
 *
 * Proxies journey planning requests to the TfL API.
 * Returns multiple journey options between two stations.
 *
 * Handles TfL's 300 disambiguation response by automatically
 * picking the first matching option and retrying.
 *
 * Query params:
 *   ?from=940GZZLUMLE     — starting station Naptan ID or Hub ID
 *   &to=940GZZLULNB       — destination station Naptan ID or Hub ID
 *   &timeIs=Departing      — "Departing" or "Arriving"
 *   &dateTime=202603251430 — optional departure/arrival time (YYYYMMDDHHmm)
 *
 * Returns:
 *   TfL journey response with multiple route options.
 */

import { NextRequest, NextResponse } from "next/server";
import { TFL_API_BASE } from "@/lib/constants";

/**
 * Build params with API key.
 */
function buildParams(timeIs: string, dateTime: string | null): URLSearchParams {
  const params = new URLSearchParams({
    mode: "tube,bus,dlr,overground,elizabeth-line,walking",
    timeIs: timeIs,
  });

  if (dateTime) {
    params.set("dateTime", dateTime);
  }

  if (process.env.TFL_APP_KEY) {
    params.set("app_key", process.env.TFL_APP_KEY);
  }

  return params;
}

/**
 * Fetch journey results from TfL.
 * If TfL returns 300 (disambiguation), extract the resolved IDs
 * from the response and retry with those.
 */
async function fetchJourney(
  from: string,
  to: string,
  timeIs: string,
  dateTime: string | null
): Promise<Response> {
  const params = buildParams(timeIs, dateTime);
  const url = `${TFL_API_BASE}/Journey/JourneyResults/${from}/to/${to}?${params}`;

  const response = await fetch(url, {
    next: { revalidate: 60 },
  });

  /*
   * Handle 300 disambiguation response.
   * TfL returns this when the from/to IDs are ambiguous (e.g. hub IDs).
   * The response body contains disambiguationOptions with resolved IDs.
   * We pick the first option for both from and to, then retry.
   */
  if (response.status === 300) {
    try {
      const data = await response.json();

      let resolvedFrom = from;
      let resolvedTo = to;

      /* Extract the first disambiguation option for "from" */
      if (
        data.fromLocationDisambiguation?.disambiguationOptions?.length > 0
      ) {
        const firstOption =
          data.fromLocationDisambiguation.disambiguationOptions[0];
        resolvedFrom =
          firstOption.place?.icsId ||
          firstOption.place?.naptanId ||
          firstOption.place?.id ||
          from;
      }

      /* Extract the first disambiguation option for "to" */
      if (
        data.toLocationDisambiguation?.disambiguationOptions?.length > 0
      ) {
        const firstOption =
          data.toLocationDisambiguation.disambiguationOptions[0];
        resolvedTo =
          firstOption.place?.icsId ||
          firstOption.place?.naptanId ||
          firstOption.place?.id ||
          to;
      }

      /* Retry with resolved IDs if different */
      if (resolvedFrom !== from || resolvedTo !== to) {
        const retryParams = buildParams(timeIs, dateTime);
        const retryUrl = `${TFL_API_BASE}/Journey/JourneyResults/${resolvedFrom}/to/${resolvedTo}?${retryParams}`;
        return fetch(retryUrl, { next: { revalidate: 60 } });
      }
    } catch {
      /* If disambiguation parsing fails, return the original response */
    }
  }

  return response;
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const timeIs = request.nextUrl.searchParams.get("timeIs") || "Departing";
  const dateTime = request.nextUrl.searchParams.get("dateTime");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Both 'from' and 'to' parameters are required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetchJourney(from, to, timeIs, dateTime);

    if (!response.ok) {
      return NextResponse.json(
        { error: "TfL API error", status: response.status },
        { status: response.statusText === "Too Many Requests" ? 429 : 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("TfL journey error:", error);
    return NextResponse.json(
      { error: "Failed to plan journey" },
      { status: 500 }
    );
  }
}
