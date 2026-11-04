"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const FALLBACK_POLL_MS = 60_000;

/**
 * Keeps the page current without polling the database: listens on /api/live and re-renders
 * when the server says something changed. If the stream can't stay open (a proxy that kills
 * it), falls back to a slow refresh while the tab is visible. Re-syncs when the tab comes back.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let failures = 0;

    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const startPolling = () => {
      poll ??= setInterval(refresh, FALLBACK_POLL_MS);
    };
    const open = () => {
      source = new EventSource("/api/live");
      source.addEventListener("change", refresh);
      source.onopen = () => {
        failures = 0;
        if (poll) clearInterval(poll);
        poll = null;
      };
      source.onerror = () => {
        failures++;
        if (failures >= 3) startPolling();
      };
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    open();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      source?.close();
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
