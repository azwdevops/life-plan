"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatElapsed } from "@/lib/time-tracker-storage";
import {
  startCountdownEndAlarm,
  COUNTDOWN_ALARM_MAX_DURATION_MS,
  type BlockEndAlarmHandle,
} from "@/lib/block-end-alarm";
import {
  loadCountdownState,
  remainingMsFromState,
  saveCountdownState,
  type CountdownTimerState,
} from "@/lib/countdown-timer-storage";

const MIN_INPUT_MINUTES = 0.01;

const TIMER_TICK_WORKER_SOURCE = `
let id = null;
self.onmessage = function (e) {
  if (e.data === "start") {
    if (id != null) clearInterval(id);
    id = setInterval(function () { self.postMessage(0); }, 1000);
  }
  if (e.data === "stop") {
    if (id != null) clearInterval(id);
    id = null;
  }
};
`;

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function IconReset({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function HeaderCountdownTimer({ inline = false }: { inline?: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<CountdownTimerState>(() => loadCountdownState());
  const [tick, setTick] = useState(0);
  const [alarmEndsAt, setAlarmEndsAt] = useState<number | null>(null);
  const [alarmTick, setAlarmTick] = useState(0);
  const [portalReady, setPortalReady] = useState(false);
  const alarmRef = useRef<BlockEndAlarmHandle | null>(null);

  const stopAlarm = useCallback(() => {
    alarmRef.current?.stop();
    alarmRef.current = null;
    setAlarmEndsAt(null);
  }, []);

  const startAlarmWithBanner = useCallback(() => {
    stopAlarm();
    setAlarmEndsAt(Date.now() + COUNTDOWN_ALARM_MAX_DURATION_MS);
    alarmRef.current = startCountdownEndAlarm(() => {
      alarmRef.current = null;
      setAlarmEndsAt(null);
    });
  }, [stopAlarm]);

  const persist = useCallback((next: CountdownTimerState) => {
    setState(next);
    saveCountdownState(next);
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const loaded = loadCountdownState();
    setState(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (state.status !== "running") return;
    if (typeof window === "undefined") return;

    const bump = () => setTick((t) => t + 1);

    let backupId: number | null = null;
    const syncHiddenBackup = () => {
      if (!document.hidden) {
        bump();
        if (backupId != null) {
          clearInterval(backupId);
          backupId = null;
        }
      } else if (backupId == null) {
        backupId = window.setInterval(bump, 10_000);
      }
    };

    const onFocus = () => bump();

    document.addEventListener("visibilitychange", syncHiddenBackup);
    window.addEventListener("focus", onFocus);
    if (document.hidden) {
      backupId = window.setInterval(bump, 10_000);
    }

    let stopWorker: () => void;
    try {
      const blob = new Blob([TIMER_TICK_WORKER_SOURCE], {
        type: "application/javascript",
      });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      worker.onmessage = () => bump();
      worker.postMessage("start");
      stopWorker = () => {
        worker.postMessage("stop");
        worker.terminate();
        URL.revokeObjectURL(url);
      };
    } catch {
      const mainId = window.setInterval(bump, 1000);
      stopWorker = () => window.clearInterval(mainId);
    }

    return () => {
      document.removeEventListener("visibilitychange", syncHiddenBackup);
      window.removeEventListener("focus", onFocus);
      if (backupId != null) clearInterval(backupId);
      stopWorker();
    };
  }, [state.status]);

  useEffect(() => {
    if (alarmEndsAt == null) return;
    const id = window.setInterval(() => setAlarmTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [alarmEndsAt]);

  useEffect(() => {
    if (state.status !== "running") return;
    const left = remainingMsFromState(state);
    if (left > 0) return;
    startAlarmWithBanner();
    persist({
      ...state,
      status: "idle",
      remainingMs: 0,
      deadlineAt: null,
    });
  }, [state, tick, persist, startAlarmWithBanner]);

  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, [stopAlarm]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "life-plan-countdown-timer") {
        setState(loadCountdownState());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handlePlayPause = () => {
    if (state.status === "running") {
      const left = remainingMsFromState(state);
      persist({
        ...state,
        status: "paused",
        remainingMs: left,
        deadlineAt: null,
      });
      return;
    }

    stopAlarm();

    const durationMs =
      state.status === "paused"
        ? state.remainingMs
        : Math.max(MIN_INPUT_MINUTES, state.inputMinutes) * 60_000;

    if (durationMs <= 0) return;

    persist({
      ...state,
      status: "running",
      remainingMs: durationMs,
      deadlineAt: Date.now() + durationMs,
    });
  };

  const handleReset = () => {
    stopAlarm();
    persist({
      ...state,
      status: "idle",
      remainingMs: 0,
      deadlineAt: null,
    });
  };

  const handleMinutesChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    const inputMinutes = Math.max(MIN_INPUT_MINUTES, parsed);
    persist({ ...state, inputMinutes });
  };

  void tick;
  void alarmTick;
  const remaining = remainingMsFromState(state);
  const alarmRemainingMs =
    alarmEndsAt != null ? Math.max(0, alarmEndsAt - Date.now()) : 0;
  const isRunning = state.status === "running";
  const isPaused = state.status === "paused";
  const showCountdown = isRunning || isPaused;

  const iconBtnClass = inline ? "h-7 w-7" : "h-8 w-8";
  const iconClass = inline ? "h-3.5 w-3.5" : "h-4 w-4";

  if (!hydrated) {
    return (
      <div
        className={
          inline
            ? "h-7 min-w-16 rounded bg-zinc-100/80 dark:bg-zinc-800/50"
            : "h-8 text-xs text-zinc-400 dark:text-zinc-500"
        }
        aria-hidden
      />
    );
  }

  return (
    <>
      <div
        className={
          inline
            ? "flex max-w-full min-w-0 flex-wrap items-center justify-center gap-2 text-xs sm:gap-3 sm:text-sm md:gap-4"
            : "flex flex-wrap items-center gap-x-4 gap-y-3 text-sm sm:gap-x-5 sm:gap-y-3"
        }
        aria-label="Countdown timer"
      >
      <div className="flex shrink-0 items-center gap-1.5">
        <label htmlFor="header-countdown-minutes" className="sr-only">
          Countdown minutes
        </label>
        <input
          id="header-countdown-minutes"
          type="number"
          min={MIN_INPUT_MINUTES}
          step={0.01}
          value={state.inputMinutes}
          disabled={isRunning}
          onChange={(e) => handleMinutesChange(e.target.value)}
          className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium tabular-nums text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          min
        </span>
      </div>

      {showCountdown ? (
        <span
          className={`shrink-0 font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 ${
            inline ? "text-sm sm:text-base" : "text-base"
          } ${isPaused ? "opacity-70" : ""}`}
          aria-live="polite"
        >
          {formatElapsed(remaining)}
        </span>
      ) : null}

      <div className={`flex shrink-0 items-center gap-2 ${inline ? "sm:gap-2.5" : "gap-2.5"}`}>
        <button
          type="button"
          onClick={handlePlayPause}
          aria-label={isRunning ? "Pause countdown" : "Start countdown"}
          title={isRunning ? "Pause" : "Start"}
          className={`inline-flex items-center justify-center rounded-md ${
            isRunning
              ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          } ${iconBtnClass}`}
        >
          {isRunning ? (
            <IconPause className={iconClass} />
          ) : (
            <IconPlay className={iconClass} />
          )}
        </button>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset countdown"
          title="Reset"
          className={`inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 ${iconBtnClass}`}
        >
          <IconReset className={iconClass} />
        </button>
      </div>
      </div>

      {alarmEndsAt != null && portalReady
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[9999]">
              <div className="absolute inset-x-0 bottom-3 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={stopAlarm}
                  className="pointer-events-auto w-full max-w-sm rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-left shadow-lg transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/90 dark:hover:bg-emerald-950"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Countdown finished
                  </p>
                  <p className="mt-1 text-sm text-emerald-900/95 dark:text-emerald-200/95">
                    Weaver bird stops in{" "}
                    <span className="font-mono text-base font-bold tabular-nums">
                      {formatElapsed(alarmRemainingMs)}
                    </span>
                  </p>
                  <p className="mt-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Tap to stop sound
                  </p>
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
