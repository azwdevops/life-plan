"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { HeaderTimeTracker } from "@/components/HeaderTimeTracker";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  TIME_TRACKER_ENTRIES_UPDATED_EVENT,
  formatDurationMs,
  type TimeTrackerEntry,
  type TimeTrackerKind,
} from "@/lib/time-tracker-storage";
import { emitTrackerPreset } from "@/lib/time-tracker-preset-bridge";
import { listRecentTimeEntries, listTimeEntries } from "@/lib/api/time-entries";

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

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ordinalDay(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatLongDateFromDayKey(dayKey: string): string {
  const [Y, M, D] = dayKey.split("-").map(Number);
  if (!Y || !M || !D) return dayKey;
  const d = new Date(Y, M - 1, D);
  const month = d.toLocaleString(undefined, { month: "long" });
  return `${ordinalDay(d.getDate())} ${month} ${d.getFullYear()}`;
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

function bucketEntriesByStartedDay(
  entries: TimeTrackerEntry[],
  now: Date
): { dayKey: string; title: string; items: TimeTrackerEntry[] }[] {
  const dayMap = new Map<string, TimeTrackerEntry[]>();
  for (const e of entries) {
    const k = localDateKey(new Date(e.startedAt));
    const list = dayMap.get(k);
    if (list) list.push(e);
    else dayMap.set(k, [e]);
  }
  const keys = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((dayKey) => ({
    dayKey,
    title: daySectionTitle(dayKey, now),
    items: dayMap.get(dayKey)!,
  }));
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

export default function TimeTrackingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, token } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const [entries, setEntries] = useState<TimeTrackerEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const showMobileTimeTracker = useMediaQuery("(max-width: 767px)");

  const dayBuckets = useMemo(
    () => bucketEntriesByStartedDay(entries, new Date()),
    [entries]
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

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

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950"
      suppressHydrationWarning
    >
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isLoggedIn={isAuthenticated}
      />
      <main
        className={`flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
        }`}
      >
        <div className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col">
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
          <div className="flex flex-wrap items-center gap-2 gap-y-2">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Tracked time
            </h1>
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
            {!token ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Sign in to load entries from the server.
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            By day, then goal or project. Times are clock times for that day
            only.
          </p>
          {fetchError ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {fetchError}
            </p>
          ) : null}

          {entries.length === 0 ? (
            <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
              No entries yet. Start a goal or project with the time tracker, then stop to
              record a session.
            </p>
          ) : (
            <>
            <div className="mt-8 flex min-h-0 flex-1 flex-col gap-10">
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
                      className="min-w-0 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
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
                                  <table className="w-full min-w-[360px] border-collapse text-left text-sm">
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
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {day.title}
                    </h2>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start sm:gap-4">
                      <ul
                        role="list"
                        className="flex min-w-0 flex-col gap-3"
                        aria-label="Projects"
                      >
                        {projectGroups.map(renderGroupLi)}
                      </ul>
                      <ul
                        role="list"
                        className="flex min-w-0 flex-col gap-3"
                        aria-label="Goals"
                      >
                        {goalGroups.map(renderGroupLi)}
                      </ul>
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
