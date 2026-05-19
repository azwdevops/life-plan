const STORAGE_KEY = "life-plan-countdown-timer";

export type CountdownStatus = "idle" | "running" | "paused";

export interface CountdownTimerState {
  inputMinutes: number;
  remainingMs: number;
  deadlineAt: number | null;
  status: CountdownStatus;
}

function safeParse(raw: string | null): CountdownTimerState | null {
  if (raw == null || raw === "") return null;
  try {
    const data = JSON.parse(raw) as CountdownTimerState;
    if (
      typeof data.inputMinutes !== "number" ||
      typeof data.remainingMs !== "number" ||
      (data.deadlineAt !== null && typeof data.deadlineAt !== "number") ||
      (data.status !== "idle" &&
        data.status !== "running" &&
        data.status !== "paused")
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function normalizeLoaded(state: CountdownTimerState): CountdownTimerState {
  if (state.status === "running" && state.deadlineAt != null) {
    const left = state.deadlineAt - Date.now();
    if (left <= 0) {
      return {
        ...state,
        status: "idle",
        remainingMs: 0,
        deadlineAt: null,
      };
    }
    return { ...state, remainingMs: left };
  }
  if (state.status === "paused" && state.remainingMs <= 0) {
    return { ...state, status: "idle", remainingMs: 0, deadlineAt: null };
  }
  return { ...state, deadlineAt: null };
}

export function loadCountdownState(): CountdownTimerState {
  const fallback: CountdownTimerState = {
    inputMinutes: 25,
    remainingMs: 0,
    deadlineAt: null,
    status: "idle",
  };
  if (typeof window === "undefined") return fallback;
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!parsed) return fallback;
  return normalizeLoaded(parsed);
}

export function saveCountdownState(state: CountdownTimerState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function remainingMsFromState(state: CountdownTimerState): number {
  if (state.status === "running" && state.deadlineAt != null) {
    return Math.max(0, state.deadlineAt - Date.now());
  }
  if (state.status === "paused") {
    return Math.max(0, state.remainingMs);
  }
  return 0;
}
