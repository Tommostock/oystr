/**
 * useLocalStorage.ts — SSR-safe localStorage-backed state
 *
 * A thin wrapper around React 18's useSyncExternalStore that:
 *   1. Reads from localStorage on every render (single source of truth)
 *   2. Subscribes to the "storage" event + a custom in-process event
 *      so changes made in THIS tab update all components that use
 *      the same key (regular storage events only fire cross-tab)
 *   3. Returns a `defaultValue` during server-side render so hydration
 *      never mismatches — the real value flashes in on first client
 *      render, which is correct behaviour for "this tab's choice"
 *
 * This pattern replaces the older useState+useEffect-reads-localStorage
 * approach that causes React's react-hooks/set-state-in-effect lint
 * rule to fire (cascading renders on mount).
 *
 * ---- CRITICAL CORRECTNESS NOTE ----
 *
 * useSyncExternalStore requires getSnapshot() to return the SAME
 * reference as long as the underlying value hasn't changed — if
 * snapshot returns a newly-parsed object each call, React detects
 * "change" every tick and re-renders forever until the page crashes.
 *
 * We cache parsed values in a module-level map keyed by the storage
 * key, comparing the raw string against the previous raw string.
 * Same raw string → return the same parsed reference. Raw string
 * changed (or cleared) → parse fresh, update cache, return new
 * reference. This satisfies useSyncExternalStore's invariant.
 *
 * Usage:
 *   const [value, setValue] = useLocalStorage("oystr-foo", defaultValue);
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Subscribers are tracked per-key so that setting a value in one
 * component re-renders every other component reading the same key
 * in the same tab. The browser's built-in "storage" event only
 * covers cross-tab changes, not within-tab.
 */
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function subscribe(key: string, listener: Listener): () => void {
  let keyListeners = listeners.get(key);
  if (!keyListeners) {
    keyListeners = new Set();
    listeners.set(key, keyListeners);
  }
  keyListeners.add(listener);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === key) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    keyListeners!.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

/** Notify all same-tab subscribers for a key. */
function notify(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const l of set) l();
}

/**
 * Read the current raw string value from localStorage. Returns null
 * if the key is unset or on any error.
 */
function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a value to localStorage and notify subscribers.
 * Pass `null` to remove the key. Invalidates the snapshot cache
 * so the next getSnapshot() re-parses.
 */
function writeRaw(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    /* ignore quota / private-mode errors */
  }
  /* Invalidate the cache for this key so subscribers parse fresh. */
  snapshotCache.delete(key);
  notify(key);
}

/*
 * Snapshot cache — module-level Map keyed by storage key. Holds the
 * last-seen raw string + its parsed object so that getSnapshot() can
 * return the SAME reference for reads that haven't changed. Without
 * this cache, useSyncExternalStore would see a new parsed object
 * every tick and trigger infinite re-renders.
 */
const snapshotCache = new Map<
  string,
  { raw: string | null; parsed: unknown }
>();

/**
 * Read-and-memoise the parsed value for a key. Returns the cached
 * reference when the raw localStorage string is unchanged; only
 * re-parses when the underlying string actually differs.
 */
function getCachedSnapshot<T>(key: string, defaultValue: T): T {
  const raw = readRaw(key);
  const cached = snapshotCache.get(key);

  /*
   * Fast path: raw string hasn't changed since last parse — return
   * the same object identity. This is what keeps useSyncExternalStore
   * stable between render passes.
   */
  if (cached && cached.raw === raw) {
    return cached.parsed as T;
  }

  /* Slow path: first read OR the raw value changed. Parse fresh. */
  let parsed: T;
  if (raw === null) {
    parsed = defaultValue;
  } else {
    try {
      parsed = JSON.parse(raw) as T;
    } catch {
      parsed = defaultValue;
    }
  }
  snapshotCache.set(key, { raw, parsed });
  return parsed;
}

/**
 * Hook for a JSON-serialised localStorage value.
 *
 * - `key` is the storage key.
 * - `defaultValue` is returned during SSR and when the key is unset
 *   or can't be parsed. Must be serialisable by JSON.stringify, and
 *   ideally a module-level stable reference (so React's memoisation
 *   plays nicely).
 * - Returned setter accepts either a value or a function receiving
 *   the current value (matches React's useState API).
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore<T>(
    (listener) => subscribe(key, listener),
    () => getCachedSnapshot(key, defaultValue),
    /* Server snapshot — default during SSR. Must be stable. */
    () => defaultValue
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = getCachedSnapshot(key, defaultValue);
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeRaw(key, JSON.stringify(resolved));
    },
    [key, defaultValue]
  );

  return [value, setValue];
}
