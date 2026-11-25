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
  TIME_TRACKER_PALETTE,
  formatDurationMs,
  type TimeTrackerEntry,
  type TimeTrackerKind,
} from "@/lib/time-tracker-storage";
import { emitTrackerPreset } from "@/lib/time-tracker-preset-bridge";
import {
  backfillTimeEntryCategories,
  deleteTimeEntry,
  duplicateTimeEntry,
  getEarliestTimeEntry,
  listRecentTimeEntries,
  listTimeEntries,
  updateTimeEntry,
} from "@/lib/api/time-entries";
import {
  type TimeTrackerGoal,
  type TimeTrackerProject,
  type TimeTrackerCategory,
} from "@/lib/time-tracker-storage";
import {
  useTimeTrackerGoals,
  useTimeTrackerProjects,
  useTimeTrackerCategories,
  useUploadLocalTimeTrackerData,
  useDeleteTimeTrackerGoal,
  useDeleteTimeTrackerProject,
  useDeleteTimeTrackerCategory,
  useUpdateTimeTrackerProject,
} from "@/lib/hooks/use-time-tracker-subjects";
import { CreateGoalModal } from "@/components/time-tracker/CreateGoalModal";
import { CreateProjectModal } from "@/components/time-tracker/CreateProjectModal";
import { CreateCategoryModal } from "@/components/time-tracker/CreateCategoryModal";
import { SearchableSelectPicker } from "@/components/time-tracker/SearchableSelectPicker";
import { TimeTrackingCharts } from "@/components/productivity/TimeTrackingCharts";

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
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
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M7 9l5-5 5 5M12 4v12"
      />
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

function IconTag({ className }: { className?: string }) {
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
        d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24L4 3a1 1 0 00-1 1l.24 5.59a2 2 0 00.58 1.41l9.59 9.59a2 2 0 002.83 0l4.35-4.35a2 2 0 000-2.83z"
      />
      <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
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

function subjectFk(e: TimeTrackerEntry): number | null {
  return e.kind === "goal" ? e.goalId : e.projectId;
}

/**
 * Groups entries into one row per project/goal. A resolved FK
 * (`goalId`/`projectId`) is the authoritative "same project" signal - two
 * entries sharing it always merge, even across a rename, since the FK
 * doesn't change when the name does. Entries with no resolved FK (legacy
 * rows from before projects had real backend ids) fall back to matching by
 * name, merging into whichever group - FK-based or name-only - already
 * covers that name, instead of splitting into a separate, duplicate row for
 * what's really the same project (e.g. entries tracked before vs. after it
 * was assigned a category, which otherwise ended up on different legacy vs.
 * resolved ids for the same underlying project).
 */
function groupDayItemsBySubject(dayItems: TimeTrackerEntry[]): SubjectGroup[] {
  const map = new Map<string, TimeTrackerEntry[]>();
  const fkGroupKeyByName = new Map<string, string>();

  for (const e of dayItems) {
    const fk = subjectFk(e);
    if (fk == null) continue;
    const k = `${e.kind}:fk:${fk}`;
    const nameKey = `${e.kind}:${e.subjectName.trim().toLowerCase()}`;
    if (!fkGroupKeyByName.has(nameKey)) fkGroupKeyByName.set(nameKey, k);
    const list = map.get(k);
    if (list) list.push(e);
    else map.set(k, [e]);
  }

  for (const e of dayItems) {
    if (subjectFk(e) != null) continue;
    const nameKey = `${e.kind}:${e.subjectName.trim().toLowerCase()}`;
    const k = fkGroupKeyByName.get(nameKey) ?? `${e.kind}:name:${nameKey}`;
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

type CategoryBreakdownRow = {
  categoryId: string | null;
  name: string;
  totalMs: number;
};

const UNCATEGORIZED_LABEL = "Uncategorized";

/**
 * Groups by each entry's own frozen categoryId/categoryName (set at
 * tracking time, never re-resolved) rather than the *current* project list
 * - so reclassifying a project's category later doesn't retroactively
 * rewrite past days' breakdowns.
 */
function categoryBreakdownForDay(dayItems: TimeTrackerEntry[]): CategoryBreakdownRow[] {
  const totals = new Map<string, number>();
  const namesByKey = new Map<string, string>();
  for (const e of dayItems) {
    if (e.kind !== "project") continue;
    const key = e.categoryId != null ? String(e.categoryId) : "__uncategorized__";
    totals.set(key, (totals.get(key) ?? 0) + e.durationMs);
    if (!namesByKey.has(key)) {
      namesByKey.set(key, e.categoryName ?? UNCATEGORIZED_LABEL);
    }
  }
  const rows: CategoryBreakdownRow[] = [];
  for (const [key, totalMs] of totals) {
    rows.push({
      categoryId: key === "__uncategorized__" ? null : key,
      name: namesByKey.get(key) ?? UNCATEGORIZED_LABEL,
      totalMs,
    });
  }
  rows.sort((a, b) => b.totalMs - a.totalMs);
  return rows;
}

type CategoryConstituentRow = {
  key: string;
  name: string;
  totalMs: number;
};

/**
 * What a category breakdown row is made of: each project tracked under it
 * that day, by its own frozen categoryId (same matching rule as
 * categoryBreakdownForDay above) grouped by project - FK first, name as a
 * fallback for legacy rows without one, mirroring subjectFk's use elsewhere.
 */
function categoryConstituentsForDay(
  dayItems: TimeTrackerEntry[],
  categoryId: string | null
): CategoryConstituentRow[] {
  const matches = dayItems.filter((e) => {
    if (e.kind !== "project") return false;
    const key = e.categoryId != null ? String(e.categoryId) : null;
    return key === categoryId;
  });

  const map = new Map<string, CategoryConstituentRow>();
  const fkKeyByName = new Map<string, string>();
  const addTo = (key: string, row: TimeTrackerEntry) => {
    const prev = map.get(key);
    if (prev) {
      prev.totalMs += row.durationMs;
    } else {
      map.set(key, { key, name: row.subjectName, totalMs: row.durationMs });
    }
  };

  for (const row of matches) {
    const fk = subjectFk(row);
    if (fk == null) continue;
    const key = `project:fk:${fk}`;
    const nameKey = row.subjectName.trim().toLowerCase();
    if (!fkKeyByName.has(nameKey)) fkKeyByName.set(nameKey, key);
    addTo(key, row);
  }
  for (const row of matches) {
    if (subjectFk(row) != null) continue;
    const nameKey = row.subjectName.trim().toLowerCase();
    const key = fkKeyByName.get(nameKey) ?? `project:name:${nameKey}`;
    addTo(key, row);
  }

  return Array.from(map.values()).sort((a, b) => b.totalMs - a.totalMs);
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
  const { token } = useAuth();
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
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const goalsQuery = useTimeTrackerGoals();
  const projectsQuery = useTimeTrackerProjects();
  const categoriesQuery = useTimeTrackerCategories();
  const uploadLocalData = useUploadLocalTimeTrackerData();
  const deleteGoal = useDeleteTimeTrackerGoal();
  const deleteProject = useDeleteTimeTrackerProject();
  const updateProject = useUpdateTimeTrackerProject();
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [categorizeMode, setCategorizeMode] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [savingCategorize, setSavingCategorize] = useState(false);
  const [categorizeError, setCategorizeError] = useState<string | null>(null);
  const [categorizeCategoryModalOpen, setCategorizeCategoryModalOpen] = useState(false);
  const [categorizeCategoryModalInitial, setCategorizeCategoryModalInitial] = useState("");
  const [categorizeTargetProjectId, setCategorizeTargetProjectId] = useState<string | null>(
    null
  );
  const goals = goalsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const categoryPickerItems = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name, matchKey: c.name })),
    [categories]
  );

  const enterCategorizeMode = useCallback(() => {
    setCategoryDrafts(
      Object.fromEntries(projects.map((p) => [p.id, p.categoryId ?? ""]))
    );
    setCategorizeError(null);
    setCategorizeMode(true);
  }, [projects]);

  const cancelCategorizeMode = useCallback(() => {
    setCategorizeMode(false);
    setCategoryDrafts({});
    setCategorizeError(null);
  }, []);

  const saveCategorizeMode = useCallback(async () => {
    const changed = projects.filter(
      (p) => (categoryDrafts[p.id] ?? "") !== (p.categoryId ?? "")
    );
    if (changed.length === 0) {
      setCategorizeMode(false);
      return;
    }
    setSavingCategorize(true);
    setCategorizeError(null);
    try {
      await Promise.all(
        changed.map((p) => {
          const draft = categoryDrafts[p.id] ?? "";
          return updateProject.mutateAsync({
            id: p.id,
            body: { category_id: draft === "" ? null : Number(draft) },
          });
        })
      );
      setCategorizeMode(false);
      setCategoryDrafts({});
    } catch (err) {
      setCategorizeError(
        err instanceof Error ? err.message : "Failed to save categories"
      );
    } finally {
      setSavingCategorize(false);
    }
  }, [projects, categoryDrafts, updateProject]);

  useEffect(() => {
    if (!open) {
      setCategorizeMode(false);
      setCategoryDrafts({});
      setCategorizeError(null);
    }
  }, [open]);

  const closeSubjectModal = useCallback(() => {
    setCreateModalOpen(false);
    setEditTarget(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      if (kind === "goal") {
        await deleteGoal.mutateAsync(deleteTarget.id);
      } else {
        await deleteProject.mutateAsync(deleteTarget.id);
      }
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, kind, deleteGoal, deleteProject]);

  if (kind !== searchKind) {
    setSearchKind(kind);
    setSearch("");
    setCategorizeMode(false);
    setCategoryDrafts({});
    setCategorizeError(null);
  }

  const handleUploadLocalData = useCallback(async () => {
    setUploading(true);
    setUploadMessage(null);
    try {
      const result = await uploadLocalData();
      setUploadMessage(
        `Uploaded ${result.goalsAdded} goal(s), ${result.projectsAdded} project(s), ${result.categoriesAdded} category(ies) from this browser.`
      );
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [uploadLocalData]);

  const handleBackfillCategories = useCallback(async () => {
    if (!token) return;
    setBackfilling(true);
    setBackfillMessage(null);
    try {
      const result = await backfillTimeEntryCategories(token);
      setBackfillMessage(
        result.updatedEntries === 0 && result.updatedActiveSessions === 0
          ? "Nothing to backfill - every entry already has a category or its project is uncategorized."
          : `Backfilled ${result.updatedEntries} entry(ies)${
              result.updatedActiveSessions > 0
                ? ` and ${result.updatedActiveSessions} running session(s)`
                : ""
            } across ${result.projectsChecked} categorized project(s).`
      );
      bumpTimeEntriesEvent();
    } catch (err) {
      setBackfillMessage(err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }, [token]);

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
        width="4xl"
        actions={
          <>
            {!categorizeMode ? (
              <button
                type="button"
                onClick={() => void handleUploadLocalData()}
                disabled={uploading}
                aria-label="Upload local data"
                title="Upload any Goals/Projects/Categories sitting only in this browser's local storage"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <IconUpload className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
              </button>
            ) : null}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${kind === "goal" ? "goals" : "projects"}…`}
              aria-label={`Search ${kind === "goal" ? "goals" : "projects"}`}
              className="w-full min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {kind === "project" ? (
              categorizeMode ? (
                <>
                  <button
                    type="button"
                    onClick={cancelCategorizeMode}
                    disabled={savingCategorize}
                    className="inline-flex h-8 shrink-0 items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveCategorizeMode()}
                    disabled={savingCategorize}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    {savingCategorize ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={enterCategorizeMode}
                    title="Assign categories to multiple projects at once"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <IconTag className="h-4 w-4" />
                    Categorize
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBackfillCategories()}
                    disabled={backfilling}
                    title="Apply each categorized project's category to its own past entries tracked before it had one"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <IconUpload
                      className={`h-4 w-4 rotate-180 ${backfilling ? "animate-pulse" : ""}`}
                    />
                    {backfilling ? "Backfilling…" : "Backfill categories"}
                  </button>
                </>
              )
            ) : null}
            {!categorizeMode ? (
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
            ) : null}
          </>
        }
      >
      {categorizeError ? (
        <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {categorizeError}
        </p>
      ) : null}
      {backfillMessage ? (
        <p className="mb-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {backfillMessage}
        </p>
      ) : null}
      {uploadMessage ? (
        <p className="mb-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {uploadMessage}
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
                {kind === "project" && categorizeMode ? (
                  <div className="w-48 shrink-0">
                    <SearchableSelectPicker
                      instanceId={`categorize-category-${item.id}`}
                      items={categoryPickerItems}
                      valueLabel={
                        categoryDrafts[item.id]
                          ? categories.find((c) => c.id === categoryDrafts[item.id])
                              ?.name ?? ""
                          : ""
                      }
                      triggerPlaceholder="No category"
                      onSelectExisting={(id) =>
                        setCategoryDrafts((prev) => ({ ...prev, [item.id]: id }))
                      }
                      onRequestCreate={(suggested) => {
                        setCategorizeTargetProjectId(item.id);
                        setCategorizeCategoryModalInitial(suggested);
                        setCategorizeCategoryModalOpen(true);
                      }}
                      allowCreate
                      noneOptionLabel="No category"
                      onSelectNone={() =>
                        setCategoryDrafts((prev) => ({ ...prev, [item.id]: "" }))
                      }
                      formatCreateLabel={(t) => `Create category "${t}"`}
                      triggerClassName="rounded-lg py-1.5 text-sm"
                      panelZClass="z-[60]"
                      className="w-full"
                    />
                  </div>
                ) : (
                  <>
                    {kind === "project" ? (
                      <div className="w-40 shrink-0 truncate">
                        {(item as TimeTrackerProject).categoryId ? (
                          <span className="inline-flex max-w-full items-center truncate rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {categories.find(
                              (c) =>
                                c.id === (item as TimeTrackerProject).categoryId
                            )?.name ?? "—"}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">
                            No category
                          </span>
                        )}
                      </div>
                    ) : null}
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
                  </>
                )}
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
          categories={categories}
          refreshGoals={() => {}}
          editTarget={editTarget as TimeTrackerProject | null}
          onClose={closeSubjectModal}
          onCreated={closeSubjectModal}
          stackLevel={1}
        />
      )}

      {kind === "project" ? (
        <CreateCategoryModal
          open={categorizeCategoryModalOpen}
          initialName={categorizeCategoryModalInitial}
          categories={categories}
          onClose={() => setCategorizeCategoryModalOpen(false)}
          onCreated={(newCategoryId) => {
            if (categorizeTargetProjectId) {
              setCategoryDrafts((prev) => ({
                ...prev,
                [categorizeTargetProjectId]: newCategoryId,
              }));
            }
            setCategorizeCategoryModalOpen(false);
          }}
          stackLevel={1}
        />
      ) : null}

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

function CategorySidePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TimeTrackerCategory | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<TimeTrackerCategory | null>(
    null
  );
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [search, setSearch] = useState("");
  const categoriesQuery = useTimeTrackerCategories();
  const projectsQuery = useTimeTrackerProjects();
  const deleteCategory = useDeleteTimeTrackerCategory();
  const categories = categoriesQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const closeCategoryModal = useCallback(() => {
    setCreateModalOpen(false);
    setEditTarget(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, deleteCategory]);

  const items = [...categories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <RightDrawer
        open={open}
        onClose={onClose}
        title="Categories"
        width="4xl"
        actions={
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              aria-label="Search categories"
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
              Add category
            </button>
          </>
        }
      >
        {items.length === 0 ? (
          <p className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
            {search.trim()
              ? `No categories match "${search.trim()}".`
              : "No categories yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const projectCount = projects.filter(
                (p) => p.categoryId === item.id
              ).length;
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
                      {projectCount} project{projectCount === 1 ? "" : "s"}
                    </p>
                  </div>
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

      <CreateCategoryModal
        open={createModalOpen}
        initialName=""
        categories={categories}
        editTarget={editTarget}
        onClose={closeCategoryModal}
        onCreated={closeCategoryModal}
        stackLevel={1}
      />

      <Dialog
        isOpen={deleteTarget != null}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        title="Delete category"
        size="sm"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Delete &quot;{deleteTarget?.name}&quot; permanently? This cannot be
          undone. Projects under this category will keep their own time
          entries but lose their link to it.
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
  const [earliestEntryDate, setEarliestEntryDate] = useState<string | null>(
    null
  );
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
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);

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
    if (!token) {
      setEarliestEntryDate(null);
      return;
    }
    let cancelled = false;
    getEarliestTimeEntry(token)
      .then((iso) => {
        if (!cancelled) setEarliestEntryDate(iso ? localDateKey(new Date(iso)) : null);
      })
      .catch(() => {
        /* keep prior bound on transient errors */
      });
    return () => {
      cancelled = true;
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

  const onFetchCustomRange = async (startDayIso: string, endDayIso: string) => {
    if (!token) return;
    const [sy, sm, sd] = startDayIso.split("-").map(Number);
    const [ey, em, ed] = endDayIso.split("-").map(Number);
    const from = new Date(sy, sm - 1, sd).toISOString();
    const toExclusive = new Date(ey, em - 1, ed + 1).toISOString();
    const remote = await listTimeEntries(token, from, toExclusive);
    const merged = sortEntriesDesc(remote);
    setEntries((prev) => replaceEntriesInTimeRange(prev, from, toExclusive, merged));
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
            earliestDate={earliestEntryDate}
            onFetchCustomRange={onFetchCustomRange}
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
                <button
                  type="button"
                  onClick={() => setCategoryPanelOpen(true)}
                  aria-label="View categories"
                  title="Categories"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <IconTag className="h-4 w-4" />
                  Categories
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
                const categoryBreakdown = categoryBreakdownForDay(day.items);
                const categoryBreakdownTotalMs = categoryBreakdown.reduce(
                  (sum, row) => sum + row.totalMs,
                  0
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
                                      goalId: g.kind === "goal" ? first.goalId : null,
                                      projectId:
                                        g.kind === "project" ? first.projectId : null,
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
                              <div className="flex w-24 shrink-0 items-center justify-end border-l border-zinc-200 px-3 py-3 dark:border-zinc-800">
                                <span className="truncate font-mono text-xs text-zinc-600 dark:text-zinc-400">
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
                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start sm:gap-4">
                        {projectGroups.length > 0 ? (
                          <ul
                            role="list"
                            className={`flex min-w-0 flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 ${
                              goalGroups.length === 0 ? "sm:col-span-2" : ""
                            }`}
                            aria-label="Projects"
                          >
                            {projectGroups.map(renderGroupLi)}
                          </ul>
                        ) : null}
                        {goalGroups.length > 0 ? (
                          <ul
                            role="list"
                            className={`flex min-w-0 flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 ${
                              projectGroups.length === 0 ? "sm:col-span-2" : ""
                            }`}
                            aria-label="Goals"
                          >
                            {goalGroups.map(renderGroupLi)}
                          </ul>
                        ) : null}
                      </div>

                      {categoryBreakdown.length > 0 ? (
                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <ul className="flex flex-col gap-1.5">
                            {categoryBreakdown.map((row, idx) => {
                              const rawPct =
                                categoryBreakdownTotalMs > 0
                                  ? (row.totalMs / categoryBreakdownTotalMs) * 100
                                  : 0;
                              const pct = categoryBreakdownTotalMs > 0 ? Math.max(rawPct, 3) : 0;
                              const color =
                                TIME_TRACKER_PALETTE[idx % TIME_TRACKER_PALETTE.length];
                              const groupKey = `category:${row.categoryId ?? "uncategorized"}`;
                              const ek = expandKey(day.dayKey, groupKey);
                              const isOpen = expanded[ek] ?? false;
                              const constituents = isOpen
                                ? categoryConstituentsForDay(day.items, row.categoryId)
                                : [];
                              return (
                                <li
                                  key={row.categoryId ?? "uncategorized"}
                                  className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleGroup(day.dayKey, groupKey)}
                                    aria-expanded={isOpen}
                                    aria-controls={`${ek}-panel`}
                                    className="relative flex w-full items-center gap-2 overflow-hidden px-3 py-2 text-left text-sm"
                                  >
                                    <div
                                      className="absolute inset-y-0 left-0"
                                      style={{ width: `${pct}%`, backgroundColor: color }}
                                    />
                                    <svg
                                      className={`relative h-3.5 w-3.5 shrink-0 transition-transform ${
                                        isOpen ? "rotate-90" : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      viewBox="0 0 24 24"
                                      aria-hidden
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                    <span className="relative flex min-w-0 flex-1 items-center justify-between gap-2">
                                      <span className="truncate font-bold text-zinc-900 dark:text-white">
                                        {row.name}
                                      </span>
                                      <span className="shrink-0 font-mono text-xs font-bold text-zinc-800 dark:text-zinc-100">
                                        {formatDurationMs(row.totalMs)} ·{" "}
                                        <span style={{ color }}>
                                          {Math.round(rawPct)}%
                                        </span>
                                      </span>
                                    </span>
                                  </button>
                                  {isOpen ? (
                                    <ul
                                      id={`${ek}-panel`}
                                      className="flex flex-col divide-y divide-zinc-100 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700"
                                    >
                                      {constituents.length === 0 ? (
                                        <li className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                                          No projects to show.
                                        </li>
                                      ) : (
                                        constituents.map((c) => {
                                          const cPct =
                                            row.totalMs > 0
                                              ? (c.totalMs / row.totalMs) * 100
                                              : 0;
                                          return (
                                            <li
                                              key={c.key}
                                              className="flex items-center justify-between gap-2 px-3 py-1.5 pl-9 text-xs"
                                            >
                                              <span className="truncate text-zinc-700 dark:text-zinc-300">
                                                {c.name}
                                              </span>
                                              <span className="shrink-0 font-mono text-zinc-500 dark:text-zinc-400">
                                                {formatDurationMs(c.totalMs)} ({Math.round(cPct)}%)
                                              </span>
                                            </li>
                                          );
                                        })
                                      )}
                                    </ul>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
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

          <CategorySidePanel
            open={categoryPanelOpen}
            onClose={() => setCategoryPanelOpen(false)}
          />
        </div>
  );
});
