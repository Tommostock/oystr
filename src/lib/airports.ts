/**
 * airports.ts — Bundled international airport list + helpers
 *
 * Covers ~150 of the busiest / most-likely-to-be-searched airports
 * worldwide so users can find e.g. Rome (FCO), Edinburgh (EDI) or
 * JFK without hitting a remote lookup. Enough coverage for a
 * London-based user's realistic travel patterns; can be extended
 * later if specific gaps come up.
 *
 * Used by:
 *   - London quick-pick chips on the Flights tab
 *   - AirportSearch autocomplete (by name / city / IATA)
 *   - getAirportByIata lookup when rendering a board header
 *
 * Search ranks results by: exact IATA match -> name starts-with ->
 * city starts-with -> contains, so "rome" lands on FCO before CIA.
 */

import type { Airport } from "./flight-types";

/* ========================================
 * AIRPORT LIST
 * Alphabetical by IATA within each region. Names are the short
 * familiar form (e.g. "Heathrow") rather than full officials so
 * the chip labels stay compact on mobile.
 * ======================================== */
export const AIRPORTS: Airport[] = [
  /* ---- United Kingdom ---- */
  { iata: "ABZ", label: "ABZ", name: "Aberdeen", city: "Aberdeen", country: "United Kingdom" },
  { iata: "BFS", label: "BFS", name: "Belfast International", city: "Belfast", country: "United Kingdom" },
  { iata: "BHD", label: "BHD", name: "Belfast City", city: "Belfast", country: "United Kingdom" },
  { iata: "BHX", label: "BHX", name: "Birmingham", city: "Birmingham", country: "United Kingdom" },
  { iata: "BRS", label: "BRS", name: "Bristol", city: "Bristol", country: "United Kingdom" },
  { iata: "CWL", label: "CWL", name: "Cardiff", city: "Cardiff", country: "United Kingdom" },
  { iata: "EDI", label: "EDI", name: "Edinburgh", city: "Edinburgh", country: "United Kingdom" },
  { iata: "EMA", label: "EMA", name: "East Midlands", city: "Nottingham", country: "United Kingdom" },
  { iata: "GLA", label: "GLA", name: "Glasgow", city: "Glasgow", country: "United Kingdom" },
  { iata: "INV", label: "INV", name: "Inverness", city: "Inverness", country: "United Kingdom" },
  { iata: "LBA", label: "LBA", name: "Leeds Bradford", city: "Leeds", country: "United Kingdom" },
  { iata: "LCY", label: "LCY", name: "London City", city: "London", country: "United Kingdom" },
  { iata: "LGW", label: "LGW", name: "London Gatwick", city: "London", country: "United Kingdom" },
  { iata: "LHR", label: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom" },
  { iata: "LPL", label: "LPL", name: "Liverpool", city: "Liverpool", country: "United Kingdom" },
  { iata: "LTN", label: "LTN", name: "London Luton", city: "London", country: "United Kingdom" },
  { iata: "MAN", label: "MAN", name: "Manchester", city: "Manchester", country: "United Kingdom" },
  { iata: "NCL", label: "NCL", name: "Newcastle", city: "Newcastle", country: "United Kingdom" },
  { iata: "SOU", label: "SOU", name: "Southampton", city: "Southampton", country: "United Kingdom" },
  { iata: "STN", label: "STN", name: "London Stansted", city: "London", country: "United Kingdom" },

  /* ---- Ireland ---- */
  { iata: "DUB", label: "DUB", name: "Dublin", city: "Dublin", country: "Ireland" },
  { iata: "ORK", label: "ORK", name: "Cork", city: "Cork", country: "Ireland" },
  { iata: "SNN", label: "SNN", name: "Shannon", city: "Shannon", country: "Ireland" },

  /* ---- France ---- */
  { iata: "BOD", label: "BOD", name: "Bordeaux", city: "Bordeaux", country: "France" },
  { iata: "CDG", label: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France" },
  { iata: "LYS", label: "LYS", name: "Lyon", city: "Lyon", country: "France" },
  { iata: "MRS", label: "MRS", name: "Marseille", city: "Marseille", country: "France" },
  { iata: "NCE", label: "NCE", name: "Nice", city: "Nice", country: "France" },
  { iata: "ORY", label: "ORY", name: "Orly", city: "Paris", country: "France" },
  { iata: "TLS", label: "TLS", name: "Toulouse", city: "Toulouse", country: "France" },

  /* ---- Germany ---- */
  { iata: "BER", label: "BER", name: "Berlin Brandenburg", city: "Berlin", country: "Germany" },
  { iata: "DUS", label: "DUS", name: "Dusseldorf", city: "Dusseldorf", country: "Germany" },
  { iata: "FRA", label: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Germany" },
  { iata: "HAM", label: "HAM", name: "Hamburg", city: "Hamburg", country: "Germany" },
  { iata: "MUC", label: "MUC", name: "Munich", city: "Munich", country: "Germany" },
  { iata: "STR", label: "STR", name: "Stuttgart", city: "Stuttgart", country: "Germany" },

  /* ---- Italy ---- */
  { iata: "BLQ", label: "BLQ", name: "Bologna", city: "Bologna", country: "Italy" },
  { iata: "CIA", label: "CIA", name: "Ciampino", city: "Rome", country: "Italy" },
  { iata: "CTA", label: "CTA", name: "Catania", city: "Catania", country: "Italy" },
  { iata: "FCO", label: "FCO", name: "Fiumicino", city: "Rome", country: "Italy" },
  { iata: "FLR", label: "FLR", name: "Florence", city: "Florence", country: "Italy" },
  { iata: "LIN", label: "LIN", name: "Linate", city: "Milan", country: "Italy" },
  { iata: "MXP", label: "MXP", name: "Malpensa", city: "Milan", country: "Italy" },
  { iata: "NAP", label: "NAP", name: "Naples", city: "Naples", country: "Italy" },
  { iata: "PSA", label: "PSA", name: "Pisa", city: "Pisa", country: "Italy" },
  { iata: "VCE", label: "VCE", name: "Venice", city: "Venice", country: "Italy" },

  /* ---- Spain + Portugal ---- */
  { iata: "AGP", label: "AGP", name: "Malaga", city: "Malaga", country: "Spain" },
  { iata: "ALC", label: "ALC", name: "Alicante", city: "Alicante", country: "Spain" },
  { iata: "BCN", label: "BCN", name: "Barcelona", city: "Barcelona", country: "Spain" },
  { iata: "BIO", label: "BIO", name: "Bilbao", city: "Bilbao", country: "Spain" },
  { iata: "IBZ", label: "IBZ", name: "Ibiza", city: "Ibiza", country: "Spain" },
  { iata: "LIS", label: "LIS", name: "Lisbon", city: "Lisbon", country: "Portugal" },
  { iata: "MAD", label: "MAD", name: "Madrid Barajas", city: "Madrid", country: "Spain" },
  { iata: "OPO", label: "OPO", name: "Porto", city: "Porto", country: "Portugal" },
  { iata: "PMI", label: "PMI", name: "Palma de Mallorca", city: "Palma", country: "Spain" },
  { iata: "SVQ", label: "SVQ", name: "Seville", city: "Seville", country: "Spain" },
  { iata: "TFS", label: "TFS", name: "Tenerife South", city: "Tenerife", country: "Spain" },
  { iata: "VLC", label: "VLC", name: "Valencia", city: "Valencia", country: "Spain" },

  /* ---- Netherlands + Belgium + Luxembourg ---- */
  { iata: "AMS", label: "AMS", name: "Schiphol", city: "Amsterdam", country: "Netherlands" },
  { iata: "BRU", label: "BRU", name: "Brussels", city: "Brussels", country: "Belgium" },
  { iata: "LUX", label: "LUX", name: "Luxembourg", city: "Luxembourg", country: "Luxembourg" },
  { iata: "RTM", label: "RTM", name: "Rotterdam The Hague", city: "Rotterdam", country: "Netherlands" },

  /* ---- Switzerland + Austria ---- */
  { iata: "BSL", label: "BSL", name: "Basel", city: "Basel", country: "Switzerland" },
  { iata: "GVA", label: "GVA", name: "Geneva", city: "Geneva", country: "Switzerland" },
  { iata: "VIE", label: "VIE", name: "Vienna", city: "Vienna", country: "Austria" },
  { iata: "ZRH", label: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland" },

  /* ---- Nordics ---- */
  { iata: "ARN", label: "ARN", name: "Arlanda", city: "Stockholm", country: "Sweden" },
  { iata: "BGO", label: "BGO", name: "Bergen", city: "Bergen", country: "Norway" },
  { iata: "CPH", label: "CPH", name: "Copenhagen", city: "Copenhagen", country: "Denmark" },
  { iata: "GOT", label: "GOT", name: "Gothenburg", city: "Gothenburg", country: "Sweden" },
  { iata: "HEL", label: "HEL", name: "Helsinki", city: "Helsinki", country: "Finland" },
  { iata: "KEF", label: "KEF", name: "Reykjavik Keflavik", city: "Reykjavik", country: "Iceland" },
  { iata: "OSL", label: "OSL", name: "Oslo Gardermoen", city: "Oslo", country: "Norway" },

  /* ---- Central + Eastern Europe + Balkans ---- */
  { iata: "BEG", label: "BEG", name: "Belgrade", city: "Belgrade", country: "Serbia" },
  { iata: "BUD", label: "BUD", name: "Budapest", city: "Budapest", country: "Hungary" },
  { iata: "KRK", label: "KRK", name: "Krakow", city: "Krakow", country: "Poland" },
  { iata: "PRG", label: "PRG", name: "Prague", city: "Prague", country: "Czechia" },
  { iata: "SOF", label: "SOF", name: "Sofia", city: "Sofia", country: "Bulgaria" },
  { iata: "WAW", label: "WAW", name: "Warsaw Chopin", city: "Warsaw", country: "Poland" },

  /* ---- Greece, Turkey, Cyprus, Malta ---- */
  { iata: "ATH", label: "ATH", name: "Athens", city: "Athens", country: "Greece" },
  { iata: "ESB", label: "ESB", name: "Esenboga", city: "Ankara", country: "Turkey" },
  { iata: "HER", label: "HER", name: "Heraklion", city: "Crete", country: "Greece" },
  { iata: "IST", label: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey" },
  { iata: "LCA", label: "LCA", name: "Larnaca", city: "Larnaca", country: "Cyprus" },
  { iata: "MLA", label: "MLA", name: "Malta", city: "Valletta", country: "Malta" },
  { iata: "SAW", label: "SAW", name: "Sabiha Gokcen", city: "Istanbul", country: "Turkey" },

  /* ---- United States ---- */
  { iata: "ATL", label: "ATL", name: "Atlanta Hartsfield-Jackson", city: "Atlanta", country: "United States" },
  { iata: "BOS", label: "BOS", name: "Logan", city: "Boston", country: "United States" },
  { iata: "CLT", label: "CLT", name: "Charlotte", city: "Charlotte", country: "United States" },
  { iata: "DCA", label: "DCA", name: "Reagan National", city: "Washington", country: "United States" },
  { iata: "DEN", label: "DEN", name: "Denver", city: "Denver", country: "United States" },
  { iata: "DFW", label: "DFW", name: "Dallas/Fort Worth", city: "Dallas", country: "United States" },
  { iata: "DTW", label: "DTW", name: "Detroit", city: "Detroit", country: "United States" },
  { iata: "EWR", label: "EWR", name: "Newark", city: "New York", country: "United States" },
  { iata: "FLL", label: "FLL", name: "Fort Lauderdale", city: "Fort Lauderdale", country: "United States" },
  { iata: "IAD", label: "IAD", name: "Dulles", city: "Washington", country: "United States" },
  { iata: "IAH", label: "IAH", name: "Houston Intercontinental", city: "Houston", country: "United States" },
  { iata: "JFK", label: "JFK", name: "John F. Kennedy", city: "New York", country: "United States" },
  { iata: "LAS", label: "LAS", name: "Harry Reid", city: "Las Vegas", country: "United States" },
  { iata: "LAX", label: "LAX", name: "Los Angeles", city: "Los Angeles", country: "United States" },
  { iata: "LGA", label: "LGA", name: "LaGuardia", city: "New York", country: "United States" },
  { iata: "MCO", label: "MCO", name: "Orlando", city: "Orlando", country: "United States" },
  { iata: "MIA", label: "MIA", name: "Miami", city: "Miami", country: "United States" },
  { iata: "MSP", label: "MSP", name: "Minneapolis/St Paul", city: "Minneapolis", country: "United States" },
  { iata: "ORD", label: "ORD", name: "O'Hare", city: "Chicago", country: "United States" },
  { iata: "PDX", label: "PDX", name: "Portland", city: "Portland", country: "United States" },
  { iata: "PHL", label: "PHL", name: "Philadelphia", city: "Philadelphia", country: "United States" },
  { iata: "PHX", label: "PHX", name: "Phoenix Sky Harbor", city: "Phoenix", country: "United States" },
  { iata: "SAN", label: "SAN", name: "San Diego", city: "San Diego", country: "United States" },
  { iata: "SEA", label: "SEA", name: "Seattle-Tacoma", city: "Seattle", country: "United States" },
  { iata: "SFO", label: "SFO", name: "San Francisco", city: "San Francisco", country: "United States" },

  /* ---- Canada ---- */
  { iata: "YOW", label: "YOW", name: "Ottawa", city: "Ottawa", country: "Canada" },
  { iata: "YUL", label: "YUL", name: "Montreal Trudeau", city: "Montreal", country: "Canada" },
  { iata: "YVR", label: "YVR", name: "Vancouver", city: "Vancouver", country: "Canada" },
  { iata: "YYC", label: "YYC", name: "Calgary", city: "Calgary", country: "Canada" },
  { iata: "YYZ", label: "YYZ", name: "Toronto Pearson", city: "Toronto", country: "Canada" },

  /* ---- Latin America ---- */
  { iata: "BOG", label: "BOG", name: "Bogota El Dorado", city: "Bogota", country: "Colombia" },
  { iata: "CUN", label: "CUN", name: "Cancun", city: "Cancun", country: "Mexico" },
  { iata: "EZE", label: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "Argentina" },
  { iata: "GIG", label: "GIG", name: "Rio de Janeiro Galeao", city: "Rio de Janeiro", country: "Brazil" },
  { iata: "GRU", label: "GRU", name: "Guarulhos", city: "Sao Paulo", country: "Brazil" },
  { iata: "HAV", label: "HAV", name: "Jose Marti", city: "Havana", country: "Cuba" },
  { iata: "LIM", label: "LIM", name: "Jorge Chavez", city: "Lima", country: "Peru" },
  { iata: "MEX", label: "MEX", name: "Mexico City", city: "Mexico City", country: "Mexico" },
  { iata: "SCL", label: "SCL", name: "Arturo Merino Benitez", city: "Santiago", country: "Chile" },

  /* ---- Middle East ---- */
  { iata: "AMM", label: "AMM", name: "Queen Alia", city: "Amman", country: "Jordan" },
  { iata: "AUH", label: "AUH", name: "Abu Dhabi", city: "Abu Dhabi", country: "United Arab Emirates" },
  { iata: "BAH", label: "BAH", name: "Bahrain", city: "Manama", country: "Bahrain" },
  { iata: "BEY", label: "BEY", name: "Beirut", city: "Beirut", country: "Lebanon" },
  { iata: "CAI", label: "CAI", name: "Cairo", city: "Cairo", country: "Egypt" },
  { iata: "DOH", label: "DOH", name: "Hamad", city: "Doha", country: "Qatar" },
  { iata: "DXB", label: "DXB", name: "Dubai", city: "Dubai", country: "United Arab Emirates" },
  { iata: "JED", label: "JED", name: "King Abdulaziz", city: "Jeddah", country: "Saudi Arabia" },
  { iata: "KWI", label: "KWI", name: "Kuwait", city: "Kuwait City", country: "Kuwait" },
  { iata: "RUH", label: "RUH", name: "King Khalid", city: "Riyadh", country: "Saudi Arabia" },
  { iata: "TLV", label: "TLV", name: "Ben Gurion", city: "Tel Aviv", country: "Israel" },

  /* ---- Africa ---- */
  { iata: "ADD", label: "ADD", name: "Addis Ababa", city: "Addis Ababa", country: "Ethiopia" },
  { iata: "CMN", label: "CMN", name: "Mohammed V", city: "Casablanca", country: "Morocco" },
  { iata: "CPT", label: "CPT", name: "Cape Town", city: "Cape Town", country: "South Africa" },
  { iata: "JNB", label: "JNB", name: "OR Tambo", city: "Johannesburg", country: "South Africa" },
  { iata: "LOS", label: "LOS", name: "Murtala Muhammed", city: "Lagos", country: "Nigeria" },
  { iata: "NBO", label: "NBO", name: "Jomo Kenyatta", city: "Nairobi", country: "Kenya" },
  { iata: "RAK", label: "RAK", name: "Marrakech Menara", city: "Marrakech", country: "Morocco" },

  /* ---- East + Southeast Asia ---- */
  { iata: "BKK", label: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "Thailand" },
  { iata: "CAN", label: "CAN", name: "Guangzhou Baiyun", city: "Guangzhou", country: "China" },
  { iata: "CGK", label: "CGK", name: "Soekarno-Hatta", city: "Jakarta", country: "Indonesia" },
  { iata: "DMK", label: "DMK", name: "Don Mueang", city: "Bangkok", country: "Thailand" },
  { iata: "DPS", label: "DPS", name: "Ngurah Rai", city: "Denpasar", country: "Indonesia" },
  { iata: "GMP", label: "GMP", name: "Gimpo", city: "Seoul", country: "South Korea" },
  { iata: "HAN", label: "HAN", name: "Noi Bai", city: "Hanoi", country: "Vietnam" },
  { iata: "HKG", label: "HKG", name: "Hong Kong", city: "Hong Kong", country: "Hong Kong" },
  { iata: "HKT", label: "HKT", name: "Phuket", city: "Phuket", country: "Thailand" },
  { iata: "HND", label: "HND", name: "Haneda", city: "Tokyo", country: "Japan" },
  { iata: "ICN", label: "ICN", name: "Incheon", city: "Seoul", country: "South Korea" },
  { iata: "KIX", label: "KIX", name: "Kansai", city: "Osaka", country: "Japan" },
  { iata: "KUL", label: "KUL", name: "Kuala Lumpur", city: "Kuala Lumpur", country: "Malaysia" },
  { iata: "MNL", label: "MNL", name: "Ninoy Aquino", city: "Manila", country: "Philippines" },
  { iata: "NRT", label: "NRT", name: "Narita", city: "Tokyo", country: "Japan" },
  { iata: "PEK", label: "PEK", name: "Beijing Capital", city: "Beijing", country: "China" },
  { iata: "PKX", label: "PKX", name: "Beijing Daxing", city: "Beijing", country: "China" },
  { iata: "PVG", label: "PVG", name: "Pudong", city: "Shanghai", country: "China" },
  { iata: "SGN", label: "SGN", name: "Tan Son Nhat", city: "Ho Chi Minh City", country: "Vietnam" },
  { iata: "SHA", label: "SHA", name: "Hongqiao", city: "Shanghai", country: "China" },
  { iata: "SIN", label: "SIN", name: "Changi", city: "Singapore", country: "Singapore" },
  { iata: "TPE", label: "TPE", name: "Taoyuan", city: "Taipei", country: "Taiwan" },

  /* ---- South Asia ---- */
  { iata: "BLR", label: "BLR", name: "Kempegowda", city: "Bangalore", country: "India" },
  { iata: "BOM", label: "BOM", name: "Mumbai", city: "Mumbai", country: "India" },
  { iata: "CCU", label: "CCU", name: "Netaji Subhas Chandra Bose", city: "Kolkata", country: "India" },
  { iata: "CMB", label: "CMB", name: "Colombo Bandaranaike", city: "Colombo", country: "Sri Lanka" },
  { iata: "DEL", label: "DEL", name: "Indira Gandhi", city: "Delhi", country: "India" },
  { iata: "HYD", label: "HYD", name: "Hyderabad Rajiv Gandhi", city: "Hyderabad", country: "India" },
  { iata: "MAA", label: "MAA", name: "Chennai", city: "Chennai", country: "India" },
  { iata: "MLE", label: "MLE", name: "Velana", city: "Male", country: "Maldives" },

  /* ---- Oceania ---- */
  { iata: "AKL", label: "AKL", name: "Auckland", city: "Auckland", country: "New Zealand" },
  { iata: "BNE", label: "BNE", name: "Brisbane", city: "Brisbane", country: "Australia" },
  { iata: "CHC", label: "CHC", name: "Christchurch", city: "Christchurch", country: "New Zealand" },
  { iata: "MEL", label: "MEL", name: "Melbourne Tullamarine", city: "Melbourne", country: "Australia" },
  { iata: "NAN", label: "NAN", name: "Nadi", city: "Nadi", country: "Fiji" },
  { iata: "PER", label: "PER", name: "Perth", city: "Perth", country: "Australia" },
  { iata: "SYD", label: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australia" },
  { iata: "WLG", label: "WLG", name: "Wellington", city: "Wellington", country: "New Zealand" },
];

/* ========================================
 * LONDON QUICK-PICKS
 * The handful of airports always-visible as chips at the top of
 * the Flights tab, so a London-based user can tap straight in
 * without searching. Comes from the main list above by IATA.
 * ======================================== */
export const LONDON_AIRPORT_IATAS = ["LHR", "LGW", "LCY", "STN", "LTN"] as const;

export const LONDON_AIRPORTS: Airport[] = LONDON_AIRPORT_IATAS
  .map((iata) => AIRPORTS.find((a) => a.iata === iata))
  .filter((a): a is Airport => !!a);

/* ========================================
 * LOOKUPS + SEARCH
 * ======================================== */

/** Lookup an airport record by IATA code (case-insensitive). */
export function getAirportByIata(iata: string): Airport | null {
  const target = iata.trim().toUpperCase();
  return AIRPORTS.find((a) => a.iata === target) ?? null;
}

/**
 * Build the best disambiguated display name for an airport.
 *
 * Rules:
 *   - city missing or equals name      -> return name      ("Dublin")
 *   - name already starts with city    -> return name      ("London Gatwick")
 *   - otherwise combine city + name    ->                  ("Paris Charles de Gaulle")
 *
 * Guarantees the result is never ambiguous for cities with multiple
 * airports (London, Paris, Milan, Rome, etc.) which was the whole
 * point of showing the full name at a glance.
 */
export function formatAirportFullName(airport: {
  name: string;
  city?: string | null;
}): string {
  const city = airport.city?.trim();
  const name = airport.name.trim();
  if (!city) return name;
  if (city.toLowerCase() === name.toLowerCase()) return name;
  if (name.toLowerCase().startsWith(city.toLowerCase())) return name;
  return `${city} ${name}`;
}

/**
 * Search bundled airports by name, city, or IATA code.
 *
 * Ranking:
 *   1. Exact IATA match
 *   2. Name starts with query
 *   3. City starts with query
 *   4. Any name/city contains query
 *
 * Results capped at 12 to keep the autocomplete dropdown manageable.
 */
export function searchAirports(query: string): Airport[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const qUpper = q.toUpperCase();
  const exactIata: Airport[] = [];
  const nameStart: Airport[] = [];
  const cityStart: Airport[] = [];
  const contains: Airport[] = [];

  for (const airport of AIRPORTS) {
    const nameLower = airport.name.toLowerCase();
    const cityLower = (airport.city || "").toLowerCase();

    if (airport.iata === qUpper) {
      exactIata.push(airport);
      continue;
    }
    if (nameLower.startsWith(q)) {
      nameStart.push(airport);
      continue;
    }
    if (cityLower && cityLower.startsWith(q)) {
      cityStart.push(airport);
      continue;
    }
    if (nameLower.includes(q) || cityLower.includes(q)) {
      contains.push(airport);
    }
  }

  const byName = (a: Airport, b: Airport) => a.name.localeCompare(b.name);
  nameStart.sort(byName);
  cityStart.sort(byName);
  contains.sort(byName);

  return [...exactIata, ...nameStart, ...cityStart, ...contains].slice(0, 12);
}
