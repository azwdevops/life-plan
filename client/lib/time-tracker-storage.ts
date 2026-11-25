const SESSION_KEY = "life-plan-time-tracker-session";
const GOALS_KEY = "life-plan-time-tracker-goals";
const PROJECTS_KEY = "life-plan-time-tracker-projects";
const CATEGORIES_KEY = "life-plan-time-tracker-categories";
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
  /** The entry's own already-resolved FK, when replaying from a past entry - preferred over
   * re-deriving subjectId/name matches, since it's always correct even for legacy entries
   * whose frozen subjectId predates the DB-backed project/goal ids. */
  goalId?: number | null;
  projectId?: number | null;
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
  /** Groups this project for the "actual time spent" breakdown; distinct from `goalId`. */
  categoryId: string | null;
}

export interface TimeTrackerCategory {
  id: string;
  name: string;
}

export interface TimeTrackerSession {
  kind: TimeTrackerKind;
  subjectId: string;
  subjectName: string;
  /** Frozen from the project's category when the session started; never re-resolved while running. */
  categoryId: number | null;
  categoryName: string | null;
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
  /** Real backend ids, resolved server-side from subjectId; null if unresolved (e.g. a stale local-only reference). */
  goalId: number | null;
  projectId: number | null;
  /** The project's category frozen at tracking time - never re-resolved, so reclassifying the project later doesn't rewrite this entry's history. */
  categoryId: number | null;
  categoryName: string | null;
  parentGoalId: string | null;
  parentGoalName: string | null;
  description: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

/** Cycled by index for category/project breakdown rows and bars, so the same slot always gets the same color within one list. */
export const TIME_TRACKER_PALETTE = [
  "#1d4ed8",
  "#7e22ce",
  "#15803d",
  "#b45309",
  "#b91c1c",
  "#0e7490",
  "#be185d",
  "#4d7c0f",
  "#6d28d9",
  "#c2410c",
];

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

export function loadProjects(): TimeTrackerProject[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<TimeTrackerProject[]>(
    localStorage.getItem(PROJECTS_KEY),
    []
  );
  return Array.isArray(list) ? list : [];
}

export function loadCategories(): TimeTrackerCategory[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<TimeTrackerCategory[]>(
    localStorage.getItem(CATEGORIES_KEY),
    []
  );
  return Array.isArray(list) ? list : [];
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
        categoryId: typeof s.categoryId === "number" ? s.categoryId : null,
        categoryName: typeof s.categoryName === "string" ? s.categoryName : null,
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
