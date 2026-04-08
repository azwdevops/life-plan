"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getAiScheduleJobStatus,
  startAiScheduleJob,
  type ScheduleBlockApi,
} from "@/lib/api/ai-schedule";
import {
  clearSchedule,
  getTodayKey,
  isScheduleForToday,
  loadStoredSchedule,
  saveSchedule,
  type StoredAiDaySchedule,
} from "@/lib/ai-day-schedule-storage";
import {
  EAT_TIMEZONE,
  endOfEatDayIso,
  formatEatTimeRange,
} from "@/lib/eat-timezone";
import { startBlockEndAlarm, type BlockEndAlarmHandle } from "@/lib/block-end-alarm";
import {
  loadFocusBlurOthers,
  saveFocusBlurOthers,
  subscribeFocusBlurOthers,
} from "@/lib/ai-schedule-focus-storage";
import {
  loadScheduleDialogDraft,
  saveScheduleDialogDraft,
} from "@/lib/ai-schedule-dialog-draft-storage";
import {
  emptyActivityRow,
  parsePlanInput,
  planFromRows,
  rowsFromPlan,
  serializePlanInput,
  type ActivityRowState,
} from "@/lib/ai-schedule-plan-input";

function sortBlocks(blocks: ScheduleBlockApi[]): ScheduleBlockApi[] {
  return [...blocks].sort(
    (x, y) => new Date(x.start_iso).getTime() - new Date(y.start_iso).getTime()
  );
}

function getCurrentBlockIndex(blocks: ScheduleBlockApi[], t: number): number | null {
  for (let i = 0; i < blocks.length; i++) {
    const s = new Date(blocks[i].start_iso).getTime();
    const e = new Date(blocks[i].end_iso).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) continue;
    if (t >= s && t < e) return i;
  }
  return null;
}

function kindStyles(kind: ScheduleBlockApi["kind"]): string {
  switch (kind) {
    case "break":
      return "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40";
    case "lunch":
      return "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30";
    case "buffer":
      return "border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60";
    default:
      return "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30";
  }
}

/** Softer green highlight for the active block (distinct from break/lunch tints). */
function currentBlockActiveStyles(): string {
  return [
    "border-emerald-400/80 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50/90",
    "ring-2 ring-emerald-400/60 ring-offset-2 ring-offset-zinc-50 shadow-md",
    "dark:border-emerald-500/70 dark:from-emerald-950/55 dark:via-green-950/45 dark:to-teal-950/40",
    "dark:ring-emerald-500/50 dark:ring-offset-zinc-950",
  ].join(" ");
}

function formatEatNow(ms: number): string {
  return `${new Date(ms).toLocaleTimeString("en-GB", {
    timeZone: EAT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })} EAT`;
}

function kindLabel(kind: ScheduleBlockApi["kind"]): string {
  switch (kind) {
    case "break":
      return "Break";
    case "lunch":
      return "Lunch";
    case "buffer":
      return "Buffer";
    default:
      return "Focus";
  }
}

/** Gaps between consecutive blocks (time between previous end and next start). */
function computeScheduleGaps(blocks: ScheduleBlockApi[]): { startMs: number; endMs: number }[] {
  const gaps: { startMs: number; endMs: number }[] = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    const end = new Date(blocks[i].end_iso).getTime();
    const start = new Date(blocks[i + 1].start_iso).getTime();
    if (!Number.isNaN(end) && !Number.isNaN(start) && start > end) {
      gaps.push({ startMs: end, endMs: start });
    }
  }
  return gaps;
}

function formatBreakCountdown(remainingMs: number): string {
  const clamped = Math.max(0, remainingMs);
  const totalSec = Math.floor(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AiSchedulePanel() {
  const { token } = useAuth();
  const [stored, setStored] = useState<StoredAiDaySchedule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activityRows, setActivityRows] = useState<ActivityRowState[]>(() => [emptyActivityRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set after POST /plan/start; poll with Check status. */
  const [scheduleJobId, setScheduleJobId] = useState<string | null>(null);
  const [jobHint, setJobHint] = useState<string | null>(null);
  /** Blur non-current blocks when true; single source of truth is localStorage. */
  const focusOthersMode = useSyncExternalStore(
    subscribeFocusBlurOthers,
    loadFocusBlurOthers,
    () => true
  );
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [blockEndAlarmPlaying, setBlockEndAlarmPlaying] = useState(false);

  const blockEndAlarmRef = useRef<BlockEndAlarmHandle | null>(null);
  const prevBlockIndexRef = useRef<number | null | undefined>(undefined);

  const stopBlockEndAlarm = useCallback(() => {
    blockEndAlarmRef.current?.stop();
    blockEndAlarmRef.current = null;
    setBlockEndAlarmPlaying(false);
  }, []);

  const hydrate = useCallback(() => {
    const s = loadStoredSchedule();
    if (s && isScheduleForToday(s)) {
      setStored({ ...s, blocks: sortBlocks(s.blocks) });
    } else {
      setStored(null);
      if (s && !isScheduleForToday(s)) {
        clearSchedule();
      }
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!stored) return;
    const tick = () => setNowTick(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [stored]);

  const sortedBlocks = useMemo(
    () => (stored ? sortBlocks(stored.blocks) : []),
    [stored]
  );

  const currentBlockIndex = useMemo(
    () => getCurrentBlockIndex(sortedBlocks, nowTick),
    [sortedBlocks, nowTick]
  );

  const scheduleGaps = useMemo(
    () => computeScheduleGaps(sortedBlocks),
    [sortedBlocks]
  );

  const activeGap = useMemo(() => {
    const t = nowTick;
    for (const g of scheduleGaps) {
      if (t >= g.startMs && t < g.endMs) return g;
    }
    return null;
  }, [scheduleGaps, nowTick]);

  const breakCountdownMs = activeGap ? activeGap.endMs - nowTick : 0;

  useEffect(() => {
    return () => {
      blockEndAlarmRef.current?.stop();
      blockEndAlarmRef.current = null;
    };
  }, []);

  useEffect(() => {
    prevBlockIndexRef.current = undefined;
  }, [stored?.generatedAt]);

  useEffect(() => {
    if (!stored) {
      prevBlockIndexRef.current = undefined;
      return;
    }
    const prev = prevBlockIndexRef.current;
    if (prev === undefined) {
      prevBlockIndexRef.current = currentBlockIndex;
      return;
    }
    if (prev !== null && currentBlockIndex !== prev) {
      blockEndAlarmRef.current?.stop();
      blockEndAlarmRef.current = startBlockEndAlarm(() => {
        blockEndAlarmRef.current = null;
        setBlockEndAlarmPlaying(false);
      });
      setBlockEndAlarmPlaying(true);
    }
    prevBlockIndexRef.current = currentBlockIndex;
  }, [currentBlockIndex, stored]);

  const openDialog = () => {
    setError(null);
    setScheduleJobId(null);
    setJobHint(null);
    const draft = loadScheduleDialogDraft();
    if (draft && draft.length > 0) {
      setActivityRows(draft);
    } else {
      const plan = parsePlanInput(stored?.tasksInput ?? "");
      setActivityRows(plan.length ? rowsFromPlan(plan) : [emptyActivityRow()]);
    }
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) return;
    saveScheduleDialogDraft(activityRows);
  }, [dialogOpen, activityRows]);

  const updateActivityRow = (
    id: string,
    patch: Partial<Pick<ActivityRowState, "title" | "maxRepetitions" | "maxDurationMinutes">>
  ) => {
    setActivityRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeActivityRow = (id: string) => {
    setActivityRows((rows) => {
      const next = rows.filter((r) => r.id !== id);
      return next.length ? next : [emptyActivityRow()];
    });
  };

  const addActivityRow = () => {
    setActivityRows((rows) => [...rows, emptyActivityRow()]);
  };

  const closeDialog = () => {
    if (!loading) {
      setDialogOpen(false);
      setScheduleJobId(null);
      setJobHint(null);
    }
  };

  const handleStartGenerate = async () => {
    const activities = planFromRows(activityRows);
    if (!activities.length) {
      setError("Add at least one activity with a title.");
      return;
    }
    if (!token) {
      setError("You need to be signed in.");
      return;
    }
    setLoading(true);
    setError(null);
    setJobHint(null);
    try {
      const res = await startAiScheduleJob(token, {
        activities,
        now_iso: new Date().toISOString(),
        end_of_day_iso: endOfEatDayIso(),
        timezone_name: EAT_TIMEZONE,
      });
      setScheduleJobId(res.job_id);
      setJobHint(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckJobStatus = async () => {
    if (!scheduleJobId || !token) {
      setError("Start generation first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const activities = planFromRows(activityRows);
      const status = await getAiScheduleJobStatus(token, scheduleJobId);
      if (status.status === "processing") {
        setJobHint(status.message ?? "Still working on it. Try again in a few seconds.");
        return;
      }
      if (status.status === "failed") {
        setError(status.error);
        setScheduleJobId(null);
        setJobHint(null);
        return;
      }
      const blocks = sortBlocks(status.blocks);
      const payload: StoredAiDaySchedule = {
        dayKey: getTodayKey(),
        generatedAt: new Date().toISOString(),
        tasksInput: serializePlanInput(activities),
        blocks,
        tips: null,
      };
      saveSchedule(payload);
      setStored(payload);
      setScheduleJobId(null);
      setJobHint(null);
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePrimaryAction = () => {
    if (scheduleJobId) {
      void handleCheckJobStatus();
    } else {
      void handleStartGenerate();
    }
  };

  const handleCancelScheduleJob = () => {
    setScheduleJobId(null);
    setJobHint(null);
    setError(null);
  };

  const handleClear = () => {
    stopBlockEndAlarm();
    clearSchedule();
    setStored(null);
  };

  const showToastStack = Boolean(activeGap) || blockEndAlarmPlaying;

  return (
    <div className="w-full min-w-0 space-y-8">
      {showToastStack ? (
        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col gap-2 sm:left-auto sm:max-w-md">
          {activeGap ? (
            <div
              className="pointer-events-auto rounded-xl border border-teal-400/90 bg-teal-50 px-4 py-3 shadow-lg dark:border-teal-600 dark:bg-teal-950/90"
              role="timer"
              aria-live="off"
              aria-label={`On break. Next block in ${formatBreakCountdown(breakCountdownMs)}`}
            >
              <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">On break</p>
              <p className="mt-0.5 text-sm text-teal-900/95 dark:text-teal-200/95">
                Next block in{" "}
                <span className="font-mono text-base font-bold tabular-nums">
                  {formatBreakCountdown(breakCountdownMs)}
                </span>
              </p>
              <p className="mt-1 text-xs text-teal-800/85 dark:text-teal-300/85">
                Time between blocks (not shown in the list). Ends at {formatEatNow(activeGap.endMs)}.
              </p>
            </div>
          ) : null}
          {blockEndAlarmPlaying ? (
            <div
              className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-700 dark:bg-amber-950/90 sm:pr-4"
              role="status"
              aria-live="polite"
            >
              <p className="min-w-0 text-sm font-medium text-amber-950 dark:text-amber-100">
                Time&apos;s up for this block. Reminder playing (up to 30s).
              </p>
              <button
                type="button"
                onClick={stopBlockEndAlarm}
                className="shrink-0 rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                Stop sound
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            AI day schedule
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Plan activities (optional max blocks and max minutes per block; default 40&nbsp;min) from now through 11:59&nbsp;PM EAT.
            Times use East Africa Time (EAT).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openDialog}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {stored ? "Regenerate schedule" : "Build today’s schedule"}
          </button>
          {stored ? (
            <>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Clear
              </button>
              <button
                type="button"
                aria-pressed={focusOthersMode}
                onClick={() => saveFocusBlurOthers(!focusOthersMode)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition ${
                  focusOthersMode
                    ? "border-violet-500 bg-violet-100 text-violet-900 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-200"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {focusOthersMode ? "Show all blocks" : "Focus: blur other blocks"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {stored && focusOthersMode && currentBlockIndex === null && !activeGap ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No active time block right now, so nothing is highlighted.
        </p>
      ) : null}

      {!stored ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No schedule for today yet. Add activities, optional max blocks, and max minutes per block (default 40), then generate.
          </p>
          <button
            type="button"
            onClick={openDialog}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Plan my day
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="m-0 list-none space-y-3 p-0">
            {sortedBlocks.map((b, idx) => {
              const isCurrent = idx === currentBlockIndex;
              const dimOthers =
                focusOthersMode && currentBlockIndex !== null && !isCurrent;
              return (
                <li
                  key={`${b.start_iso}-${b.end_iso}-${idx}`}
                  className={[
                    "flex gap-4 rounded-xl border p-4 shadow-sm transition-all duration-300",
                    isCurrent ? currentBlockActiveStyles() : kindStyles(b.kind),
                    dimOthers ? "blur-sm opacity-40" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0 shrink-0 text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                    {formatEatTimeRange(b.start_iso, b.end_iso)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isCurrent ? (
                        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white dark:bg-emerald-500">
                          Now
                        </span>
                      ) : null}
                      <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-950/50 dark:text-zinc-400">
                        {kindLabel(b.kind)}
                      </span>
                    </div>
                    <p className="mt-1 text-base font-medium text-zinc-900 dark:text-zinc-100">
                      {b.title}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Saved on this device only. All times are shown in East Africa Time (EAT,
            Africa/Nairobi, UTC+3).
          </p>
        </div>
      )}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="ai-schedule-dialog-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="ai-schedule-dialog-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Build today’s schedule
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              List each activity, how many separate time blocks it may use at most (leave max blocks empty for
              unlimited), and the longest any single block may run (minutes; empty defaults to 40). The AI fills
              from now until 11:59&nbsp;PM EAT with at least 5 minutes between consecutive blocks; gaps are not
              listed as rows.
            </p>
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_auto] sm:items-end">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Activity</span>
                <span className="hidden text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:block">
                  Max blocks
                </span>
                <span className="hidden text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:block">
                  Max min
                </span>
                <span className="hidden sm:block" aria-hidden />
              </div>
              {activityRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-2 rounded-lg p-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_auto] sm:items-center"
                >
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500 sm:sr-only" htmlFor={`act-title-${row.id}`}>
                      Activity
                    </label>
                    <input
                      id={`act-title-${row.id}`}
                      type="text"
                      value={row.title}
                      onChange={(e) => updateActivityRow(row.id, { title: e.target.value })}
                      placeholder="e.g. Reading book A"
                      disabled={loading}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500 sm:sr-only" htmlFor={`act-max-${row.id}`}>
                      Max blocks (empty = unlimited)
                    </label>
                    <input
                      id={`act-max-${row.id}`}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={row.maxRepetitions}
                      onChange={(e) => updateActivityRow(row.id, { maxRepetitions: e.target.value })}
                      placeholder="∞"
                      disabled={loading}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500 sm:sr-only" htmlFor={`act-dur-${row.id}`}>
                      Max minutes per block (empty = 40)
                    </label>
                    <input
                      id={`act-dur-${row.id}`}
                      type="number"
                      min={5}
                      max={720}
                      step={1}
                      inputMode="numeric"
                      value={row.maxDurationMinutes}
                      onChange={(e) => updateActivityRow(row.id, { maxDurationMinutes: e.target.value })}
                      placeholder="40"
                      disabled={loading}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeActivityRow(row.id)}
                    disabled={loading || activityRows.length <= 1}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addActivityRow}
                disabled={loading}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Add activity
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                Max blocks = cap on separate time slots for that activity (empty = no limit). Max min = longest any
                single block may run; leave empty for 40 minutes.
              </p>
            </div>
            {jobHint ? (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{jobHint}</p>
            ) : null}
            {error ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                disabled={loading}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              {scheduleJobId ? (
                <button
                  type="button"
                  onClick={handleCancelScheduleJob}
                  disabled={loading}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Start over
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSchedulePrimaryAction}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {loading
                  ? scheduleJobId
                    ? "Checking…"
                    : "Starting…"
                  : scheduleJobId
                    ? "Check status"
                    : "Generate schedule"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
