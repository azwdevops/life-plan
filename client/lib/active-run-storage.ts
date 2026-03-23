/**
 * In-progress live run: mirrors server row created at Start. Survives refresh.
 */

const STORAGE_KEY = "life_plan_active_run";
const SCHEMA_V = 2 as const;
export const MAX_RUN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PersistedActiveRun = {
  v: typeof SCHEMA_V;
  userId: number;
  /** Server `run_sessions.id` (draft row until Stop completes it). */
  serverSessionId: number;
  startedAtMs: number;
  speedKmh: number;
  tickIntervalSec: number;
  accumulatedPauseMs: number;
  pauseStartedAtMs: number | null;
};

export function peekActiveRun(): PersistedActiveRun | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    if (o.v !== SCHEMA_V) return null;
    return p as PersistedActiveRun;
  } catch {
    return null;
  }
}

function isValidPersisted(p: PersistedActiveRun): boolean {
  if (typeof p.userId !== "number" || !Number.isInteger(p.userId)) return false;
  if (
    typeof p.serverSessionId !== "number" ||
    !Number.isInteger(p.serverSessionId) ||
    p.serverSessionId < 1
  )
    return false;
  if (typeof p.startedAtMs !== "number" || !Number.isFinite(p.startedAtMs))
    return false;
  if (typeof p.speedKmh !== "number" || !Number.isFinite(p.speedKmh))
    return false;
  if (p.speedKmh <= 0 || p.speedKmh > 80) return false;
  if (
    typeof p.tickIntervalSec !== "number" ||
    !Number.isInteger(p.tickIntervalSec)
  )
    return false;
  if (p.tickIntervalSec < 1 || p.tickIntervalSec > 300) return false;
  if (
    typeof p.accumulatedPauseMs !== "number" ||
    !Number.isFinite(p.accumulatedPauseMs)
  )
    return false;
  if (p.accumulatedPauseMs < 0 || p.accumulatedPauseMs > MAX_RUN_AGE_MS)
    return false;
  if (p.pauseStartedAtMs != null) {
    if (
      typeof p.pauseStartedAtMs !== "number" ||
      !Number.isFinite(p.pauseStartedAtMs)
    )
      return false;
  }
  return true;
}

function normalizePauseFields(
  p: Record<string, unknown>
): Pick<PersistedActiveRun, "accumulatedPauseMs" | "pauseStartedAtMs"> {
  const acc = p.accumulatedPauseMs;
  const accumulatedPauseMs =
    typeof acc === "number" && Number.isFinite(acc) && acc >= 0
      ? Math.min(Math.floor(acc), MAX_RUN_AGE_MS)
      : 0;
  const ps = p.pauseStartedAtMs;
  let pauseStartedAtMs: number | null = null;
  if (ps === null) pauseStartedAtMs = null;
  else if (typeof ps === "number" && Number.isFinite(ps)) pauseStartedAtMs = ps;
  return { accumulatedPauseMs, pauseStartedAtMs };
}

export function clearActiveRun(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function readActiveRun(currentUserId: number): PersistedActiveRun | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  let p: PersistedActiveRun;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      clearActiveRun();
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (o.v !== SCHEMA_V) {
      clearActiveRun();
      return null;
    }
    p = parsed as PersistedActiveRun;
  } catch {
    clearActiveRun();
    return null;
  }

  const norm = normalizePauseFields(p as unknown as Record<string, unknown>);
  const merged: PersistedActiveRun = {
    ...p,
    accumulatedPauseMs: norm.accumulatedPauseMs,
    pauseStartedAtMs: norm.pauseStartedAtMs,
  };

  if (!isValidPersisted(merged)) {
    clearActiveRun();
    return null;
  }

  if (merged.userId !== currentUserId) {
    return null;
  }

  const age = Date.now() - merged.startedAtMs;
  if (age < 0 || age > MAX_RUN_AGE_MS) {
    clearActiveRun();
    return null;
  }

  return merged;
}

export function persistActiveRun(input: {
  userId: number;
  serverSessionId: number;
  startedAtMs: number;
  speedKmh: number;
  tickIntervalSec: number;
}): PersistedActiveRun {
  const payload: PersistedActiveRun = {
    v: SCHEMA_V,
    userId: input.userId,
    serverSessionId: input.serverSessionId,
    startedAtMs: input.startedAtMs,
    speedKmh: input.speedKmh,
    tickIntervalSec: input.tickIntervalSec,
    accumulatedPauseMs: 0,
    pauseStartedAtMs: null,
  };
  if (typeof window === "undefined") return payload;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function updateActiveRunPauseFields(
  accumulatedPauseMs: number,
  pauseStartedAtMs: number | null
): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const p = JSON.parse(raw) as PersistedActiveRun;
    if (p?.v !== SCHEMA_V || typeof p.serverSessionId !== "number") return;
    const next: PersistedActiveRun = {
      ...p,
      accumulatedPauseMs: Math.max(
        0,
        Math.min(Math.floor(accumulatedPauseMs), MAX_RUN_AGE_MS)
      ),
      pauseStartedAtMs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
