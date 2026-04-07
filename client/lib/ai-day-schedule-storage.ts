import type { ScheduleBlockApi } from "./api/ai-schedule";
import { getEatDayKey } from "./eat-timezone";

const STORAGE_KEY = "life_plan_ai_day_schedule_v1";

export interface StoredAiDaySchedule {
  /** Calendar date YYYY-MM-DD in EAT when this schedule was generated */
  dayKey: string;
  generatedAt: string;
  tasksInput: string;
  blocks: ScheduleBlockApi[];
  tips?: string | null;
}

/** Same calendar day as `getEatDayKey()` (EAT). */
export function getTodayKey(): string {
  return getEatDayKey();
}

export function loadStoredSchedule(): StoredAiDaySchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAiDaySchedule;
    if (!parsed || !Array.isArray(parsed.blocks) || typeof parsed.dayKey !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSchedule(data: Omit<StoredAiDaySchedule, "dayKey"> & { dayKey?: string }): void {
  if (typeof window === "undefined") return;
  const dayKey = data.dayKey ?? getTodayKey();
  const payload: StoredAiDaySchedule = {
    dayKey,
    generatedAt: data.generatedAt,
    tasksInput: data.tasksInput,
    blocks: data.blocks,
    tips: data.tips,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearSchedule(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isScheduleForToday(stored: StoredAiDaySchedule | null): boolean {
  if (!stored) return false;
  return stored.dayKey === getTodayKey();
}
