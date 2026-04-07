/** Serialized in `StoredAiDaySchedule.tasksInput` (JSON) or legacy plain lines. */

export const PLAN_INPUT_VERSION = 3;

/** Default max length (minutes) for a single block when not specified. */
export const DEFAULT_MAX_DURATION_MINUTES = 40;
const MIN_DURATION = 5;
const MAX_DURATION = 720;

export interface PlanActivity {
  title: string;
  /** null = unlimited max separate blocks */
  max_repetitions: number | null;
  /** Max length of any single block (minutes). Default 40. */
  max_duration_minutes: number;
}

export interface ActivityRowState {
  id: string;
  title: string;
  /** empty string in UI = unlimited blocks */
  maxRepetitions: string;
  /** minutes; empty defaults to DEFAULT_MAX_DURATION_MINUTES in planFromRows */
  maxDurationMinutes: string;
}

export function makeActivityRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyActivityRow(): ActivityRowState {
  return {
    id: makeActivityRowId(),
    title: "",
    maxRepetitions: "",
    maxDurationMinutes: String(DEFAULT_MAX_DURATION_MINUTES),
  };
}

function clampDurationMinutes(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_MAX_DURATION_MINUTES;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.floor(n)));
}

export function serializePlanInput(activities: PlanActivity[]): string {
  return JSON.stringify({ v: PLAN_INPUT_VERSION, activities });
}

/** Legacy: one activity per non-empty line, unlimited reps, default duration. */
function fromLegacyLines(text: string): PlanActivity[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title) => ({
      title,
      max_repetitions: null as number | null,
      max_duration_minutes: DEFAULT_MAX_DURATION_MINUTES,
    }));
}

export function parsePlanInput(raw: string): PlanActivity[] {
  const t = raw.trim();
  if (!t) return [];
  try {
    const o = JSON.parse(t) as { v?: number; activities?: unknown };
    if (o && Array.isArray(o.activities)) {
      const out: PlanActivity[] = [];
      for (const item of o.activities) {
        if (!item || typeof item !== "object") continue;
        const rec = item as {
          title?: unknown;
          max_repetitions?: unknown;
          max_duration_minutes?: unknown;
        };
        const title = typeof rec.title === "string" ? rec.title.trim() : "";
        if (!title) continue;
        let max: number | null = null;
        if (rec.max_repetitions != null && rec.max_repetitions !== "") {
          const n = Math.floor(Number(rec.max_repetitions));
          if (!Number.isNaN(n) && n >= 1) max = n;
        }
        let dur = DEFAULT_MAX_DURATION_MINUTES;
        if (rec.max_duration_minutes != null && rec.max_duration_minutes !== "") {
          const d = Math.floor(Number(rec.max_duration_minutes));
          if (!Number.isNaN(d)) dur = clampDurationMinutes(d);
        }
        out.push({ title, max_repetitions: max, max_duration_minutes: dur });
      }
      return out;
    }
  } catch {
    return fromLegacyLines(t);
  }
  return fromLegacyLines(t);
}

export function rowsFromPlan(activities: PlanActivity[]): ActivityRowState[] {
  if (!activities.length) return [emptyActivityRow()];
  return activities.map((a) => ({
    id: makeActivityRowId(),
    title: a.title,
    maxRepetitions: a.max_repetitions == null ? "" : String(a.max_repetitions),
    maxDurationMinutes: String(a.max_duration_minutes ?? DEFAULT_MAX_DURATION_MINUTES),
  }));
}

export function planFromRows(rows: ActivityRowState[]): PlanActivity[] {
  const out: PlanActivity[] = [];
  for (const r of rows) {
    const title = String(r.title ?? "").trim();
    if (!title) continue;
    const raw = String(r.maxRepetitions ?? "").trim();
    let max_repetitions: number | null = null;
    if (raw !== "") {
      const n = Math.max(1, Math.floor(Number(raw)));
      if (!Number.isNaN(n)) max_repetitions = n;
    }
    const rawDur = String(r.maxDurationMinutes ?? "").trim();
    const max_duration_minutes =
      rawDur === ""
        ? DEFAULT_MAX_DURATION_MINUTES
        : clampDurationMinutes(Number(rawDur));
    out.push({ title, max_repetitions, max_duration_minutes });
  }
  return out;
}
