/**
 * airport-transport.ts — Ground-transport options for London airports
 *
 * Each London airport has its own mix of rail / tube / express-bus
 * links from central London. The Flights tab surfaces these on the
 * airport page so the user can plan their journey to the airport
 * without leaving Oystr.
 *
 * Intentionally scoped to UK airports for now because Oystr's
 * journey planner covers TfL + UK National Rail. Foreign airports
 * would need per-country transit APIs that we don't integrate with.
 */

/**
 * A single ground-transport option.
 *
 * The `href` should take the user to the most relevant live board
 * inside Oystr — typically the departure point's rail / tube page
 * so they can time their own journey.
 */
export interface AirportTransportOption {
  /** Short label, e.g. "ELIZABETH LINE" or "GATWICK EXPRESS". */
  mode: string;
  /** The mode's Oystr category — drives the icon colour. */
  kind: "elizabeth" | "piccadilly" | "dlr" | "rail";
  /** Friendly departure-point label, e.g. "from Paddington". */
  from: string;
  /** Typical door-to-door journey time, human-readable. */
  duration: string;
  /** One-line extra context (direct, interchange, ticket notes). */
  note?: string;
  /** Where tapping the option takes the user. */
  href: string;
}

/**
 * IATA → list of ground-transport options, ordered fastest first.
 *
 * Covers the 5 main London airports. Other UK airports fall through
 * to the default list ("National Rail") which links to Rail search.
 */
export const AIRPORT_TRANSPORT: Record<string, AirportTransportOption[]> = {
  LHR: [
    {
      mode: "HEATHROW EXPRESS",
      kind: "rail",
      from: "FROM PADDINGTON",
      duration: "15 MIN",
      note: "NON-STOP. PREMIUM FARE.",
      href: "/rail/station/PAD",
    },
    {
      mode: "ELIZABETH LINE",
      kind: "elizabeth",
      from: "FROM PADDINGTON / BOND ST / LIV. ST",
      duration: "30 MIN",
      note: "FREQUENT, OYSTER / CONTACTLESS.",
      href: "/",
    },
    {
      mode: "PICCADILLY LINE",
      kind: "piccadilly",
      from: "FROM KING'S CROSS / PICCADILLY",
      duration: "55 MIN",
      note: "CHEAPEST. ALL STATIONS.",
      href: "/status",
    },
  ],
  LGW: [
    {
      mode: "GATWICK EXPRESS",
      kind: "rail",
      from: "FROM VICTORIA",
      duration: "30 MIN",
      note: "NON-STOP. EVERY 15 MIN.",
      href: "/rail/station/VIC",
    },
    {
      mode: "THAMESLINK",
      kind: "rail",
      from: "FROM ST PANCRAS / LONDON BRIDGE",
      duration: "45 MIN",
      note: "VIA BLACKFRIARS.",
      href: "/rail/station/STP",
    },
    {
      mode: "SOUTHERN",
      kind: "rail",
      from: "FROM VICTORIA",
      duration: "35 MIN",
      note: "CHEAPER THAN GATWICK EXPRESS.",
      href: "/rail/station/VIC",
    },
  ],
  LCY: [
    {
      mode: "DLR",
      kind: "dlr",
      from: "FROM BANK / CANARY WHARF",
      duration: "22 MIN",
      note: "VIA CANNING TOWN.",
      href: "/status",
    },
  ],
  STN: [
    {
      mode: "STANSTED EXPRESS",
      kind: "rail",
      from: "FROM LIVERPOOL ST",
      duration: "50 MIN",
      note: "EVERY 15 MIN.",
      href: "/rail/station/LST",
    },
    {
      mode: "CROSSCOUNTRY",
      kind: "rail",
      from: "FROM CAMBRIDGE / BIRMINGHAM",
      duration: "VARIES",
      note: "DIRECT REGIONAL SERVICES.",
      href: "/rail",
    },
  ],
  LTN: [
    {
      mode: "THAMESLINK + SHUTTLE",
      kind: "rail",
      from: "FROM ST PANCRAS / FARRINGDON",
      duration: "55 MIN",
      note: "CHANGE AT LUTON AIRPORT PKWY (DART SHUTTLE).",
      href: "/rail/station/STP",
    },
    {
      mode: "EAST MIDLANDS RAILWAY",
      kind: "rail",
      from: "FROM ST PANCRAS",
      duration: "25 MIN TO LTN PKWY",
      note: "FASTEST TO LUTON PKWY.",
      href: "/rail/station/STP",
    },
  ],
};

/**
 * Return the transport options for a given IATA, or null if we
 * don't have curated data for that airport (i.e. not a London
 * airport). Callers should suppress the panel entirely when this
 * returns null rather than showing an empty section.
 */
export function getTransportOptions(
  iata: string
): AirportTransportOption[] | null {
  const key = iata.trim().toUpperCase();
  return AIRPORT_TRANSPORT[key] ?? null;
}
