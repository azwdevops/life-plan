const STORAGE_KEY = "life_plan_ai_schedule_focus_blur";

/** Dispatched on same-tab writes so useSyncExternalStore subscribers update. */
const CHANGE_EVENT = "life-plan-ai-schedule-focus-blur";

/** Default: blur non-current blocks (focus mode on). */
export function loadFocusBlurOthers(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function saveFocusBlurOthers(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

/** For useSyncExternalStore: same-tab updates + other tabs via storage. */
export function subscribeFocusBlurOthers(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => onStoreChange();
  window.addEventListener(CHANGE_EVENT, run);
  window.addEventListener("storage", run);
  return () => {
    window.removeEventListener(CHANGE_EVENT, run);
    window.removeEventListener("storage", run);
  };
}
