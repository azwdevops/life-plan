"use client";

import moment from "moment";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog } from "@/components/Dialog";
import { RightDrawer } from "@/components/RightDrawer";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { HeaderTimeTracker } from "@/components/HeaderTimeTracker";
import {
  TIME_TRACKER_ENTRIES_UPDATED_EVENT,
  formatDurationMs,
  type TimeTrackerEntry,
  type TimeTrackerKind,
} from "@/lib/time-tracker-storage";
import { emitTrackerPreset } from "@/lib/time-tracker-preset-bridge";
import {
  deleteTimeEntry,
  duplicateTimeEntry,
  listRecentTimeEntries,
  listTimeEntries,
  updateTimeEntry,
} from "@/lib/api/time-entries";
import {
  type TimeTrackerGoal,
  type TimeTrackerProject,
} from "@/lib/time-tracker-storage";
import {
  useTimeTrackerGoals,
  useTimeTrackerProjects,
  useSyncTimeTrackerSubjectsFromServer,
  useDeleteTimeTrackerGoalFromCache,
  useDeleteTimeTrackerProjectFromCache,
} from "@/lib/hooks/use-time-tracker-subjects";
import { CreateGoalModal } from "@/components/time-tracker/CreateGoalModal";
import { CreateProjectModal } from "@/components/time-tracker/CreateProjectModal";
import { TimeTrackingCharts } from "@/components/productivity/TimeTrackingCharts";

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function IconTarget({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLongDateFromDayKey(dayKey: string): string {
  const m = moment(dayKey, "YYYY-MM-DD");
  return m.isValid() ? m.format("dddd, LL") : dayKey;
}

function daySectionTitle(dayKey: string, now: Date): string {
  const todayKey = localDateKey(now);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = localDateKey(yest);
  if (dayKey === todayKey) return "Today";
  if (dayKey === yesterdayKey) return "Yesterday";
  return formatLongDateFromDayKey(dayKey);
}

function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isoToLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function localDatetimeValueToIso(value: string): string {
  return new Date(value).toISOString();
}

function bumpTimeEntriesEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TIME_TRACKER_ENTRIES_UPDATED_EVENT));
  }
}

function TimeEntryRowMenu({
  disabled,
  onEdit,
  onDuplicate,
  onDeleteClick,
}: {
  disabled?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDeleteClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuFixed, setMenuFixed] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updateMenuPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gapBelowButton = 4;
    // Matches biz-poa's DropdownMenu `offset={{x,y}}` convention: negative
    // x/y nudge the menu left/up from its default right-aligned, gap-below
    // position; positive would nudge it right/down. Larger than
    // SubjectItemMenu's offset because this trigger sits at the edge of a
    // table row.
    const offset = { x: -36, y: -52 };
    setMenuFixed({
      top: Math.max(8, r.bottom + gapBelowButton + offset.y),
      right: window.innerWidth - r.right - offset.x,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuFixed(null);
      return;
    }
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="flex justify-end" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Entry actions"
        onClick={() => !disabled && setOpen((o) => !o)}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && menuFixed ? (
        <ul
          className="fixed z-50 min-w-36 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ top: menuFixed.top, right: menuFixed.right }}
          role="menu"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Edit
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
            >
              Duplicate
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={() => {
                setOpen(false);
                onDeleteClick();
              }}
            >
              Delete
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function SubjectItemMenu({
  onEdit,
  onDeleteClick,
}: {
  onEdit: () => void;
  onDeleteClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuFixed, setMenuFixed] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updateMenuPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gapBelowButton = 4;
    // Matches biz-poa's DropdownMenu `offset={{x,y}}` convention: negative
    // x/y nudge the menu left/up from its default right-aligned, gap-below
    // position; positive would nudge it right/down.
    const offset = { x: -16, y: -44 };
    setMenuFixed({
      top: r.bottom + gapBelowButton + offset.y,
      right: window.innerWidth - r.right - offset.x,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuFixed(null);
      return;
    }
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="flex justify-end" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <svg className="h-5 w-5" viewBox="0 0 17 17" fill="currentColor" aria-hidden>
          <path d="M16 2v2h-11v-2h11zM5 9h11v-2h-11v2zM5 14h11v-2h-11v2zM2 2c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1zM2 7c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1zM2 12c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1z" />
        </svg>
      </button>
      {open && menuFixed ? (
        <ul
          className="fixed z-[70] min-w-32 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ top: menuFixed.top, right: menuFixed.right }}
          role="menu"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Edit
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={() => {
                setOpen(false);
                onDeleteClick();
              }}
            >
              Delete
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function bucketEntriesByStartedDay(
  entries: TimeTrackerEntry[],
  now: Date
): { dayKey: string; title: string; items: TimeTrackerEntry[]; totalMs: number }[] {
  const dayMap = new Map<string, TimeTrackerEntry[]>();
  for (const e of entries) {
    const k = localDateKey(new Date(e.startedAt));
    const list = dayMap.get(k);
    if (list) list.push(e);
    else dayMap.set(k, [e]);
  }
  const keys = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((dayKey) => {
    const items = dayMap.get(dayKey)!;
    return {
      dayKey,
      title: daySectionTitle(dayKey, now),
      items,
      totalMs: items.reduce((sum, e) => sum + e.durationMs, 0),
    };
  });
}

type SubjectGroup = {
  groupKey: string;
  kind: TimeTrackerKind;
  name: string;
  entries: TimeTrackerEntry[];
  totalMs: number;
};

function groupDayItemsBySubject(dayItems: TimeTrackerEntry[]): SubjectGroup[] {
  const map = new Map<string, TimeTrackerEntry[]>();
  for (const e of dayItems) {
    const k = `${e.kind}:${e.subjectId || e.subjectName}`;
    const list = map.get(k);
    if (list) list.push(e);
    else map.set(k, [e]);
  }
  const groups: SubjectGroup[] = [];
  for (const [groupKey, list] of map) {
    list.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    const first = list[0]!;
    const totalMs = list.reduce((s, x) => s + x.durationMs, 0);
    groups.push({
      groupKey,
      kind: first.kind,
      name: first.subjectName,
      entries: list,
      totalMs,
    });
  }
  groups.sort(
    (a, b) =>
      new Date(b.entries[0]!.startedAt).getTime() -
      new Date(a.entries[0]!.startedAt).getTime()
  );
  return groups;
}

function expandKey(dayKey: string, groupKey: string): string {
  return `${dayKey}::${groupKey}`;
}

function localBoundsLastNDays(
  n: number,
  now = new Date()
): { from: string; toExclusive: string } {
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();
  const toExclusive = new Date(y, mo, d + 1);
  const from = new Date(y, mo, d - (n - 1));
  return { from: from.toISOString(), toExclusive: toExclusive.toISOString() };
}

function entryStartedInRange(
  e: TimeTrackerEntry,
  fromIso: string,
  toExclusiveIso: string
): boolean {
  const t = new Date(e.startedAt).getTime();
  const a = new Date(fromIso).getTime();
  const b = new Date(toExclusiveIso).getTime();
  return t >= a && t < b;
}

function minStartedLocalDayKey(entries: TimeTrackerEntry[]): string | null {
  if (entries.length === 0) return null;
  let min = "";
  for (const e of entries) {
    const k = localDateKey(new Date(e.startedAt));
    if (min === "" || k.localeCompare(min) < 0) min = k;
  }
  return min;
}

function boundsBeforeOldestDay(
  oldestDayKey: string,
  days: number
): { from: string; toExclusive: string } | null {
  const [y, m, d] = oldestDayKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  const oldestMidnight = new Date(y, m - 1, d);
  const toExclusive = new Date(
    oldestMidnight.getFullYear(),
    oldestMidnight.getMonth(),
    oldestMidnight.getDate()
  );
  const from = new Date(
    oldestMidnight.getFullYear(),
    oldestMidnight.getMonth(),
    oldestMidnight.getDate() - days
  );
  return { from: from.toISOString(), toExclusive: toExclusive.toISOString() };
}

function sortEntriesDesc(items: TimeTrackerEntry[]): TimeTrackerEntry[] {
  return [...items].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

function replaceEntriesInTimeRange(
  prev: TimeTrackerEntry[],
  fromIso: string,
  toExclusiveIso: string,
  replacement: TimeTrackerEntry[]
): TimeTrackerEntry[] {
  const kept = prev.filter(
    (e) => !entryStartedInRange(e, fromIso, toExclusiveIso)
  );
  const m = new Map<string, TimeTrackerEntry>();
  for (const e of kept) m.set(e.id, e);
  for (const e of replacement) m.set(e.id, e);
  return [...m.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

function mergeOlderChunk(
  prev: TimeTrackerEntry[],
  chunk: TimeTrackerEntry[]
): TimeTrackerEntry[] {
  const m = new Map<string, TimeTrackerEntry>();
  for (const e of prev) m.set(e.id, e);
  for (const e of chunk) m.set(e.id, e);
  return [...m.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

function totalMsForSubject(
  entries: TimeTrackerEntry[],
  kind: TimeTrackerKind,
  id: string,
  name: string
): number {
  return entries
    .filter(
      (e) =>
        e.kind === kind &&
        (e.subjectId === id ||
          e.subjectName.toLowerCase() === name.toLowerCase())
    )
    .reduce((sum, e) => sum + e.durationMs, 0);
}

function SubjectSidePanel({
  open,
  kind,
  entries,
  onClose,
  onStartTracking,
}: {
  open: boolean;
  kind: TimeTrackerKind;
  entries: TimeTrackerEntry[];
  onClose: () => void;
  onStartTracking: (
    id: string,
    name: string,
    parentGoalId: string | null,
    parentGoalName: string | null
  ) => void;
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<
    TimeTrackerGoal | TimeTrackerProject | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<
    TimeTrackerGoal | TimeTrackerProject | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [searchKind, setSearchKind] = useState(kind);
  const { token } = useAuth();
  const goalsQuery = useTimeTrackerGoals();
  const projectsQuery = useTimeTrackerProjects();
  const syncFromServer = useSyncTimeTrackerSubjectsFromServer();
  const deleteGoalFromCache = useDeleteTimeTrackerGoalFromCache();
  const deleteProjectFromCache = useDeleteTimeTrackerProjectFromCache();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const goals = goalsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const closeSubjectModal = useCallback(() => {
    setCreateModalOpen(false);
    setEditTarget(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      if (kind === "goal") {
        deleteGoalFromCache(deleteTarget.id);
      } else {
        deleteProjectFromCache(deleteTarget.id);
      }
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, kind, deleteGoalFromCache, deleteProjectFromCache]);

  if (kind !== searchKind) {
    setSearchKind(kind);
    setSearch("");
  }

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      if (token) {
        const result = await syncFromServer(token);
        if (result.goalsAdded > 0 || result.projectsAdded > 0) {
          setSyncMessage(
            `Imported ${result.goalsAdded} goal(s), ${result.projectsAdded} project(s) from the server.`
          );
        }
      }
      await (kind === "goal" ? goalsQuery.refetch() : projectsQuery.refetch());
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setSyncing(false);
    }
  }, [token, syncFromServer, kind, goalsQuery, projectsQuery]);

  const items = (
    kind === "goal"
      ? [...goals].sort((a, b) => a.name.localeCompare(b.name))
      : [...projects].sort((a, b) => a.name.localeCompare(b.name))
  ).filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <RightDrawer
        open={open}
        onClose={onClose}
        title={kind === "goal" ? "Goals" : "Projects"}
        width="xl"
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={syncing}
              aria-label={kind === "goal" ? "Refresh goals" : "Refresh projects"}
              title="Refresh (also pulls in goals/projects created server-side)"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <IconRefresh className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${kind === "goal" ? "goals" : "projects"}…`}
              aria-label={`Search ${kind === "goal" ? "goals" : "projects"}`}
              className="w-full min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => {
                setEditTarget(null);
                setCreateModalOpen(true);
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <IconPlus className="h-4 w-4" />
              {kind === "goal" ? "Add goal" : "Add project"}
            </button>
          </>
        }
      >
      {syncMessage ? (
        <p className="mb-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {syncMessage}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
          {search.trim()
            ? `No ${kind === "goal" ? "goals" : "projects"} match "${search.trim()}".`
            : `No ${kind === "goal" ? "goals" : "projects"} yet.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const parentGoalId =
              kind === "project" ? (item as TimeTrackerProject).goalId : null;
            const parentGoalName = parentGoalId
              ? goals.find((g) => g.id === parentGoalId)?.name ?? null
              : null;
            const ms = totalMsForSubject(entries, kind, item.id, item.name);
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {parentGoalName ? `${parentGoalName} · ` : ""}
                    {formatDurationMs(ms)} tracked
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onStartTracking(item.id, item.name, parentGoalId, parentGoalName)
                  }
                  aria-label={`Start tracking ${item.name}`}
                  title="Start tracking"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <IconPlay className="h-4 w-4" />
                </button>
                <SubjectItemMenu
                  onEdit={() => {
                    setEditTarget(item);
                    setCreateModalOpen(true);
                  }}
                  onDeleteClick={() => setDeleteTarget(item)}
                />
              </li>
            );
          })}
        </ul>
      )}
      </RightDrawer>

      {kind === "goal" ? (
        <CreateGoalModal
          open={createModalOpen}
          initialName=""
          goals={goals}
          editTarget={editTarget as TimeTrackerGoal | null}
          onClose={closeSubjectModal}
          onCreated={closeSubjectModal}
          stackLevel={1}
        />
      ) : (
        <CreateProjectModal
          open={createModalOpen}
          initialName=""
          goals={goals}
          projects={projects}
          refreshGoals={() => {}}
          editTarget={editTarget as TimeTrackerProject | null}
          onClose={closeSubjectModal}
          onCreated={closeSubjectModal}
          stackLevel={1}
        />
      )}

      <Dialog
        isOpen={deleteTarget != null}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        title={kind === "goal" ? "Delete goal" : "Delete project"}
        size="sm"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Delete &quot;{deleteTarget?.name}&quot; permanently? This cannot be
          undone.
          {kind === "goal"
            ? " Projects under this goal will keep their own time entries but lose their link to it."
            : ""}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleteBusy}
            onClick={() => setDeleteTarget(null)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteBusy}
            onClick={confirmDelete}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white dark:bg-red-600"
          >
            Delete
          </button>
        </div>
      </Dialog>
    </>
  );
}

export const TimeTrackingPanel = memo(function TimeTrackingPanel() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<TimeTrackerEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const showMobileTimeTracker = useMediaQuery("(max-width: 767px)");
  const [editingEntry, setEditingEntry] = useState<TimeTrackerEntry | null>(null);
  const [editStarted, setEditStarted] = useState("");
  const [editEnded, setEditEnded] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTimeRangeError, setEditTimeRangeError] = useState<string | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<TimeTrackerEntry | null>(null);
  const [entryActionBusy, setEntryActionBusy] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelKind, setSidePanelKind] = useState<TimeTrackerKind>("goal");
  const openSidePanel = useCallback((kind: TimeTrackerKind) => {
    setSidePanelKind(kind);
    setSidePanelOpen(true);
  }, []);

  const startTrackingSubject = useCallback(
    (
      kind: TimeTrackerKind,
      id: string,
      name: string,
      parentGoalId: string | null,
      parentGoalName: string | null
    ) => {
      emitTrackerPreset({
        kind,
        subjectId: id,
        subjectName: name,
        autoStart: true,
        description: "",
        ...(kind === "project" ? { parentGoalId, parentGoalName } : {}),
      });
      setSidePanelOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    []
  );

  const dayBuckets = useMemo(
    () => bucketEntriesByStartedDay(entries, new Date()),
    [entries]
  );

  useEffect(() => {
    if (!token) {
      setEntries([]);
      return;
    }
    const sync = () => {
      void listRecentTimeEntries(token, 2000)
        .then(setEntries)
        .catch(() => {
          /* keep current list on transient errors */
        });
    };
    sync();
    const onEntriesUpdated = () => sync();
    window.addEventListener("focus", sync);
    window.addEventListener(TIME_TRACKER_ENTRIES_UPDATED_EVENT, onEntriesUpdated);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener(
        TIME_TRACKER_ENTRIES_UPDATED_EVENT,
        onEntriesUpdated
      );
    };
  }, [token]);

  useEffect(() => {
    if (!editingEntry) return;
    setEditStarted(isoToLocalDatetimeValue(editingEntry.startedAt));
    setEditEnded(isoToLocalDatetimeValue(editingEntry.endedAt));
    setEditDescription(editingEntry.description ?? "");
    setEditTimeRangeError(null);
  }, [editingEntry]);

  const handleDuplicateEntry = useCallback(
    async (e: TimeTrackerEntry) => {
      if (!token) return;
      setFetchError(null);
      setEntryActionBusy(true);
      try {
        const copy = await duplicateTimeEntry(token, e.id);
        setEntries((prev) => sortEntriesDesc([...prev, copy]));
        bumpTimeEntriesEvent();
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Duplicate failed");
      } finally {
        setEntryActionBusy(false);
      }
    },
    [token]
  );

  const confirmDeleteEntry = useCallback(async () => {
    if (!token || !deleteTarget) return;
    setFetchError(null);
    setEntryActionBusy(true);
    try {
      await deleteTimeEntry(token, deleteTarget.id);
      setEntries((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
      bumpTimeEntriesEvent();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setEntryActionBusy(false);
    }
  }, [token, deleteTarget]);

  const saveEditEntry = useCallback(async () => {
    if (!token || !editingEntry) return;
    setFetchError(null);
    const startedIso = localDatetimeValueToIso(editStarted);
    const endedIso = localDatetimeValueToIso(editEnded);
    if (new Date(endedIso) < new Date(startedIso)) {
      setEditTimeRangeError("End time must be on or after start time.");
      return;
    }
    const durationMs = Math.max(
      0,
      new Date(endedIso).getTime() - new Date(startedIso).getTime()
    );
    setEntryActionBusy(true);
    try {
      const updated = await updateTimeEntry(token, editingEntry.id, {
        description: editDescription,
        started_at: startedIso,
        ended_at: endedIso,
        duration_ms: durationMs,
      });
      setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingEntry(null);
      bumpTimeEntriesEvent();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEntryActionBusy(false);
    }
  }, [token, editingEntry, editStarted, editEnded, editDescription]);

  const toggleGroup = (dayKey: string, groupKey: string) => {
    const k = expandKey(dayKey, groupKey);
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const onRefreshFromServer = async () => {
    if (!token) return;
    setFetchError(null);
    setFetching(true);
    try {
      const { from, toExclusive } = localBoundsLastNDays(5);
      const remote = await listTimeEntries(token, from, toExclusive);
      const merged = sortEntriesDesc(remote);
      setEntries((prev) =>
        replaceEntriesInTimeRange(prev, from, toExclusive, merged)
      );
      setHasMoreOlder(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setFetching(false);
    }
  };

  const onLoadMoreFromServer = async () => {
    if (!token) return;
    const oldest = minStartedLocalDayKey(entries);
    if (!oldest) return;
    const bounds = boundsBeforeOldestDay(oldest, 5);
    if (!bounds) return;
    setFetchError(null);
    setFetchingMore(true);
    try {
      const remote = await listTimeEntries(
        token,
        bounds.from,
        bounds.toExclusive
      );
      const merged = sortEntriesDesc(remote);
      if (merged.length === 0) {
        setHasMoreOlder(false);
      } else {
        setEntries((prev) => mergeOlderChunk(prev, merged));
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setFetchingMore(false);
    }
  };

  return (
        <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col">
          {showMobileTimeTracker === true ? (
            <section
              className="mb-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              aria-label="Time tracker"
            >
              <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Track time
              </h2>
              <HeaderTimeTracker inline />
            </section>
          ) : null}
          {fetchError ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {fetchError}
            </p>
          ) : null}
          <TimeTrackingCharts
            entries={entries}
            headerActions={
              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                <button
                  type="button"
                  disabled={!token || fetching}
                  onClick={() => void onRefreshFromServer()}
                  aria-label={
                    fetching ? "Refreshing time entries" : "Refresh time entries"
                  }
                  title="Refresh"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <IconRefresh
                    className={`h-5 w-5 ${fetching ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => openSidePanel("goal")}
                  aria-label="View goals"
                  title="Goals"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <IconTarget className="h-4 w-4" />
                  Goals
                </button>
                <button
                  type="button"
                  onClick={() => openSidePanel("project")}
                  aria-label="View projects"
                  title="Projects"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <IconFolder className="h-4 w-4" />
                  Projects
                </button>
                {!token ? (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Sign in to load entries from the server.
                  </span>
                ) : null}
              </div>
            }
          />

          {entries.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No entries yet. Start a goal or project with the time tracker, then stop to
              record a session.
            </p>
          ) : (
            <>
            <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
              {dayBuckets.map((day) => {
                const subjectGroups = groupDayItemsBySubject(day.items);
                const projectGroups = subjectGroups.filter(
                  (g) => g.kind === "project"
                );
                const goalGroups = subjectGroups.filter(
                  (g) => g.kind === "goal"
                );

                const renderGroupLi = (g: SubjectGroup) => {
                  const ek = expandKey(day.dayKey, g.groupKey);
                  const isOpen = expanded[ek] ?? false;
                  const n = g.entries.length;
                  return (
                    <li
                      key={g.groupKey}
                      className="min-w-0 w-full overflow-hidden bg-white dark:bg-zinc-900"
                    >
                            <div className="flex items-stretch">
                              <button
                                type="button"
                                onClick={() => toggleGroup(day.dayKey, g.groupKey)}
                                aria-expanded={isOpen}
                                aria-controls={`${ek}-panel`}
                                id={`${ek}-expand`}
                                aria-label={
                                  isOpen ? "Collapse sessions" : "Expand sessions"
                                }
                                className="flex shrink-0 items-center border-r border-zinc-200 px-3 py-3 text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/80"
                              >
                                <svg
                                  className={`h-4 w-4 transition-transform dark:text-zinc-400 ${
                                    isOpen ? "rotate-90" : ""
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                              <div className="flex min-w-0 flex-1 items-center gap-1 px-3 py-2 transition-colors hover:bg-zinc-50 sm:gap-2 sm:px-4 sm:py-3 dark:hover:bg-zinc-800/80">
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(day.dayKey, g.groupKey)}
                                  aria-expanded={isOpen}
                                  aria-controls={`${ek}-panel`}
                                  className="min-w-0 flex-1 overflow-hidden text-left"
                                >
                                  <span className="block truncate">
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                      {g.name}
                                    </span>
                                    <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                                      ({n})
                                    </span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const first = g.entries[0];
                                    if (!first) return;
                                    const id =
                                      typeof first.subjectId === "string"
                                        ? first.subjectId
                                        : "";
                                    const notes =
                                      typeof first.description === "string"
                                        ? first.description
                                        : "";
                                    emitTrackerPreset({
                                      kind: g.kind,
                                      subjectId: id,
                                      subjectName: g.name,
                                      autoStart: true,
                                      description: notes,
                                      ...(g.kind === "project"
                                        ? {
                                            parentGoalId:
                                              first.parentGoalId ?? null,
                                            parentGoalName:
                                              first.parentGoalName ?? null,
                                          }
                                        : {}),
                                    });
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }}
                                  aria-label={
                                    g.kind === "project"
                                      ? `Start tracking project ${g.name}`
                                      : `Start tracking goal ${g.name}`
                                  }
                                  title={
                                    g.kind === "project"
                                      ? "Start tracking this project"
                                      : "Start tracking this goal"
                                  }
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                >
                                  <IconPlay className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="flex shrink-0 items-center border-l border-zinc-200 px-3 py-3 dark:border-zinc-800">
                                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                                  {formatDurationMs(g.totalMs)}
                                </span>
                              </div>
                            </div>
                            {isOpen ? (
                              <div
                                id={`${ek}-panel`}
                                role="region"
                                aria-labelledby={`${ek}-expand`}
                                className="border-t border-zinc-200 dark:border-zinc-800"
                              >
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[400px] border-collapse text-left text-sm">
                                    <thead>
                                      <tr className="bg-zinc-50 text-xs dark:bg-zinc-800/50">
                                        <th className="px-4 py-2 font-semibold text-zinc-600 dark:text-zinc-300">
                                          Started
                                        </th>
                                        <th className="px-4 py-2 font-semibold text-zinc-600 dark:text-zinc-300">
                                          Ended
                                        </th>
                                        <th className="px-4 py-2 font-semibold text-zinc-600 dark:text-zinc-300">
                                          Duration
                                        </th>
                                        <th className="px-4 py-2 font-semibold text-zinc-600 dark:text-zinc-300">
                                          Notes
                                        </th>
                                        <th className="w-14 px-2 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                          <span className="sr-only">Actions</span>
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {g.entries.map((e) => (
                                        <tr
                                          key={e.id}
                                          className="border-t border-zinc-100 dark:border-zinc-800"
                                        >
                                          <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                                            {formatTimeOnly(e.startedAt)}
                                          </td>
                                          <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                                            {formatTimeOnly(e.endedAt)}
                                          </td>
                                          <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                            {formatDurationMs(e.durationMs)}
                                          </td>
                                          <td className="max-w-56 truncate px-4 py-2 text-zinc-600 dark:text-zinc-400">
                                            {e.description || "-"}
                                          </td>
                                          <td className="w-14 align-middle px-2 py-1">
                                            <TimeEntryRowMenu
                                              disabled={!token || entryActionBusy}
                                              onEdit={() => setEditingEntry(e)}
                                              onDuplicate={() => void handleDuplicateEntry(e)}
                                              onDeleteClick={() => setDeleteTarget(e)}
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : null}
                    </li>
                  );
                };

                return (
                  <section key={day.dayKey} className="min-w-0">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <h2 className="flex items-baseline justify-between gap-2 text-lg font-semibold">
                        <span className="text-indigo-700 dark:text-indigo-400">
                          {day.title}
                        </span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {formatDurationMs(day.totalMs)}
                        </span>
                      </h2>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start sm:gap-4">
                      {projectGroups.length > 0 ? (
                        <ul
                          role="list"
                          className="flex min-w-0 flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
                          aria-label="Projects"
                        >
                          {projectGroups.map(renderGroupLi)}
                        </ul>
                      ) : null}
                      {goalGroups.length > 0 ? (
                        <ul
                          role="list"
                          className="flex min-w-0 flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
                          aria-label="Goals"
                        >
                          {goalGroups.map(renderGroupLi)}
                        </ul>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="mt-8 flex justify-center sm:justify-start">
              <button
                type="button"
                disabled={
                  !token ||
                  fetchingMore ||
                  !hasMoreOlder ||
                  entries.length === 0
                }
                onClick={() => void onLoadMoreFromServer()}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                {fetchingMore ? "Loading…" : "Load more"}
              </button>
            </div>

            <Dialog
              isOpen={editingEntry != null}
              onClose={() => {
                if (!entryActionBusy) {
                  setEditTimeRangeError(null);
                  setEditingEntry(null);
                }
              }}
              title="Edit time entry"
              size="md"
            >
              <div className="flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="edit-entry-started"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Started
                  </label>
                  <input
                    id="edit-entry-started"
                    type="datetime-local"
                    step={1}
                    value={editStarted}
                    onChange={(ev) => setEditStarted(ev.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-entry-ended"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Ended
                  </label>
                  <input
                    id="edit-entry-ended"
                    type="datetime-local"
                    step={1}
                    value={editEnded}
                    onChange={(ev) => setEditEnded(ev.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-entry-notes"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Notes
                  </label>
                  <textarea
                    id="edit-entry-notes"
                    rows={3}
                    value={editDescription}
                    onChange={(ev) => setEditDescription(ev.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={entryActionBusy}
                    onClick={() => {
                      setEditTimeRangeError(null);
                      setEditingEntry(null);
                    }}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={entryActionBusy}
                    onClick={() => void saveEditEntry()}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white dark:bg-emerald-600"
                  >
                    Save
                  </button>
                </div>
              </div>
            </Dialog>

            <Dialog
              isOpen={editTimeRangeError != null}
              onClose={() => setEditTimeRangeError(null)}
              title="Invalid times"
              size="sm"
            >
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {editTimeRangeError}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditTimeRangeError(null)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white dark:bg-emerald-600"
                >
                  OK
                </button>
              </div>
            </Dialog>

            <Dialog
              isOpen={deleteTarget != null}
              onClose={() => {
                if (!entryActionBusy) setDeleteTarget(null);
              }}
              title="Delete time entry"
              size="sm"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Delete this session permanently? This cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={entryActionBusy}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={entryActionBusy}
                  onClick={() => void confirmDeleteEntry()}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white dark:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </Dialog>
            </>
          )}

          <SubjectSidePanel
            open={sidePanelOpen}
            kind={sidePanelKind}
            entries={entries}
            onClose={() => setSidePanelOpen(false)}
            onStartTracking={(id, name, parentGoalId, parentGoalName) =>
              startTrackingSubject(
                sidePanelKind,
                id,
                name,
                parentGoalId,
                parentGoalName
              )
            }
          />
        </div>
  );
});
