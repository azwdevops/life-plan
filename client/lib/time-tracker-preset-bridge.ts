import {
  TIME_TRACKER_PRESET_GOAL_EVENT,
  TIME_TRACKER_PRESET_PROJECT_EVENT,
  type TimeTrackerKind,
  type TimeTrackerPresetProjectDetail,
} from "@/lib/time-tracker-storage";

/** Preset payload including kind so the header can be notified without a separate CustomEvent per type. */
export type TrackerPresetWithKind = TimeTrackerPresetProjectDetail & {
  kind: TimeTrackerKind;
};

let handler: ((p: TrackerPresetWithKind) => void) | null = null;

export function registerTrackerPresetHandler(
  fn: (p: TrackerPresetWithKind) => void
) {
  handler = fn;
  return () => {
    handler = null;
  };
}

/** Prefer this from in-app UI: calls the mounted header directly when available. */
export function emitTrackerPreset(p: TrackerPresetWithKind) {
  if (handler) {
    handler(p);
    return;
  }
  const { kind, ...detail } = p;
  window.dispatchEvent(
    new CustomEvent(
      kind === "project"
        ? TIME_TRACKER_PRESET_PROJECT_EVENT
        : TIME_TRACKER_PRESET_GOAL_EVENT,
      { detail }
    )
  );
}
