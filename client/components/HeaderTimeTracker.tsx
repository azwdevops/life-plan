"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TIME_TRACKER_PRESET_GOAL_EVENT,
  TIME_TRACKER_PRESET_PROJECT_EVENT,
  TIME_TRACKER_ENTRIES_UPDATED_EVENT,
  type TimeTrackerKind,
  type TimeTrackerGoal,
  type TimeTrackerPresetGoalDetail,
  type TimeTrackerPresetProjectDetail,
  type TimeTrackerProject,
  type TimeTrackerSession,
  elapsedMs,
  formatElapsed,
  loadSession,
  saveSession,
} from "@/lib/time-tracker-storage";
import {
  useTimeTrackerGoals,
  useTimeTrackerProjects,
  useTimeTrackerCategories,
} from "@/lib/hooks/use-time-tracker-subjects";
import {
  getActiveSession,
  startActiveSession,
  stopActiveSession,
  patchActiveSession,
  type StartActiveSessionBody,
} from "@/lib/api/time-tracker-active-session";
import { useAuth } from "@/lib/hooks/use-auth";
import { CreateGoalModal } from "@/components/time-tracker/CreateGoalModal";
import { CreateProjectModal } from "@/components/time-tracker/CreateProjectModal";
import {
  SearchableSelectPicker,
  type SearchablePickerItem,
} from "@/components/time-tracker/SearchableSelectPicker";
import { registerTrackerPresetHandler } from "@/lib/time-tracker-preset-bridge";

/** Dedicated worker so 1s ticks keep firing even when this tab is backgrounded -
 * a plain main-thread setInterval (and even a 10s backup one) gets throttled or
 * fully suspended by the browser after enough time hidden, which freezes the
 * on-screen elapsed display even though the underlying duration (always
 * recomputed from started_at) stays correct. */
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

function IconStop({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h12v12H6V6z" />
    </svg>
  );
}

/** Resolves the Start Timer form's current subject selection into an
 * active-session start request. Returns null if nothing resolvable is
 * selected/typed yet. */
function resolveStartBody(
  kind: TimeTrackerKind,
  subjectId: string,
  subjectSearch: string,
  goals: TimeTrackerGoal[],
  projects: TimeTrackerProject[],
  description: string
): StartActiveSessionBody | null {
  const q = subjectSearch.trim();
  const qLower = q.toLowerCase();
  let name = "";
  let goalIdNum: number | null = null;
  let projectIdNum: number | null = null;
  let pgId: string | null = null;
  let pgName: string | null = null;

  if (subjectId) {
    if (kind === "goal") {
      // A stale/legacy subjectId (e.g. a pre-DB-migration local id) won't
      // match any current goal by id - fall back to matching by name so
      // continuing an old group still resolves to the real, live row (and
      // therefore its real category) instead of giving up entirely.
      const g =
        goals.find((x) => x.id === subjectId) ??
        goals.find((x) => x.name.toLowerCase() === qLower);
      if (!g) return null;
      name = g.name;
      goalIdNum = Number(g.id);
    } else {
      const p =
        projects.find((x) => x.id === subjectId) ??
        projects.find((x) => x.name.toLowerCase() === qLower);
      if (!p) return null;
      name = p.name;
      projectIdNum = Number(p.id);
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
      name = existing.name;
      goalIdNum = Number(existing.id);
    } else {
      const existing = projects.find((p) => p.name.toLowerCase() === qLower);
      if (!existing) return null;
      name = existing.name;
      projectIdNum = Number(existing.id);
      if (existing.goalId) {
        const g = goals.find((x) => x.id === existing.goalId);
        pgId = existing.goalId;
        pgName = g?.name ?? null;
      }
    }
  }

  return {
    kind,
    goal_id: goalIdNum,
    project_id: projectIdNum,
    subject_name: name,
    parent_goal_id: kind === "project" ? pgId : null,
    parent_goal_name: kind === "project" ? pgName : null,
    description: description.trim(),
  };
}

/** When the subject id/name no longer matches goals/projects (deleted or legacy rows), still start from preset + entry metadata. */
function presetDescription(d: TimeTrackerPresetProjectDetail): string {
  return typeof d.description === "string" ? d.description : "";
}

function buildStartBodyFromPreset(
  kind: TimeTrackerKind,
  d: TimeTrackerPresetProjectDetail,
  goals: TimeTrackerGoal[],
  projects: TimeTrackerProject[]
): StartActiveSessionBody | null {
  const desc = presetDescription(d);

  // Prefer the entry's own already-resolved FK over re-deriving it from the
  // frozen subjectId/name - this is always correct (and lets the backend
  // resolve the project's *current* category for the new entry), even for
  // legacy entries whose subjectId predates the DB-backed project/goal ids.
  if (kind === "goal" && typeof d.goalId === "number") {
    const g = goals.find((x) => x.id === String(d.goalId));
    const name = g?.name ?? d.subjectName.trim();
    if (!name) return null;
    return {
      kind: "goal",
      goal_id: d.goalId,
      project_id: null,
      subject_name: name,
      description: desc,
    };
  }
  if (kind === "project" && typeof d.projectId === "number") {
    const p = projects.find((x) => x.id === String(d.projectId));
    const name = p?.name ?? d.subjectName.trim();
    if (!name) return null;
    const pgId: string | null = p?.goalId ?? d.parentGoalId ?? null;
    const pgName: string | null = pgId
      ? goals.find((x) => x.id === pgId)?.name ?? d.parentGoalName ?? null
      : null;
    return {
      kind: "project",
      goal_id: null,
      project_id: d.projectId,
      subject_name: name,
      parent_goal_id: pgId,
      parent_goal_name: pgName,
      description: desc,
    };
  }

  const resolved = resolveStartBody(kind, d.subjectId, d.subjectName, goals, projects, desc);
  if (resolved) return resolved;

  const name = d.subjectName.trim();
  if (!name) return null;

  if (kind === "goal") {
    return { kind: "goal", goal_id: null, project_id: null, subject_name: name, description: desc };
  }

  let pgId: string | null = d.parentGoalId !== undefined ? d.parentGoalId : null;
  let pgName: string | null = d.parentGoalName !== undefined ? d.parentGoalName : null;
  if (pgId && (pgName == null || pgName === "")) {
    const g = goals.find((x) => x.id === pgId);
    pgName = g?.name ?? pgName;
  }

  return {
    kind: "project",
    goal_id: null,
    project_id: null,
    subject_name: name,
    parent_goal_id: pgId,
    parent_goal_name: pgName,
    description: desc,
  };
}

/** Starts the ticking display from "now" immediately, before the
 * start-session request even reaches the server - so the timer doesn't sit
 * frozen at 0 for however long that round trip takes. The server's reply
 * (a started_at a little earlier than this) replaces it moments later; the
 * only visible effect is the elapsed count nudging forward slightly, never
 * a stall. Category is unknown until that reply arrives, so it's left null
 * here - harmless since nothing reads it before the real session lands. */
function optimisticSessionFromBody(body: StartActiveSessionBody): TimeTrackerSession {
  return {
    kind: body.kind,
    subjectId:
      body.kind === "goal"
        ? String(body.goal_id ?? "")
        : String(body.project_id ?? ""),
    subjectName: body.subject_name,
    categoryId: null,
    categoryName: null,
    parentGoalId: body.parent_goal_id ?? null,
    parentGoalName: body.parent_goal_name ?? null,
    description: body.description ?? "",
    startedAt: new Date().toISOString(),
    accumulatedPauseMs: 0,
    pauseStartedAt: null,
  };
}

export function HeaderTimeTracker({ inline = false }: { inline?: boolean }) {
  const { token } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<TimeTrackerSession | null>(null);
  const [tick, setTick] = useState(0);

  const goalsQuery = useTimeTrackerGoals();
  const projectsQuery = useTimeTrackerProjects();
  const categoriesQuery = useTimeTrackerCategories();
  const goals = goalsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const [kind, setKind] = useState<TimeTrackerKind>("goal");
  const [subjectId, setSubjectId] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [description, setDescription] = useState("");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalInitial, setGoalModalInitial] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalInitial, setProjectModalInitial] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const tabTitleBeforeTimerRef = useRef<string | null>(null);

  // Flicker-avoidance cache: show the last-known session instantly on mount,
  // then overwrite with the authoritative server value once it resolves.
  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setSession(null);
      saveSession(null);
      return;
    }
    let cancelled = false;
    getActiveSession(token)
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        saveSession(s);
      })
      .catch(() => {
        /* keep cached value on transient errors */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // No live cross-device push: instead, re-fetch the authoritative state
  // whenever this tab regains focus/visibility, so a session stopped or
  // changed elsewhere is caught up on promptly without an always-open
  // connection per tab.
  useEffect(() => {
    if (!token) return;
    const refetch = () => {
      void getActiveSession(token)
        .then((s) => {
          setSession(s);
          saveSession(s);
        })
        .catch(() => {
          /* keep current value on transient errors */
        });
      window.dispatchEvent(new CustomEvent(TIME_TRACKER_ENTRIES_UPDATED_EVENT));
    };
    const onVisibility = () => {
      if (!document.hidden) refetch();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token]);

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

      const desc = presetDescription(d);

      if (autoStart) {
        if (!token) return;
        const body = buildStartBodyFromPreset(kindArg, d, goals, projects);
        if (!body) return;
        const previousSession = session;
        const optimistic = optimisticSessionFromBody(body);
        setSession(optimistic);
        saveSession(optimistic);
        try {
          const result = await startActiveSession(token, body);
          setSession(result.session);
          saveSession(result.session);
          if (result.autoClosedEntry) {
            window.dispatchEvent(new CustomEvent(TIME_TRACKER_ENTRIES_UPDATED_EVENT));
          }
        } catch {
          setSession(previousSession);
          saveSession(previousSession);
          return;
        }
        setKind(kindArg);
        setSubjectId("");
        setSubjectSearch("");
        setDescription(desc);
        return;
      }

      setKind(kindArg);
      setSubjectId(d.subjectId);
      setSubjectSearch(
        typeof d.subjectName === "string" ? d.subjectName : ""
      );
      setDescription(desc);
    },
    [token, goals, projects, session]
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

    // Ticking is purely local: elapsedMs(session) is always recomputed from
    // the server's started_at against the current time, never accumulated
    // tick-by-tick, so a missed or delayed tick can never cause drift - it
    // just catches up to the correct value on the next one. The worker
    // below only exists to make sure *some* tick keeps arriving while this
    // tab is backgrounded, which a main-thread interval can't guarantee.
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
    if (!token) return;
    try {
      await stopActiveSession(token);
      setSession(null);
      saveSession(null);
      window.dispatchEvent(new CustomEvent(TIME_TRACKER_ENTRIES_UPDATED_EVENT));
    } catch {
      /* keep session if server stop failed */
    }
  }, [token]);

  const handlePause = useCallback(async () => {
    if (!session || session.pauseStartedAt || !token) return;
    const optimistic: TimeTrackerSession = {
      ...session,
      pauseStartedAt: new Date().toISOString(),
    };
    setSession(optimistic);
    saveSession(optimistic);
    try {
      const updated = await patchActiveSession(token, { action: "pause" });
      setSession(updated);
      saveSession(updated);
    } catch {
      setSession(session);
      saveSession(session);
    }
  }, [session, token]);

  const handleResume = useCallback(async () => {
    if (!session || !session.pauseStartedAt || !token) return;
    try {
      const updated = await patchActiveSession(token, { action: "resume" });
      setSession(updated);
      saveSession(updated);
    } catch {
      /* keep paused state on failure */
    }
  }, [session, token]);

  const subjectItems: SearchablePickerItem[] =
    kind === "goal"
      ? goals.map((g) => ({ id: g.id, name: g.name })).sort((a, b) => a.name.localeCompare(b.name))
      : projects.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));

  const handleStart = useCallback(async () => {
    if (!token) return;
    const body = resolveStartBody(kind, subjectId, subjectSearch, goals, projects, description);
    if (!body) return;
    setStarting(true);
    setStartError(null);
    const optimistic = optimisticSessionFromBody(body);
    setSession(optimistic);
    saveSession(optimistic);
    try {
      const result = await startActiveSession(token, body);
      setSession(result.session);
      saveSession(result.session);
      setSubjectId("");
      setSubjectSearch("");
      setDescription("");
      if (result.autoClosedEntry) {
        window.dispatchEvent(new CustomEvent(TIME_TRACKER_ENTRIES_UPDATED_EVENT));
      }
    } catch (err) {
      setSession(null);
      saveSession(null);
      setStartError(err instanceof Error ? err.message : "Failed to start timer");
    } finally {
      setStarting(false);
    }
  }, [token, kind, subjectId, subjectSearch, goals, projects, description]);

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
    !starting &&
    ((subjectId !== "" && subjectSearch.trim().length > 0) ||
      (subjectSearch.trim().length > 0 && nameMatchesExisting));

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
              onClick={() => void handleResume()}
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
              onClick={() => void handlePause()}
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

        <div className="relative shrink-0 self-center">
          <button
            type="button"
            disabled={!canStart}
            onClick={() => void handleStart()}
            aria-label="Start timer"
            title="Start"
            className={`inline-flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500 ${
              inline ? "h-7 w-7" : "h-8 w-8"
            }`}
          >
            <IconPlay className={inline ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>
        </div>
        {startError ? (
          <p className="w-full text-xs text-red-600 dark:text-red-400">{startError}</p>
        ) : null}
      </div>

      <CreateGoalModal
        open={goalModalOpen}
        initialName={goalModalInitial}
        goals={goals}
        onClose={() => setGoalModalOpen(false)}
        onCreated={(id, name) => {
          setSubjectId(id);
          setSubjectSearch(name);
        }}
      />
      <CreateProjectModal
        open={projectModalOpen}
        initialName={projectModalInitial}
        goals={goals}
        projects={projects}
        categories={categories}
        refreshGoals={() => {}}
        onClose={() => setProjectModalOpen(false)}
        onCreated={(id, name) => {
          setSubjectId(id);
          setSubjectSearch(name);
        }}
      />
    </>
  );
}
