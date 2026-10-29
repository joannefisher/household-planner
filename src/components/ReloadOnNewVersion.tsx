"use client";

import { useEffect } from "react";

// After a new deploy, a page that was already open (like the kitchen iPad) asks for code files
// from the old version, which no longer exist. When that happens, reload once to pick up the new version.
const KEY = "planner.reloadedAt";
const STALE = /Failed to load chunk|Loading chunk|ChunkLoadError|Importing a module script failed|error loading dynamically imported module/i;

export function ReloadOnNewVersion() {
  useEffect(() => {
    const reload = (message: string) => {
      if (!STALE.test(message)) return;
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(KEY) ?? 0);
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {}
      if (Date.now() - last > 30_000) window.location.reload(); // never loop
    };
    const onError = (e: ErrorEvent) => reload(String(e.message ?? e.error?.message ?? ""));
    const onRejection = (e: PromiseRejectionEvent) => reload(String(e.reason?.message ?? e.reason ?? ""));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
