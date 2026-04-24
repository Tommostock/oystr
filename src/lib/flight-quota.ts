/**
 * flight-quota.ts — Local client-side tracker for AeroDataBox requests
 *
 * The free tier is 150 requests/month. There's no API for us to ask
 * "how many have I used?", so we keep our own best-effort counter in
 * localStorage. It's not authoritative (server-side cache may absorb
 * a request; different devices / browsers don't share a counter) but
 * it's close enough to power "approaching limit" / "exhausted" UI
 * states that keep the user from being surprised by a dead API.
 *
 * Fields:
 *   count       — number of successful fetches this month
 *   monthKey    — YYYY-MM, used to auto-reset at month boundaries
 *
 * The counter is incremented on every flight-detail / departures /
 * arrivals client-side fetch (see the three hooks). It doesn't
 * track server-cache hits because we can't see those from the
 * client — so the actual API spend is equal to or less than what
 * this counter shows.
 */

const STORAGE_KEY = "oystr-flight-quota";
/** Max requests/month on the AeroDataBox free tier. */
export const QUOTA_LIMIT = 150;
/** Warn the user when they approach this threshold. */
export const QUOTA_WARN = 130;
/** Stop making new requests when this many have been counted. */
export const QUOTA_HARD_STOP = 148;

interface QuotaState {
  count: number;
  monthKey: string;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readRaw(): QuotaState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.count !== "number" ||
      typeof parsed?.monthKey !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(state: QuotaState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage may be full or unavailable — silently ignore */
  }
}

/**
 * Read the current counter, auto-resetting if we've rolled into a
 * new month since the last write.
 */
export function getQuota(): QuotaState {
  const state = readRaw();
  const now = currentMonthKey();
  if (!state || state.monthKey !== now) {
    const fresh: QuotaState = { count: 0, monthKey: now };
    writeRaw(fresh);
    return fresh;
  }
  return state;
}

/**
 * Called by each flight hook on a successful fetch. Silently caps
 * at QUOTA_LIMIT + a buffer so a runaway caller can't inflate the
 * number beyond what localStorage can reasonably hold.
 */
export function recordFlightRequest(): void {
  const state = getQuota();
  if (state.count >= QUOTA_LIMIT + 50) return;
  writeRaw({ ...state, count: state.count + 1 });
}

/**
 * True when we've hit the hard-stop threshold. Hooks should return
 * early with a synthetic "quota exhausted" error rather than fire
 * another fetch (which would count anyway and waste a request).
 */
export function isQuotaExhausted(): boolean {
  const state = getQuota();
  return state.count >= QUOTA_HARD_STOP;
}

/** Convenience accessor used by UI for the warning banner. */
export function isQuotaWarning(): boolean {
  const state = getQuota();
  return state.count >= QUOTA_WARN;
}
