/**
 * API Route: /api/gemini/journey
 *
 * Natural language journey planning powered by Google Gemini.
 *
 * Flow:
 *   1. User sends a natural language question (e.g. "How do I get to the O2?")
 *   2. Gemini extracts journey parameters (from, to, time preferences)
 *   3. We resolve station names to naptan IDs via the TfL search API
 *   4. We call the TfL Journey API with those IDs
 *   5. Gemini formats the results into a friendly plain-English summary
 *   6. We return both the summary and the raw journey data
 *
 * All Gemini calls are server-side — the API key is never exposed to the client.
 *
 * POST body:
 *   { query: string, lat?: number, lon?: number }
 *
 * Returns:
 *   { summary: string, journeys: Journey[] }
 *
 * Error responses:
 *   400 — missing or empty query
 *   429 — rate limited (includes retryAfterSeconds)
 *   503 — Gemini unavailable or API key missing
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit, recordRequest } from "@/lib/gemini-rate-limit";
import { resolveStation } from "@/lib/resolve-station";
import { TFL_API_BASE } from "@/lib/constants";

/* ========================================
 * GEMINI SETUP
 * ======================================== */

/**
 * Create a Gemini client. Returns null if no API key is configured.
 */
function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

/* ========================================
 * PROMPT TEMPLATES
 * ======================================== */

/**
 * System prompt for extracting journey parameters from natural language.
 *
 * Gemini should return a JSON object with the origin, destination,
 * and any time preferences extracted from the user's question.
 */
const EXTRACTION_PROMPT = `You are a London transport assistant. Your job is to extract journey planning parameters from natural language questions about getting around London.

Given a user's question, extract the following as a JSON object:
{
  "from": "<station name or CURRENT_LOCATION or null>",
  "to": "<station name or null>",
  "timePreference": "<now | depart_at | arrive_by>",
  "time": "<HH:MM in 24h format or null>"
}

Rules:
- If the user says "from here", "from my location", "from where I am", "nearby", or similar, set "from" to "CURRENT_LOCATION"
- If no origin is mentioned, set "from" to "CURRENT_LOCATION" (assume they mean from where they are)
- Map well-known London landmarks to their nearest station:
  - "the O2" or "O2 Arena" -> "North Greenwich"
  - "Wembley Stadium" -> "Wembley Park"
  - "The Shard" -> "London Bridge"
  - "Buckingham Palace" -> "Victoria"
  - "Tower of London" -> "Tower Hill"
  - "Big Ben" or "Houses of Parliament" or "Parliament" -> "Westminster"
  - "British Museum" -> "Holborn"
  - "Natural History Museum" -> "South Kensington"
  - "Canary Wharf" -> "Canary Wharf"
  - "ExCeL" or "Excel London" -> "Custom House"
  - "Heathrow" -> "Heathrow Terminals 2 & 3"
  - "Westfield Stratford" -> "Stratford"
  - "Westfield Shepherd's Bush" or "Westfield White City" -> "Shepherd's Bush"
  - "Olympic Park" -> "Stratford"
  - "Emirates Stadium" or "Arsenal" -> "Arsenal"
  - "Tottenham Hotspur Stadium" or "Spurs" -> "White Hart Lane"
  - "Stamford Bridge" or "Chelsea FC" -> "Fulham Broadway"
  - "Crystal Palace" -> "Crystal Palace"
  - "The Oval" or "Oval cricket" -> "Oval"
  - "Lord's" or "Lord's Cricket Ground" -> "St John's Wood"
  - "Twickenham" -> "Twickenham"
  - "Wimbledon" (tennis/area) -> "Wimbledon"
  - "Alexandra Palace" -> "Alexandra Palace"
  - "Kew Gardens" -> "Kew Gardens"
  - "Greenwich" (area/observatory) -> "Greenwich"
  - "Camden Market" or "Camden Town" -> "Camden Town"
  - "King's Cross" or "Kings Cross" or "KGX" -> "King's Cross St. Pancras"
  - "St Pancras" or "St. Pancras" -> "King's Cross St. Pancras"
  - "Paddington" (station or area) -> "Paddington"
  - "Euston" -> "Euston"
  - "Liverpool Street" -> "Liverpool Street"
  - "Waterloo" -> "Waterloo"
  - "Victoria" (station) -> "Victoria"
- Use the station's common name as Londoners would say it
- If the user says "by 5pm" or "arrive by 3", set timePreference to "arrive_by"
- If the user says "leaving at 8am" or "depart at noon", set timePreference to "depart_at"
- If no time is mentioned, set timePreference to "now" and time to null
- Convert 12-hour times to 24-hour format (e.g. "5pm" -> "17:00")
- If you cannot understand the question or it is not about London transport, return:
  { "from": null, "to": null, "timePreference": "now", "time": null, "error": "I can only help with London transport journey planning." }

Return ONLY the JSON object, no other text.`;

/**
 * System prompt for formatting journey results into plain English.
 *
 * Gemini should produce a short, helpful summary that reads naturally.
 */
const FORMATTING_PROMPT = `You are a friendly London transport assistant called Oystr. Summarise the following journey results in 2-4 short sentences of plain English.

Rules:
- Mention which line(s) to take and where to change if needed
- Mention the total journey time
- If fare information is available, mention the fare (convert pence to pounds, e.g. 310 pence = 3.10)
- Be conversational but concise — like a helpful local giving directions
- Do NOT use any emojis
- Do NOT use markdown formatting
- Do NOT say "Sure!" or "Of course!" — just give the answer directly
- If there are multiple journey options, describe the fastest one and briefly mention alternatives
- Use station names as Londoners would say them (e.g. "King's Cross" not "King's Cross St. Pancras Underground Station")`;

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
    /* ---- Step 1: Extract journey parameters from natural language ---- */
    const model = gemini.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const extractionResult = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: `${EXTRACTION_PROMPT}\n\nUser question: "${query}"` }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 200,
      },
    });

    const extractionText =
      extractionResult.response.text?.() ||
      extractionResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    /* Parse the JSON from Gemini's response */
    let params: {
      from: string | null;
      to: string | null;
      timePreference: string;
      time: string | null;
      error?: string;
    };

    try {
      /* Strip any markdown code fences Gemini might add */
      const cleanJson = extractionText
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

    /* Check if Gemini flagged this as a non-journey question */
    if (params.error) {
      return NextResponse.json({ error: params.error }, { status: 400 });
    }

    /* We need at least a destination */
    if (!params.to) {
      return NextResponse.json(
        {
          error:
            "I need to know where you want to go. Try: How do I get to Kings Cross?",
        },
        { status: 400 }
      );
    }

    /* ---- Step 2: Resolve station names to naptan IDs ---- */
    const fromName = params.from || "CURRENT_LOCATION";
    const toName = params.to;

    const [fromStation, toStation] = await Promise.all([
      resolveStation(fromName, lat, lon),
      resolveStation(toName),
    ]);

    if (!fromStation) {
      const message =
        fromName === "CURRENT_LOCATION"
          ? "I could not find a station near your location. Please specify where you are travelling from."
          : `I could not find a station called "${fromName}". Could you try a different name?`;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!toStation) {
      return NextResponse.json(
        {
          error: `I could not find a station called "${toName}". Could you try a different name?`,
        },
        { status: 400 }
      );
    }

    /* ---- Step 3: Call the TfL Journey API ---- */
    const journeyParams = new URLSearchParams({
      mode: "tube,bus,dlr,overground,elizabeth-line,walking",
      timeIs: params.timePreference === "arrive_by" ? "Arriving" : "Departing",
    });

    /* Add time if specified */
    if (params.time && params.timePreference !== "now") {
      /* Format as YYYYMMDDHHmm for TfL */
      const now = new Date();
      const [hours, minutes] = params.time.split(":");
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      journeyParams.set(
        "dateTime",
        `${year}${month}${day}${hours}${minutes}`
      );
    }

    if (process.env.TFL_APP_KEY) {
      journeyParams.set("app_key", process.env.TFL_APP_KEY);
    }

    const journeyUrl = `${TFL_API_BASE}/Journey/JourneyResults/${fromStation.naptanId}/to/${toStation.naptanId}?${journeyParams}`;
    const journeyResponse = await fetch(journeyUrl, {
      next: { revalidate: 60 },
    });

    if (!journeyResponse.ok) {
      return NextResponse.json(
        { error: "Could not plan that journey. The TfL service may be busy." },
        { status: 502 }
      );
    }

    const journeyData = await journeyResponse.json();
    const journeys = journeyData.journeys || [];

    if (journeys.length === 0) {
      return NextResponse.json(
        {
          error: `No routes found from ${fromStation.name} to ${toStation.name}. This journey may not be possible right now.`,
        },
        { status: 404 }
      );
    }

    /* ---- Step 4: Format the results with Gemini ---- */
    const formattingResult = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${FORMATTING_PROMPT}\n\nThe user asked: "${query}"\nFrom: ${fromStation.name}\nTo: ${toStation.name}\n\nJourney results (JSON):\n${JSON.stringify(journeys.slice(0, 3), null, 2)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 300,
      },
    });

    const summary =
      formattingResult.response.text?.() ||
      formattingResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
      `Take the train from ${fromStation.name} to ${toStation.name}. Journey time: approximately ${journeys[0]?.duration || "unknown"} minutes.`;

    /* Record this request for rate limiting (counts both Gemini calls as one user request) */
    recordRequest();

    /* ---- Step 5: Return the summary + structured journey data ---- */
    return NextResponse.json({
      summary: summary.trim(),
      journeys,
      fromStation: fromStation.name,
      toStation: toStation.name,
    });
  } catch (error) {
    console.error("Gemini journey error:", error);

    /* Check if this is a Gemini rate limit error (429 from Google) */
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("429") || errorMessage.includes("RATE_LIMIT")) {
      return NextResponse.json(
        {
          error:
            "AI assistant has reached its daily limit. Please use the journey planner below instead.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong. Please use the journey planner below." },
      { status: 500 }
    );
  }
}
