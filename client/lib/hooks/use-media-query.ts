"use client";

import { useEffect, useState } from "react";

/**
 * Subscribes to matchMedia. Returns null until mounted (SSR / first paint).
 * Use strict equality: `=== true` / `=== false` to branch after hydration.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [query]);

  return matches;
}
