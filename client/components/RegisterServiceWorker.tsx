"use client";

import { useEffect } from "react";

/**
 * Registers the service worker needed for PWA installability. Renders
 * nothing — just a mount-time side effect, included once in the root layout.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration can fail on insecure origins (e.g. a plain-http LAN IP
      // in dev) — that's expected there, so the install button just won't
      // appear rather than throwing.
    });
  }, []);

  return null;
}
