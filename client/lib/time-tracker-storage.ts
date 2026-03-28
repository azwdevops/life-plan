const SESSION_KEY = "life-plan-time-tracker-session";
const GOALS_KEY = "life-plan-time-tracker-goals";
const PROJECTS_KEY = "life-plan-time-tracker-projects";
/** Fired on `window` after a time entry is saved to the server (same-tab refresh). */
export const TIME_TRACKER_ENTRIES_UPDATED_EVENT =
  "life-plan-time-tracker-entries-updated";

/** `CustomEvent` name; detail: {@link TimeTrackerPresetProjectDetail} */
export const TIME_TRACKER_PRESET_PROJECT_EVENT =
  "life-plan-time-tracker-preset-project";

export type TimeTrackerPresetProjectDetail = {
  subjectId: string;
  subjectName: string;
  /** When true, header saves any active session, then starts this subject immediately. */
  autoStart?: boolean;
  /** Notes field; copied into the running session and idle form when presetting. */
  description?: string;
  /** From a past time entry when replaying; used if the project row is missing from storage. */
  parentGoalId?: string | null;
  parentGoalName?: string | null;
};

/** Same shape as {@link TimeTrackerPresetProjectDetail}; used for goal preset events. */
export type TimeTrackerPresetGoalDetail = TimeTrackerPresetProjectDetail;

/** `CustomEvent` name; detail: {@link TimeTrackerPresetGoalDetail} */
export const TIME_TRACKER_PRESET_GOAL_EVENT =
  "life-plan-time-tracker-preset-goal";

export type TimeTrackerKind = "goal" | "project";

export interface TimeTrackerGoal {
  id: string;
  name: string;
  /** ISO date string (yyyy-mm-dd) or null */
  endDate: string | null;
}

export interface TimeTrackerProject {
  id: string;
  name: string;
  goalId: string | null;
}

export interface TimeTrackerSession {
  kind: TimeTrackerKind;
  subjectId: string;
  subjectName: string;
  parentGoalId: string | null;
  parentGoalName: string | null;
  description: string;
  startedAt: string;
  /** Wall-clock ms spent in paused state (current pause not included until resume). */
  accumulatedPauseMs: number;
  /** ISO timestamp when pause began; null while timer is running. */
  pauseStartedAt: string | null;
}

export interface TimeTrackerEntry {
  id: string;
  kind: TimeTrackerKind;
  subjectId: string;
  subjectName: string;
  parentGoalId: string | null;
  parentGoalName: string | null;
  description: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeGoal(raw: unknown): TimeTrackerGoal | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  return {
    id: o.id,
    name: o.name,
    endDate:
      typeof o.endDate === "string" && o.endDate !== "" ? o.endDate : null,
  };
}

export function loadGoals(): TimeTrackerGoal[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<unknown[]>(localStorage.getItem(GOALS_KEY), []);
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => normalizeGoal(x))
    .filter((g): g is TimeTrackerGoal => g != null);
}

export function saveGoals(goals: TimeTrackerGoal[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function loadProjects(): TimeTrackerProject[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<TimeTrackerProject[]>(
    localStorage.getItem(PROJECTS_KEY),
    []
  );
  return Array.isArray(list) ? list : [];
}

export function saveProjects(projects: TimeTrackerProject[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadSession(): TimeTrackerSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw == null || raw === "") return null;
  try {
    const s = JSON.parse(raw) as TimeTrackerSession;
    if (
      s &&
      (s.kind === "goal" || s.kind === "project") &&
      typeof s.subjectId === "string" &&
      typeof s.subjectName === "string" &&
      typeof s.startedAt === "string"
    ) {
      const accumulatedPauseMs =
        typeof s.accumulatedPauseMs === "number" && s.accumulatedPauseMs >= 0
          ? s.accumulatedPauseMs
          : 0;
      const pauseStartedAt =
        typeof s.pauseStartedAt === "string" && s.pauseStartedAt !== ""
          ? s.pauseStartedAt
          : null;
      return {
        ...s,
        parentGoalId: s.parentGoalId ?? null,
        parentGoalName: s.parentGoalName ?? null,
        description: typeof s.description === "string" ? s.description : "",
        accumulatedPauseMs,
        pauseStartedAt,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function saveSession(session: TimeTrackerSession | null): void {
  if (typeof window === "undefined") return;
  if (session == null) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export type AppendTimeEntryServerHook = (
  entry: TimeTrackerEntry
) => void | Promise<void>;

let appendTimeEntryServerHook: AppendTimeEntryServerHook | null = null;

export function registerAppendTimeEntryServerHook(
  fn: AppendTimeEntryServerHook | null
): void {
  appendTimeEntryServerHook = fn;
}

/** Persists one completed session to the server (via registered hook). */
export async function appendTimeEntry(
  entry: TimeTrackerEntry
): Promise<void> {
  const h = appendTimeEntryServerHook;
  if (!h) {
    throw new Error("Time entry sync is not configured");
  }
  await h(entry);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TIME_TRACKER_ENTRIES_UPDATED_EVENT));
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function elapsedMs(session: TimeTrackerSession): number {
  const start = new Date(session.startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  const accumulated = session.accumulatedPauseMs ?? 0;
  if (session.pauseStartedAt) {
    const pauseAt = new Date(session.pauseStartedAt).getTime();
    if (Number.isNaN(pauseAt)) {
      return Math.max(0, Date.now() - start - accumulated);
    }
    return Math.max(0, pauseAt - start - accumulated);
  }
  return Math.max(0, Date.now() - start - accumulated);
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDurationMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
