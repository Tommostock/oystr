/**
 * API Route: /api/gemini/ask
 *
 * The AI brain of Oystr — handles any natural language question
 * about London transport by classifying the query type and routing
 * to the right handler.
 *
 * Supported query types:
 *   - journey:  "How do I get from X to Y?"
 *   - nearest:  "What's the nearest station to the O2?"
 *   - timetable: "When is the last train from Liverpool Street?"
 *   - status:   "Is the Central line running?"
 *   - fare:     "How much from Mile End to Heathrow?"
 *
 * Flow:
 *   1. Gemini classifies the query type and extracts parameters
 *   2. We fetch the relevant TfL data based on the type
 *   3. Gemini formats the data into a friendly plain-English answer
 *   4. We return the summary + any structured data
 *
 * POST body:
 *   { query: string, lat?: number, lon?: number }
 *
 * Returns:
 *   { summary: string, type: string, journeys?: Journey[], ... }
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit, recordRequest } from "@/lib/gemini-rate-limit";
import {
  resolveStation,
  resolveFromLocation,
  geocodeWithNominatim,
} from "@/lib/resolve-station";
import { TFL_API_BASE } from "@/lib/constants";

/* ========================================
 * GEMINI SETUP
 * ======================================== */

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

/* ========================================
 * CLASSIFICATION PROMPT
 * Gemini decides what type of question this is
 * and extracts the relevant parameters.
 * ======================================== */

const CLASSIFICATION_PROMPT = `You are a London transport assistant called Oystr. Your job is to understand what the user is asking about London transport and extract the relevant parameters.

Classify the question into ONE of these types and return a JSON object:

TYPE 1 — "journey" (getting from A to B)
Examples: "How do I get to the O2?", "Best route from Stratford to Kings Cross", "Get me to Heathrow by 3pm", "How do I get to 10 Gresham Street?"
Return:
{
  "type": "journey",
  "from": "<station name, address, place, or CURRENT_LOCATION>",
  "to": "<station name, address, or place>",
  "timePreference": "now" | "depart_at" | "arrive_by",
  "time": "<HH:MM 24h or null>"
}

TYPE 2 — "nearest" (finding the closest station to a place)
Examples: "What's the nearest station to the O2?", "Closest tube to Buckingham Palace", "Which station is near 10 Gresham Street?"
Return:
{
  "type": "nearest",
  "place": "<the place, address, or landmark>"
}

TYPE 3 — "timetable" (first/last train times)
Examples: "When is the last train from Liverpool Street?", "What time does the first train leave Stratford?", "Last District line train from Embankment?"
Return:
{
  "type": "timetable",
  "station": "<station name>",
  "line": "<line name or null if not specified>",
  "which": "first" | "last" | "both"
}

TYPE 4 — "status" (line status / disruptions)
Examples: "Is the Central line running?", "Any delays today?", "What's the status of the Northern line?"
Return:
{
  "type": "status",
  "line": "<line ID or null for all lines>"
}
Line IDs: bakerloo, central, circle, district, hammersmith-city, jubilee, metropolitan, northern, piccadilly, victoria, waterloo-city, elizabeth, dlr, london-overground

TYPE 5 — "fare" (journey cost)
Examples: "How much from Mile End to Heathrow?", "What's the fare to Kings Cross?"
Return:
{
  "type": "fare",
  "from": "<station name or CURRENT_LOCATION>",
  "to": "<station name>"
}

Rules:
- If the user says "from here", "nearby", "my location", etc., use "CURRENT_LOCATION"
- If no origin is mentioned in a journey/fare query, use "CURRENT_LOCATION"
- Keep station/place names as the user said them — do NOT convert to IDs
- Map well-known landmarks to helpful names:
  - "the O2" or "O2 Arena" → keep as "the O2" (we will geocode it)
  - "Wembley Stadium" → keep as "Wembley Stadium"
  - "King's Cross" or "Kings Cross" or "KGX" → "King's Cross"
  - For addresses like "10 Gresham Street" → keep the full address
- Convert 12-hour times to 24-hour (e.g. "5pm" → "17:00")
- "last train home" implies timetable type with the user's home station
- If the question is not about London transport, return:
  { "type": "unknown", "error": "I can only help with London transport questions." }

Return ONLY the JSON object, no other text.`;

/* ========================================
 * FORMATTING PROMPTS (one per query type)
 * ======================================== */

const FORMAT_RULES = `Rules for ALL responses:
- Do NOT use any emojis
- Do NOT use markdown formatting (no bold, no bullets, no headers)
- Do NOT say "Sure!" or "Of course!" — just give the answer directly
- Be conversational but concise — like a helpful local giving directions
- Use station names as Londoners say them (e.g. "King's Cross" not "King's Cross St. Pancras Underground Station")`;

const JOURNEY_FORMAT = `You are Oystr, a friendly London transport assistant. Summarise these journey results in 2-4 short sentences.
- Mention which line(s) to take and where to change if needed
- Mention the total journey time
- If fare info is available, mention it (convert pence to pounds, e.g. 310 = 3.10)
- If there are multiple options, describe the fastest and briefly mention alternatives
${FORMAT_RULES}`;

const NEAREST_FORMAT = `You are Oystr, a friendly London transport assistant. Tell the user which station is nearest to the place they asked about.
- Name the station and roughly how far it is
- Mention which lines serve it
- If there are 2-3 nearby options, mention them briefly
${FORMAT_RULES}`;

const TIMETABLE_FORMAT = `You are Oystr, a friendly London transport assistant. Tell the user about the first/last train times.
- State the times clearly
- Mention the direction (towards which terminus)
- If multiple lines serve the station, show each relevant one
- Note that these are scheduled times and may vary on weekends/holidays
${FORMAT_RULES}`;

const STATUS_FORMAT = `You are Oystr, a friendly London transport assistant. Summarise the line status.
- For "Good Service", keep it brief
- For disruptions, explain what's affected in plain English
- If the user asked about a specific line, focus on that
- If giving an overview, mention disrupted lines first, then confirm the rest are running normally
${FORMAT_RULES}`;

const FARE_FORMAT = `You are Oystr, a friendly London transport assistant. Tell the user the fare for their journey.
- State the Oyster/contactless fare clearly (convert pence to pounds)
- If peak and off-peak differ, mention both
- Mention the journey time as a bonus
${FORMAT_RULES}`;

/* ========================================
 * TYPE DEFINITIONS for classified params
 * ======================================== */

interface JourneyParams {
  type: "journey";
  from: string | null;
  to: string;
  timePreference: string;
  time: string | null;
}

interface NearestParams {
  type: "nearest";
  place: string;
}

interface TimetableParams {
  type: "timetable";
  station: string;
  line: string | null;
  which: "first" | "last" | "both";
}

interface StatusParams {
  type: "status";
  line: string | null;
}

interface FareParams {
  type: "fare";
  from: string | null;
  to: string;
}

interface UnknownParams {
  type: "unknown";
  error: string;
}

type ClassifiedParams =
  | JourneyParams
  | NearestParams
  | TimetableParams
  | StatusParams
  | FareParams
  | UnknownParams;

/* ========================================
 * MAIN HANDLER
 * ======================================== */

export async function POST(request: NextRequest) {
  /* --- Check for API key --- */
  const gemini = getGeminiClient();
  if (!gemini) {
    return NextResponse.json(
      { error: "AI features are not configured" },
      { status: 503 }
    );
  }

  /* --- Parse request body --- */
  let query: string;
  let lat: number | undefined;
  let lon: number | undefined;

  try {
    const body = await request.json();
    query = body.query?.trim();
    lat = body.lat;
    lon = body.lon;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!query) {
    return NextResponse.json(
      { error: "Please enter a question" },
      { status: 400 }
    );
  }

  /* --- Rate limiting --- */
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: "AI assistant is busy. Try again in a moment.",
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  try {
    const model = gemini.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    /* ---- Step 1: Classify the query ---- */
    const classResult = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${CLASSIFICATION_PROMPT}\n\nUser question: "${query}"` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 300,
      },
    });

    const classText =
      classResult.response.text?.() ||
      classResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    let params: ClassifiedParams;
    try {
      const cleanJson = classText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      params = JSON.parse(cleanJson);
    } catch {
      return NextResponse.json(
        {
          error:
            "I could not understand that question. Try something like: How do I get from Mile End to Kings Cross?",
        },
        { status: 400 }
      );
    }

    /* ---- Step 2: Route to the right handler ---- */
    let result: {
      summary: string;
      type: string;
      data?: unknown;
      journeys?: unknown[];
    };

    switch (params.type) {
      case "journey":
        result = await handleJourney(model, query, params, lat, lon);
        break;
      case "nearest":
        result = await handleNearest(model, query, params, lat, lon);
        break;
      case "timetable":
        result = await handleTimetable(model, query, params);
        break;
      case "status":
        result = await handleStatus(model, query, params);
        break;
      case "fare":
        result = await handleFare(model, query, params, lat, lon);
        break;
      case "unknown":
        return NextResponse.json(
          { error: params.error || "I can only help with London transport questions." },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          { error: "I could not understand that question." },
          { status: 400 }
        );
    }

    /* Record the request for rate limiting */
    recordRequest();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Gemini ask error:", error);

    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("429") || errorMessage.includes("RATE_LIMIT")) {
      return NextResponse.json(
        { error: "AI assistant has reached its daily limit. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/* ========================================
 * HANDLER: Journey (A to B)
 * ======================================== */

async function handleJourney(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  query: string,
  params: JourneyParams,
  lat?: number,
  lon?: number
) {
  if (!params.to) {
    throw new Error("I need to know where you want to go.");
  }

  const fromName = params.from || "CURRENT_LOCATION";
  const toName = params.to;

  const [fromStation, toStation] = await Promise.all([
    resolveStation(fromName, lat, lon),
    resolveStation(toName, lat, lon),
  ]);

  if (!fromStation) {
    const msg =
      fromName === "CURRENT_LOCATION"
        ? "I could not find a station near your location. Please specify where you are travelling from."
        : `I could not find "${fromName}". Could you try a different name?`;
    throw new Error(msg);
  }

  if (!toStation) {
    throw new Error(
      `I could not find "${toName}". Could you try a different name?`
    );
  }

  /* Call TfL Journey API */
  const journeyParams = new URLSearchParams({
    mode: "tube,bus,dlr,overground,elizabeth-line,walking",
    timeIs: params.timePreference === "arrive_by" ? "Arriving" : "Departing",
  });

  if (params.time && params.timePreference !== "now") {
    const now = new Date();
    const [hours, minutes] = params.time.split(":");
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    journeyParams.set("dateTime", `${year}${month}${day}${hours}${minutes}`);
  }

  if (process.env.TFL_APP_KEY) {
    journeyParams.set("app_key", process.env.TFL_APP_KEY);
  }

  const journeyUrl = `${TFL_API_BASE}/Journey/JourneyResults/${fromStation.naptanId}/to/${toStation.naptanId}?${journeyParams}`;
  const journeyResponse = await fetch(journeyUrl, {
    next: { revalidate: 60 },
  });

  if (!journeyResponse.ok) {
    throw new Error("Could not plan that journey. The TfL service may be busy.");
  }

  const journeyData = await journeyResponse.json();
  const journeys = journeyData.journeys || [];

  if (journeys.length === 0) {
    throw new Error(
      `No routes found from ${fromStation.name} to ${toStation.name}.`
    );
  }

  /* Format with Gemini */
  const formatResult = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${JOURNEY_FORMAT}\n\nUser asked: "${query}"\nFrom: ${fromStation.name}\nTo: ${toStation.name}\n\nJourney results:\n${JSON.stringify(journeys.slice(0, 3), null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  });

  const summary =
    formatResult.response.text?.() ||
    `Take the train from ${fromStation.name} to ${toStation.name}. Journey time: about ${journeys[0]?.duration || "unknown"} minutes.`;

  return {
    summary: summary.trim(),
    type: "journey",
    journeys,
    fromStation: fromStation.name,
    toStation: toStation.name,
  };
}

/* ========================================
 * HANDLER: Nearest Station
 * ======================================== */

async function handleNearest(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  query: string,
  params: NearestParams,
  lat?: number,
  lon?: number
) {
  /* First try to geocode the place name */
  let searchLat = lat;
  let searchLon = lon;

  if (params.place && params.place !== "CURRENT_LOCATION") {
    const geocoded = await geocodeWithNominatim(params.place + ", London, UK");
    if (geocoded) {
      searchLat = geocoded.lat;
      searchLon = geocoded.lon;
    }
  }

  if (!searchLat || !searchLon) {
    throw new Error(
      `I could not find "${params.place}" on the map. Could you be more specific?`
    );
  }

  /* Find nearby stations */
  const nearbyParams = new URLSearchParams({
    lat: searchLat.toString(),
    lon: searchLon.toString(),
    radius: "1000",
    stopTypes: "NaptanMetroStation,NaptanRailStation",
    modes: "tube,dlr,overground,elizabeth-line",
  });

  if (process.env.TFL_APP_KEY) {
    nearbyParams.set("app_key", process.env.TFL_APP_KEY);
  }

  const nearbyResponse = await fetch(
    `${TFL_API_BASE}/StopPoint?${nearbyParams}`,
    { next: { revalidate: 300 } }
  );

  if (!nearbyResponse.ok) {
    throw new Error("Could not search for nearby stations.");
  }

  const nearbyData = await nearbyResponse.json();
  const stations = (nearbyData.stopPoints || []).slice(0, 5).map(
    (s: {
      commonName: string;
      distance: number;
      lines: { id: string; name: string }[];
    }) => ({
      name: s.commonName
        .replace(/ Underground Station$/i, "")
        .replace(/ DLR Station$/i, "")
        .replace(/ Rail Station$/i, "")
        .replace(/ Station$/i, "")
        .trim(),
      distance: Math.round(s.distance),
      lines: (s.lines || []).map((l: { name: string }) => l.name),
    })
  );

  if (stations.length === 0) {
    throw new Error(
      `No stations found near "${params.place}". It may be outside the TfL network.`
    );
  }

  /* Format with Gemini */
  const formatResult = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${NEAREST_FORMAT}\n\nUser asked: "${query}"\nPlace: ${params.place}\n\nNearest stations:\n${JSON.stringify(stations, null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  });

  const summary =
    formatResult.response.text?.() ||
    `The nearest station to ${params.place} is ${stations[0].name} (${stations[0].distance}m away).`;

  return {
    summary: summary.trim(),
    type: "nearest",
    data: { stations, place: params.place },
  };
}

/* ========================================
 * HANDLER: Timetable (first/last trains)
 * ======================================== */

async function handleTimetable(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  query: string,
  params: TimetableParams
) {
  /* Resolve the station name to a naptan ID */
  const station = await resolveStation(params.station);

  if (!station) {
    throw new Error(
      `I could not find a station called "${params.station}". Could you try a different name?`
    );
  }

  /* Call the existing first-last API */
  const tflParams = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    tflParams.set("app_key", process.env.TFL_APP_KEY);
  }

  /* Fetch station data to get lines, then fetch timetable */
  const stationResp = await fetch(
    `${TFL_API_BASE}/StopPoint/${station.naptanId}?${tflParams}`,
    { next: { revalidate: 86400 } }
  );

  if (!stationResp.ok) {
    throw new Error("Could not find that station's timetable.");
  }

  const stationData = await stationResp.json();
  const lineIds: string[] = (stationData.lines || [])
    .map((l: { id: string }) => l.id)
    .filter((id: string) => !id.startsWith("london-overground"));

  /* If user specified a line, filter to just that */
  const targetLines = params.line
    ? lineIds.filter(
        (id) =>
          id === params.line ||
          id.includes(params.line!.toLowerCase().replace(/ /g, "-"))
      )
    : lineIds.slice(0, 4);

  if (targetLines.length === 0) {
    throw new Error(
      params.line
        ? `The ${params.line} line does not serve ${station.name}.`
        : `No timetable data found for ${station.name}.`
    );
  }

  /* Fetch timetables for each line */
  const now = new Date();
  const day = now.getDay();

  interface TrainTime {
    lineId: string;
    direction: string;
    time: string;
    rawMinutes: number;
  }

  const allFirstTrains: TrainTime[] = [];
  const allLastTrains: TrainTime[] = [];

  await Promise.all(
    targetLines.map(async (lineId) => {
      try {
        const [disambResp, inboundResp, outboundResp] = await Promise.all([
          fetch(
            `${TFL_API_BASE}/Line/${lineId}/Timetable/${station.naptanId}?${tflParams}`,
            { next: { revalidate: 86400 } }
          ),
          fetch(
            `${TFL_API_BASE}/Line/${lineId}/Timetable/${station.naptanId}?direction=inbound&${tflParams}`,
            { next: { revalidate: 3600 } }
          ),
          fetch(
            `${TFL_API_BASE}/Line/${lineId}/Timetable/${station.naptanId}?direction=outbound&${tflParams}`,
            { next: { revalidate: 3600 } }
          ),
        ]);

        /* Extract direction names from disambiguation */
        const directionNames: Record<string, string> = {};
        if (disambResp.ok) {
          const disambData = await disambResp.json();
          const options =
            disambData.disambiguation?.disambiguationOptions || [];
          for (const opt of options) {
            const desc: string = opt.description || "";
            const uri: string = opt.uri || "";
            const isInbound = uri.includes("direction=inbound");
            const parts = desc.split(" - ");
            if (parts.length === 2) {
              const dest = parts[1]
                .replace(/ Underground Station$/i, "")
                .replace(/ Station$/i, "")
                .trim();
              const key = isInbound ? "inbound" : "outbound";
              if (!directionNames[key]) directionNames[key] = dest;
            }
          }
        }

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const allRoutes: { route: any; direction: string }[] = [];
        for (const [resp, dir] of [
          [inboundResp, "inbound"],
          [outboundResp, "outbound"],
        ] as const) {
          if (!resp.ok) continue;
          const data = await resp.json();
          const routes = data.timetable?.routes || [];
          for (const route of routes) {
            allRoutes.push({ route, direction: dir });
          }
        }

        for (const { route, direction: dir } of allRoutes) {
          const schedules = route.schedules || [];
          let schedule = schedules[0];

          for (const s of schedules) {
            const name = (s.name || "").toLowerCase();
            if (day >= 1 && day <= 5 && (name.includes("monday") || name.includes("friday"))) {
              schedule = s;
              break;
            }
            if (day === 6 && name.includes("saturday")) {
              schedule = s;
              break;
            }
            if (day === 0 && name.includes("sunday")) {
              schedule = s;
              break;
            }
          }

          const journeys = schedule?.knownJourneys || [];
          if (journeys.length === 0) continue;

          const terminus = directionNames[dir] || dir;
          const dirLabel = `${lineId} towards ${terminus}`;

          const first = journeys[0];
          const last = journeys[journeys.length - 1];
          const formatTime = (h: number, m: number) => {
            const hr = h >= 24 ? h - 24 : h;
            return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          };
          const toMins = (h: number, m: number) => h * 60 + m;

          allFirstTrains.push({
            lineId,
            direction: dirLabel,
            time: formatTime(first.hour, first.minute),
            rawMinutes: toMins(first.hour, first.minute),
          });

          allLastTrains.push({
            lineId,
            direction: dirLabel,
            time: formatTime(last.hour, last.minute),
            rawMinutes: toMins(last.hour, last.minute),
          });
        }
      } catch {
        /* Skip lines that fail */
      }
    })
  );

  allFirstTrains.sort((a, b) => a.rawMinutes - b.rawMinutes);
  allLastTrains.sort((a, b) => b.rawMinutes - a.rawMinutes);

  const timetableData = {
    station: station.name,
    firstTrains: allFirstTrains.slice(0, 6),
    lastTrains: allLastTrains.slice(0, 6),
  };

  /* Format with Gemini */
  const formatResult = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${TIMETABLE_FORMAT}\n\nUser asked: "${query}"\nStation: ${station.name}\nRequested: ${params.which} train(s)\n\nTimetable data:\n${JSON.stringify(timetableData, null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
  });

  const summary =
    formatResult.response.text?.() ||
    `Timetable data for ${station.name} retrieved.`;

  return {
    summary: summary.trim(),
    type: "timetable",
    data: timetableData,
  };
}

/* ========================================
 * HANDLER: Line Status
 * ======================================== */

async function handleStatus(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  query: string,
  params: StatusParams
) {
  const tflParams = new URLSearchParams();
  if (process.env.TFL_APP_KEY) {
    tflParams.set("app_key", process.env.TFL_APP_KEY);
  }

  const statusResponse = await fetch(
    `${TFL_API_BASE}/Line/Mode/tube,overground,dlr,elizabeth-line,tram/Status?${tflParams}`,
    { next: { revalidate: 60 } }
  );

  if (!statusResponse.ok) {
    throw new Error("Could not fetch line status from TfL.");
  }

  const allStatuses = await statusResponse.json();

  /* Filter to specific line if requested */
  let relevantStatuses = allStatuses;
  if (params.line) {
    relevantStatuses = allStatuses.filter(
      (line: { id: string }) => line.id === params.line
    );
    if (relevantStatuses.length === 0) {
      throw new Error(`Could not find status for "${params.line}".`);
    }
  }

  /* Simplify the data for Gemini */
  const statusSummary = relevantStatuses.map(
    (line: {
      id: string;
      name: string;
      lineStatuses: {
        statusSeverityDescription: string;
        reason: string;
      }[];
    }) => ({
      name: line.name,
      status: line.lineStatuses[0]?.statusSeverityDescription || "Unknown",
      reason: line.lineStatuses[0]?.reason || "",
    })
  );

  /* Format with Gemini */
  const formatResult = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${STATUS_FORMAT}\n\nUser asked: "${query}"\n\nLine statuses:\n${JSON.stringify(statusSummary, null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
  });

  const summary =
    formatResult.response.text?.() || "Line status data retrieved.";

  return {
    summary: summary.trim(),
    type: "status",
    data: { statuses: statusSummary },
  };
}

/* ========================================
 * HANDLER: Fare
 * Reuses the journey handler but focuses
 * the summary on cost.
 * ======================================== */

async function handleFare(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  query: string,
  params: FareParams,
  lat?: number,
  lon?: number
) {
  /* Plan a journey to get the fare data */
  const journeyResult = await handleJourney(
    model,
    query,
    {
      type: "journey",
      from: params.from,
      to: params.to,
      timePreference: "now",
      time: null,
    },
    lat,
    lon
  );

  /* Re-format the summary to focus on fare */
  const formatResult = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${FARE_FORMAT}\n\nUser asked: "${query}"\nFrom: ${journeyResult.fromStation}\nTo: ${journeyResult.toStation}\n\nJourney results:\n${JSON.stringify((journeyResult.journeys || []).slice(0, 2), null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  });

  const summary =
    formatResult.response.text?.() || journeyResult.summary;

  return {
    ...journeyResult,
    summary: summary.trim(),
    type: "fare",
  };
}
