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
  /* Subscribe to both same-tab updates (custom event) and
     cross-tab updates (browser storage event). */
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
 * Pass `null` to remove the key.
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
  notify(key);
}

/**
 * Hook for a JSON-serialised localStorage value.
 *
 * - `key` is the storage key.
 * - `defaultValue` is returned during SSR and when the key is unset
 *   or can't be parsed. Must be serialisable by JSON.stringify.
 * - Returned setter accepts either a value or a function receiving
 *   the current value (matches React's useState API).
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (next: T | ((prev: T) => T)) => void] {
  /*
   * useSyncExternalStore handles subscription + SSR safety. The
   * client snapshot is the parsed JSON; the server snapshot is the
   * defaultValue so the first render matches between server and
   * client (avoids hydration errors).
   *
   * We wrap the client snapshot in a try/catch since localStorage
   * may be disabled or contain malformed JSON.
   */
  const value = useSyncExternalStore<T>(
    (listener) => subscribe(key, listener),
    () => {
      const raw = readRaw(key);
      if (raw === null) return defaultValue;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return defaultValue;
      }
    },
    () => defaultValue
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = (() => {
        const raw = readRaw(key);
        if (raw === null) return defaultValue;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return defaultValue;
        }
      })();
      const resolved =
        typeof next === "function"
          ? (next as (p: T) => T)(prev)
          : next;
      writeRaw(key, JSON.stringify(resolved));
    },
    [key, defaultValue]
  );

  return [value, setValue];
}
