import { DEFAULT_MAX_DURATION_MINUTES, makeActivityRowId, type ActivityRowState } from "./ai-schedule-plan-input";

const STORAGE_KEY = "life_plan_ai_schedule_dialog_draft";
const DRAFT_VERSION = 1;

export function loadScheduleDialogDraft(): ActivityRowState[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return null;
    const o = JSON.parse(raw) as { v?: number; rows?: unknown };
    if (!o || o.v !== DRAFT_VERSION || !Array.isArray(o.rows)) return null;
    const out: ActivityRowState[] = [];
    for (const item of o.rows) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      out.push({
        id: typeof r.id === "string" && r.id ? r.id : makeActivityRowId(),
        title: typeof r.title === "string" ? r.title : "",
        maxRepetitions: typeof r.maxRepetitions === "string" ? r.maxRepetitions : "",
        maxDurationMinutes:
          typeof r.maxDurationMinutes === "string" && r.maxDurationMinutes !== ""
            ? r.maxDurationMinutes
            : String(DEFAULT_MAX_DURATION_MINUTES),
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function saveScheduleDialogDraft(rows: ActivityRowState[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: DRAFT_VERSION, rows }));
  } catch {
    // quota / private mode
  }
}
