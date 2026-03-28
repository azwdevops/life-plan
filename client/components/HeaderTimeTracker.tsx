"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TIME_TRACKER_PRESET_GOAL_EVENT,
  TIME_TRACKER_PRESET_PROJECT_EVENT,
  type TimeTrackerKind,
  type TimeTrackerGoal,
  type TimeTrackerPresetGoalDetail,
  type TimeTrackerPresetProjectDetail,
  type TimeTrackerProject,
  type TimeTrackerSession,
  appendTimeEntry,
  elapsedMs,
  formatElapsed,
  loadGoals,
  loadProjects,
  loadSession,
  newId,
  registerAppendTimeEntryServerHook,
  saveSession,
} from "@/lib/time-tracker-storage";
import { createTimeEntry } from "@/lib/api/time-entries";
import { useAuth } from "@/lib/hooks/use-auth";
import { CreateGoalModal } from "@/components/time-tracker/CreateGoalModal";
import { CreateProjectModal } from "@/components/time-tracker/CreateProjectModal";
import {
  SearchableSelectPicker,
  type SearchablePickerItem,
} from "@/components/time-tracker/SearchableSelectPicker";
import { registerTrackerPresetHandler } from "@/lib/time-tracker-preset-bridge";

/** Dedicated worker so 1s ticks are less aggressively throttled than main-thread timers in background tabs. */
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

function resolveTimerSession(
  kind: TimeTrackerKind,
  subjectId: string,
  subjectSearch: string,
  goals: TimeTrackerGoal[],
  projects: TimeTrackerProject[],
  description: string
): TimeTrackerSession | null {
  const q = subjectSearch.trim();
  const qLower = q.toLowerCase();
  let sid = "";
  let sname = "";
  let pgId: string | null = null;
  let pgName: string | null = null;

  if (subjectId) {
    if (kind === "goal") {
      const g = goals.find((x) => x.id === subjectId);
      if (!g) return null;
      sid = g.id;
      sname = g.name;
    } else {
      const p = projects.find((x) => x.id === subjectId);
      if (!p) return null;
      sid = p.id;
      sname = p.name;
      if (p.goalId) {
        const g = goals.find((x) => x.id === p.goalId);
        pgId = p.goalId;
        pgName = g?.name ?? null;
      }
    }
  } else {
    if (!qLower) return null;
    if (kind === "goal") {
      const existing = goals.find((g) => g.name.toLowerCase() === qLower);
      if (!existing) return null;
      sid = existing.id;
      sname = existing.name;
    } else {
      const existing = projects.find((p) => p.name.toLowerCase() === qLower);
      if (!existing) return null;
      sid = existing.id;
      sname = existing.name;
      if (existing.goalId) {
        const g = goals.find((x) => x.id === existing.goalId);
        pgId = existing.goalId;
        pgName = g?.name ?? null;
      }
    }
  }

  return {
    kind,
    subjectId: sid,
    subjectName: sname,
    parentGoalId: kind === "project" ? pgId : null,
    parentGoalName: kind === "project" ? pgName : null,
    description: description.trim(),
    startedAt: new Date().toISOString(),
    accumulatedPauseMs: 0,
    pauseStartedAt: null,
  };
}

/** When the subject id/name no longer matches goals/projects (deleted or legacy rows), still start from preset + entry metadata. */
function presetDescription(d: TimeTrackerPresetProjectDetail): string {
  return typeof d.description === "string" ? d.description : "";
}

function autoStartSessionFromPreset(
  kind: TimeTrackerKind,
  d: TimeTrackerPresetProjectDetail,
  goals: TimeTrackerGoal[],
  projects: TimeTrackerProject[]
): TimeTrackerSession | null {
  const desc = presetDescription(d);
  const next = resolveTimerSession(
    kind,
    d.subjectId,
    d.subjectName,
    goals,
    projects,
    desc
  );
  if (next) return next;

  const name = d.subjectName.trim();
  if (!name) return null;
  const sidRaw = d.subjectId.trim();
  const stableId =
    sidRaw ||
    (kind === "goal" ? `legacy-goal:${name}` : `legacy-project:${name}`);

  if (kind === "goal") {
    return {
      kind: "goal",
      subjectId: stableId,
      subjectName: name,
      parentGoalId: null,
      parentGoalName: null,
      description: desc,
      startedAt: new Date().toISOString(),
      accumulatedPauseMs: 0,
      pauseStartedAt: null,
    };
  }

  let pgId: string | null =
    d.parentGoalId !== undefined ? d.parentGoalId : null;
  let pgName: string | null =
    d.parentGoalName !== undefined ? d.parentGoalName : null;
  if (pgId && (pgName == null || pgName === "")) {
    const g = goals.find((x) => x.id === pgId);
    pgName = g?.name ?? pgName;
  }

  return {
    kind: "project",
    subjectId: stableId,
    subjectName: name,
    parentGoalId: pgId,
    parentGoalName: pgName,
    description: desc,
    startedAt: new Date().toISOString(),
    accumulatedPauseMs: 0,
    pauseStartedAt: null,
  };
}

async function persistStoppedSession(
  session: TimeTrackerSession
): Promise<void> {
  const endedAt = new Date().toISOString();
  const durationMs = elapsedMs(session);
  await appendTimeEntry({
    id: newId(),
    kind: session.kind,
    subjectId: session.subjectId,
    subjectName: session.subjectName,
    parentGoalId: session.parentGoalId,
    parentGoalName: session.parentGoalName,
    description: session.description,
    startedAt: session.startedAt,
    endedAt,
    durationMs,
  });
  saveSession(null);
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function IconStop({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h12v12H6V6z" />
    </svg>
  );
}

export function HeaderTimeTracker({ inline = false }: { inline?: boolean }) {
  const { token } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<TimeTrackerSession | null>(null);
  const [goals, setGoals] = useState<TimeTrackerGoal[]>([]);
  const [projects, setProjects] = useState<TimeTrackerProject[]>([]);
  const [tick, setTick] = useState(0);

  const [kind, setKind] = useState<TimeTrackerKind>("goal");
  const [subjectId, setSubjectId] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [description, setDescription] = useState("");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalInitial, setGoalModalInitial] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalInitial, setProjectModalInitial] = useState("");

  const tabTitleBeforeTimerRef = useRef<string | null>(null);
  /** Same-tab session snapshot for play/preset when storage read lags React state. */
  const sessionRef = useRef<TimeTrackerSession | null>(null);

  const reloadFromStorage = useCallback(() => {
    setSession(loadSession());
    setGoals(loadGoals());
    setProjects(loadProjects());
  }, []);

  useEffect(() => {
    reloadFromStorage();
    setHydrated(true);
  }, [reloadFromStorage]);

  useEffect(() => {
    registerAppendTimeEntryServerHook(async (entry) => {
      if (!token) {
        throw new Error("Sign in to save time entries");
      }
      await createTimeEntry(token, entry);
    });
    return () => registerAppendTimeEntryServerHook(null);
  }, [token]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const applyPreset = useCallback(
    async (
      kindArg: TimeTrackerKind,
      d: TimeTrackerPresetProjectDetail | undefined
    ) => {
      if (
        !d ||
        typeof d.subjectId !== "string" ||
        typeof d.subjectName !== "string"
      ) {
        return;
      }
      const autoStart = d.autoStart === true;
      if (!autoStart && d.subjectId === "") return;

      const goalsFresh = loadGoals();
      const projectsFresh = loadProjects();
      setGoals(goalsFresh);
      setProjects(projectsFresh);

      const desc = presetDescription(d);

      if (autoStart) {
        const existing = sessionRef.current ?? loadSession();
        if (existing) {
          try {
            await persistStoppedSession(existing);
          } catch {
            return;
          }
          sessionRef.current = null;
          setSession(null);
        }
        const next = autoStartSessionFromPreset(
          kindArg,
          d,
          goalsFresh,
          projectsFresh
        );
        if (!next) return;
        setKind(kindArg);
        setSubjectId("");
        setSubjectSearch("");
        setDescription(desc);
        saveSession(next);
        setSession(next);
        return;
      }

      setKind(kindArg);
      setSubjectId(d.subjectId);
      setSubjectSearch(
        typeof d.subjectName === "string" ? d.subjectName : ""
      );
      setDescription(desc);
    },
    []
  );

  useEffect(() => {
    const onPresetProject = (e: Event) => {
      void applyPreset(
        "project",
        (e as CustomEvent<TimeTrackerPresetProjectDetail>).detail
      );
    };
    const onPresetGoal = (e: Event) => {
      void applyPreset(
        "goal",
        (e as CustomEvent<TimeTrackerPresetGoalDetail>).detail
      );
    };
    window.addEventListener(
      TIME_TRACKER_PRESET_PROJECT_EVENT,
      onPresetProject
    );
    window.addEventListener(TIME_TRACKER_PRESET_GOAL_EVENT, onPresetGoal);
    return () => {
      window.removeEventListener(
        TIME_TRACKER_PRESET_PROJECT_EVENT,
        onPresetProject
      );
      window.removeEventListener(TIME_TRACKER_PRESET_GOAL_EVENT, onPresetGoal);
    };
  }, [applyPreset]);

  useEffect(() => {
    return registerTrackerPresetHandler(({ kind, ...detail }) => {
      void applyPreset(kind, detail);
    });
  }, [applyPreset]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === "life-plan-time-tracker-session" ||
        e.key === "life-plan-time-tracker-goals" ||
        e.key === "life-plan-time-tracker-projects"
      ) {
        reloadFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reloadFromStorage]);

  useEffect(() => {
    if (!session) return;
    if (session.pauseStartedAt) return;
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
  }, [session]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!session) {
      if (tabTitleBeforeTimerRef.current !== null) {
        document.title = tabTitleBeforeTimerRef.current;
        tabTitleBeforeTimerRef.current = null;
      }
      return;
    }
    if (tabTitleBeforeTimerRef.current === null) {
      tabTitleBeforeTimerRef.current = document.title;
    }
    const ms = elapsedMs(session);
    const timeStr = formatElapsed(ms);
    const namePart =
      session.kind === "project" && session.parentGoalName
        ? `${session.subjectName} · ${session.parentGoalName}`
        : session.subjectName;
    const pausedMark = session.pauseStartedAt ? " (paused)" : "";
    document.title = `${timeStr}${pausedMark} · ${namePart} · Life Plan`;
  }, [session, tick]);

  useEffect(() => {
    return () => {
      if (typeof document === "undefined") return;
      if (tabTitleBeforeTimerRef.current !== null) {
        document.title = tabTitleBeforeTimerRef.current;
        tabTitleBeforeTimerRef.current = null;
      }
    };
  }, []);

  const handleStop = useCallback(async () => {
    if (session) {
      try {
        await persistStoppedSession(session);
        setDescription(session.description);
        setSession(null);
      } catch {
        /* keep session if server save failed */
      }
    } else {
      saveSession(null);
      setSession(null);
    }
  }, [session]);

  const handlePause = useCallback(() => {
    if (!session || session.pauseStartedAt) return;
    const next: TimeTrackerSession = {
      ...session,
      pauseStartedAt: new Date().toISOString(),
    };
    saveSession(next);
    setSession(next);
  }, [session]);

  const handleResume = useCallback(() => {
    if (!session || !session.pauseStartedAt) return;
    const pauseAt = new Date(session.pauseStartedAt).getTime();
    if (Number.isNaN(pauseAt)) {
      const next: TimeTrackerSession = {
        ...session,
        pauseStartedAt: null,
      };
      saveSession(next);
      setSession(next);
      return;
    }
    const next: TimeTrackerSession = {
      ...session,
      accumulatedPauseMs: session.accumulatedPauseMs + (Date.now() - pauseAt),
      pauseStartedAt: null,
    };
    saveSession(next);
    setSession(next);
  }, [session]);

  const subjectItems: SearchablePickerItem[] =
    kind === "goal"
      ? goals.map((g) => ({ id: g.id, name: g.name }))
      : projects.map((p) => ({ id: p.id, name: p.name }));

  const refreshGoals = useCallback(() => {
    setGoals(loadGoals());
  }, []);

  const handleStart = useCallback(() => {
    const next = resolveTimerSession(
      kind,
      subjectId,
      subjectSearch,
      goals,
      projects,
      description
    );
    if (!next) return;
    saveSession(next);
    setSession(next);
    setSubjectId("");
    setSubjectSearch("");
    setDescription("");
  }, [description, goals, kind, projects, subjectId, subjectSearch]);

  const onSubjectPickExisting = useCallback((id: string, name: string) => {
    setSubjectId(id);
    setSubjectSearch(name);
  }, []);

  const onSubjectRequestCreate = useCallback(
    (suggested: string) => {
      if (kind === "goal") {
        setGoalModalInitial(suggested);
        setGoalModalOpen(true);
      } else {
        setProjectModalInitial(suggested);
        setProjectModalOpen(true);
      }
    },
    [kind]
  );

  const nameMatchesExisting =
    kind === "goal"
      ? goals.some((g) => g.name.toLowerCase() === subjectSearch.trim().toLowerCase())
      : projects.some(
          (p) => p.name.toLowerCase() === subjectSearch.trim().toLowerCase()
        );
  const canStart =
    (subjectId !== "" && subjectSearch.trim().length > 0) ||
    (subjectSearch.trim().length > 0 && nameMatchesExisting);

  const labelClass = inline
    ? "sr-only"
    : "text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

  const rowClass = inline
    ? "flex max-w-full flex-wrap items-center justify-center gap-2 py-0.5 sm:gap-3 md:gap-4"
    : "flex flex-wrap items-end gap-3 gap-y-3 sm:gap-4";

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

  if (session) {
    void tick;
    const ms = elapsedMs(session);
    const isPaused = Boolean(session.pauseStartedAt);
    const sub =
      session.kind === "project" && session.parentGoalName
        ? `${session.subjectName} · under ${session.parentGoalName}`
        : session.subjectName;
    const detailLine = `${session.kind === "goal" ? "Goal" : "Project"}: ${sub}${
      session.description ? ` - ${session.description}` : ""
    }`;

    return (
      <div
        className={
          inline
            ? "flex max-w-full min-w-0 flex-wrap items-center justify-center gap-2 text-xs sm:gap-3 sm:text-sm md:gap-4"
            : "flex flex-wrap items-center gap-x-4 gap-y-3 text-sm sm:gap-x-5 sm:gap-y-3"
        }
      >
        <span
          className={`shrink-0 font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 ${
            inline ? "text-sm sm:text-base" : "text-base"
          } ${isPaused ? "opacity-70" : ""}`}
          aria-live="polite"
        >
          {formatElapsed(ms)}
        </span>
        <span
          className={`min-w-0 text-center text-zinc-600 dark:text-zinc-400 sm:text-left ${
            inline ? "max-w-[min(100%,14rem)] truncate sm:max-w-xs" : ""
          }`}
          title={inline ? detailLine : undefined}
        >
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {session.kind === "goal" ? "Goal" : "Project"}
          </span>
          {": "}
          {sub}
          {session.description ? (
            <span className="text-zinc-500 dark:text-zinc-500">
              {" "}
              - {session.description}
            </span>
          ) : null}
        </span>
        <div
          className={`flex shrink-0 items-center gap-2 ${inline ? "sm:gap-2.5" : "gap-2.5"}`}
        >
          {isPaused ? (
            <button
              type="button"
              onClick={handleResume}
              aria-label="Resume timer"
              title="Resume"
              className={`inline-flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 ${
                inline ? "h-7 w-7" : "h-8 w-8"
              }`}
            >
              <IconPlay className={inline ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              aria-label="Pause timer"
              title="Pause"
              className={`inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 ${
                inline ? "h-7 w-7" : "h-8 w-8"
              }`}
            >
              <IconPause className={inline ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleStop()}
            aria-label="Stop timer and save"
            title="Stop"
            className={`inline-flex items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40 ${
              inline ? "h-7 w-7" : "h-8 w-8"
            }`}
          >
            <IconStop className={inline ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={rowClass}>
        <div className={inline ? "flex flex-col justify-center" : "flex flex-col gap-0.5"}>
          <label htmlFor="time-tracker-kind" className={labelClass}>
            Track type
          </label>
          <select
            id="time-tracker-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as TimeTrackerKind);
              setSubjectId("");
              setSubjectSearch("");
            }}
            className={`rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 ${
              inline ? "min-w-[5.5rem]" : "min-w-[6rem]"
            }`}
          >
            <option value="goal">Goal</option>
            <option value="project">Project</option>
          </select>
        </div>

        <div
          className={
            inline
              ? "w-[7rem] sm:w-36"
              : "flex min-w-28 flex-col gap-0.5 sm:min-w-36"
          }
        >
          <label htmlFor="time-tracker-subject-input" className={labelClass}>
            {kind === "goal" ? "Goal name" : "Project name"}
          </label>
          <SearchableSelectPicker
            instanceId="time-tracker-subject-input"
            items={subjectItems}
            valueLabel={subjectSearch}
            triggerPlaceholder={
              kind === "goal" ? "Choose goal…" : "Choose project…"
            }
            onSelectExisting={onSubjectPickExisting}
            onRequestCreate={onSubjectRequestCreate}
            allowCreate
            className={inline ? "w-full" : "min-w-32 max-w-xs"}
          />
        </div>

        <div
          className={
            inline
              ? "min-w-[12rem] flex-1 basis-44 max-w-[22rem] sm:min-w-[14rem] sm:max-w-md md:min-w-[18rem] md:max-w-lg"
              : "flex min-w-[14rem] flex-1 basis-48 flex-col gap-0.5 sm:min-w-[18rem] md:min-w-[22rem] md:max-w-xl"
          }
        >
          <label htmlFor="time-tracker-desc" className={labelClass}>
            Description
          </label>
          <input
            id="time-tracker-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes…"
            className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          aria-label="Start timer"
          title="Start"
          className={`inline-flex shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500 ${
            inline ? "self-center h-7 w-7" : "h-8 w-8"
          }`}
        >
          <IconPlay className={inline ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      </div>

      <CreateGoalModal
        open={goalModalOpen}
        initialName={goalModalInitial}
        goals={goals}
        onClose={() => setGoalModalOpen(false)}
        onCreated={(id, name) => {
          setGoals(loadGoals());
          setSubjectId(id);
          setSubjectSearch(name);
        }}
      />
      <CreateProjectModal
        open={projectModalOpen}
        initialName={projectModalInitial}
        goals={goals}
        projects={projects}
        refreshGoals={refreshGoals}
        onClose={() => setProjectModalOpen(false)}
        onCreated={(id, name) => {
          setProjects(loadProjects());
          setGoals(loadGoals());
          setSubjectId(id);
          setSubjectSearch(name);
        }}
      />
    </>
  );
}
