"use client";

/*
  Data hooks. useResource keeps a small in-memory cache keyed by path, so going
  back to a page shows what was there at once and refreshes underneath (no
  spinner flash). Polling pauses while the tab is hidden.
*/

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, errorMessage } from "@/settled/lib/api";

interface Entry {
  data?: unknown;
  error?: string;
  at: number;
  inflight?: Promise<unknown>;
}

const cache = new Map<string, Entry>();
const subs = new Map<string, Set<() => void>>();

function emit(key: string) {
  subs.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void) {
  let s = subs.get(key);
  if (!s) subs.set(key, (s = new Set()));
  s.add(fn);
  return () => {
    s!.delete(fn);
  };
}

async function load(key: string): Promise<unknown> {
  const e = cache.get(key) ?? { at: 0 };
  if (e.inflight) return e.inflight;
  const p = api
    .get<unknown>(key)
    .then((data) => {
      cache.set(key, { data, at: Date.now() });
      emit(key);
      return data;
    })
    .catch((err) => {
      const prev = cache.get(key);
      cache.set(key, { data: prev?.data, error: errorMessage(err), at: Date.now() });
      emit(key);
      throw err;
    });
  cache.set(key, { ...e, inflight: p });
  return p;
}

/** Reload every cached path that starts with one of these prefixes (after a write). */
export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) {
      if (subs.get(key)?.size) load(key).catch(() => null);
      else cache.delete(key);
    }
  }
}

/** Put a value straight into the cache (optimistic updates). */
export function setCached<T>(key: string, update: (prev: T | undefined) => T) {
  const e = cache.get(key);
  cache.set(key, { ...(e ?? { at: Date.now() }), data: update(e?.data as T | undefined), inflight: undefined });
  emit(key);
}

export interface Resource<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useResource<T>(key: string | null, opts: { poll?: number } = {}): Resource<T> {
  const snap = useSyncExternalStore(
    useCallback((fn) => (key ? subscribe(key, fn) : () => {}), [key]),
    () => (key ? cache.get(key) : undefined),
    () => undefined,
  );

  useEffect(() => {
    if (!key) return;
    const e = cache.get(key);
    if (!e || Date.now() - e.at > 2000) load(key).catch(() => null);
  }, [key]);

  useEffect(() => {
    if (!key || !opts.poll) return;
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (t) return;
      t = setInterval(() => load(key).catch(() => null), opts.poll);
    };
    const stop = () => {
      if (t) clearInterval(t);
      t = null;
    };
    const vis = () => {
      if (document.hidden) stop();
      else {
        load(key).catch(() => null);
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [key, opts.poll]);

  const reload = useCallback(async () => {
    if (key) await load(key).catch(() => null);
  }, [key]);

  return {
    data: snap?.data as T | undefined,
    error: snap?.data === undefined ? snap?.error : undefined,
    loading: !!key && snap?.data === undefined && !snap?.error,
    reload,
  };
}

/** Runs an async action with a busy flag. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const ref = useRef(fn);
  ref.current = fn;
  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setBusy(true);
    try {
      return await ref.current(...args);
    } finally {
      setBusy(false);
    }
  }, []);
  return [run, busy] as const;
}

export function useDebounced<T>(value: T, ms = 220): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Remembers the previous value of something across renders. */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  const prev = ref.current;
  useEffect(() => {
    ref.current = value;
  });
  return prev;
}

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}
