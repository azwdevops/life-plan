"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RightDrawer } from "@/components/RightDrawer";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getYoutubeAccounts,
  getYoutubePostingTimes,
  getYoutubeUploadLogs,
  upsertYoutubePostingTime,
  upsertYoutubeUploadLog,
  type YoutubeChannel,
  type YoutubeDayOfWeek,
  type YoutubePostingTime,
} from "@/lib/api/youtube";
import { groupAccounts } from "./YoutubePanel";

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h5M20 20v-5h-5M4.5 9a7.5 7.5 0 0113-4.5L20 7M19.5 15a7.5 7.5 0 01-13 4.5L4 17"
      />
    </svg>
  );
}

const DAYS: { key: YoutubeDayOfWeek; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

// Date.getDay(): Sunday=0..Saturday=6. DAYS/weeks here are Monday-first, so shift by 6.
function todayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

function startOfWeek(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function dateToStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayDateStr(): string {
  return dateToStr(new Date());
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

// Backend sends time-of-day as "HH:MM:SS" - truncate to "HH:MM" for <input type="time">.
function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

function formatTime12h(value: string | null): string {
  const hhmm = toInputTime(value);
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Only meaningful when the selected day actually resolves to today's real
// calendar date - "is now inside this channel's posting window" drives the
// upload-now recommendation highlight. Handles a window that wraps past
// midnight (e.g. 23:00-01:00).
function isNowInRange(isToday: boolean, start: string | null, end: string | null): boolean {
  if (!start || !end || !isToday) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = toMinutes(toInputTime(start));
  const endMin = toMinutes(toInputTime(end));
  if (startMin === endMin) return false;
  return startMin < endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin;
}

// Add/edit control for the channel's posting window - two real time pickers
// (not free text) so the start/end can be compared against the current clock
// time for the "upload now?" recommendation highlight.
function TimeRangeField({
  startTime,
  endTime,
  onSave,
}: {
  startTime: string | null;
  endTime: string | null;
  onSave: (startTime: string, endTime: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftStart, setDraftStart] = useState(toInputTime(startTime));
  const [draftEnd, setDraftEnd] = useState(toInputTime(endTime));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraftStart(toInputTime(startTime));
    setDraftEnd(toInputTime(endTime));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!draftStart || !draftEnd) {
      setError("Set both start and end.");
      return;
    }
    if (draftEnd <= draftStart) {
      setError("End time must be after start time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draftStart, draftEnd);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="time"
          value={draftStart}
          onChange={(e) => setDraftStart(e.target.value)}
          autoFocus
          className="min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <span className="text-xs text-zinc-400">–</span>
        <input
          type="time"
          value={draftEnd}
          onChange={(e) => setDraftEnd(e.target.value)}
          className="min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
        >
          Cancel
        </button>
        {error && <p className="shrink-0 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return startTime && endTime ? (
    <button
      type="button"
      onClick={startEdit}
      className="truncate text-xs text-zinc-600 hover:underline dark:text-zinc-300"
    >
      {formatTime12h(startTime)} – {formatTime12h(endTime)}
    </button>
  ) : (
    <button
      type="button"
      onClick={startEdit}
      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
    >
      + Add time
    </button>
  );
}

const AUTOSAVE_DEBOUNCE_MS = 3000;

// Always-visible number input that autosaves itself after the user stops
// changing it (typing or clicking the spinner arrows) for AUTOSAVE_DEBOUNCE_MS,
// rather than requiring an explicit Save click like the time-range field.
function VideosUploadedField({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (count: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value != null ? String(value) : "");
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const scheduleSave = (raw: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const trimmed = raw.trim();
      if (trimmed === "") return;
      const count = Number(trimmed);
      if (!Number.isFinite(count) || count < 0) {
        setError("Invalid count.");
        return;
      }
      setSaving(true);
      setError(null);
      onSave(Math.round(count))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to save."))
        .finally(() => setSaving(false));
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Uploaded</span>
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          scheduleSave(e.target.value);
        }}
        placeholder="0"
        className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {saving && <span className="text-xs text-zinc-400">saving…</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

function ChannelPostingRow({
  channel,
  dayKey,
  date,
  isToday,
  scheduleEntry,
  uploadCount,
  token,
}: {
  channel: YoutubeChannel;
  dayKey: YoutubeDayOfWeek;
  date: string;
  isToday: boolean;
  scheduleEntry: YoutubePostingTime | undefined;
  uploadCount: number;
  token: string;
}) {
  const queryClient = useQueryClient();

  const saveTimeRange = async (startTime: string, endTime: string) => {
    await upsertYoutubePostingTime(token, channel.id, dayKey, { start_time: startTime, end_time: endTime });
    await queryClient.invalidateQueries({ queryKey: ["youtube-posting-times", token, dayKey] });
  };

  const saveVideosUploaded = async (count: number) => {
    await upsertYoutubeUploadLog(token, channel.id, date, count);
    await queryClient.invalidateQueries({ queryKey: ["youtube-upload-logs", token, date] });
  };

  const uploadedOnDate = uploadCount > 0;
  const isUploadTimeNow = isNowInRange(isToday, scheduleEntry?.start_time ?? null, scheduleEntry?.end_time ?? null);
  const rowHighlightClass = uploadedOnDate
    ? "bg-green-300 dark:bg-green-600/50"
    : isUploadTimeNow
      ? "bg-yellow-300 dark:bg-yellow-500/50"
      : "";

  return (
    <div className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${rowHighlightClass}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {channel.thumbnail_url ? (
          <img src={channel.thumbnail_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        )}
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{channel.title}</p>
        {uploadedOnDate ? (
          <span className="shrink-0 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-green-400 dark:text-green-950">
            Uploaded
          </span>
        ) : isUploadTimeNow ? (
          <span className="shrink-0 rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-yellow-400 dark:text-yellow-950">
            Upload now
          </span>
        ) : null}
      </div>
      <div className="shrink-0">
        <TimeRangeField
          startTime={scheduleEntry?.start_time ?? null}
          endTime={scheduleEntry?.end_time ?? null}
          onSave={saveTimeRange}
        />
      </div>
      <VideosUploadedField value={uploadCount} onSave={saveVideosUploaded} />
    </div>
  );
}

export function ChannelsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => todayIndex());
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [onlyZeroUploads, setOnlyZeroUploads] = useState(false);
  const [onlyUploadNow, setOnlyUploadNow] = useState(false);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const selectedDate = useMemo(() => dateToStr(addDays(weekStart, selectedDayIndex)), [weekStart, selectedDayIndex]);
  const isToday = selectedDate === todayDateStr();
  const dayKey = DAYS[selectedDayIndex].key;

  const jumpToToday = () => {
    setWeekOffset(0);
    setSelectedDayIndex(todayIndex());
  };

  const accountsQuery = useQuery({
    queryKey: ["youtube-accounts", token],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getYoutubeAccounts(token);
    },
    enabled: !!token && open,
  });

  const postingTimesQuery = useQuery({
    queryKey: ["youtube-posting-times", token, dayKey],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getYoutubePostingTimes(token, dayKey);
    },
    enabled: !!token && open,
  });

  const uploadLogsQuery = useQuery({
    queryKey: ["youtube-upload-logs", token, selectedDate],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getYoutubeUploadLogs(token, selectedDate);
    },
    enabled: !!token && open,
  });

  const entriesByChannel = useMemo(() => {
    const map = new Map<number, YoutubePostingTime>();
    for (const entry of postingTimesQuery.data ?? []) map.set(entry.channel_id, entry);
    return map;
  }, [postingTimesQuery.data]);

  const uploadCountByChannel = useMemo(() => {
    const map = new Map<number, number>();
    for (const log of uploadLogsQuery.data ?? []) map.set(log.channel_id, log.videos_uploaded_count);
    return map;
  }, [uploadLogsQuery.data]);

  const groups = useMemo(() => groupAccounts(accountsQuery.data ?? []), [accountsQuery.data]);

  const namedGroupLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const group of groups) {
      if (group.label && group.accounts.length > 1) labels.add(group.label);
    }
    return Array.from(labels).sort();
  }, [groups]);

  const visibleGroups = useMemo(() => {
    return groups
      .filter((group) => groupFilter === "all" || group.label === groupFilter)
      .map((group) => {
        const channels = group.accounts.flatMap((account) => account.channels);
        return {
          ...group,
          channels: channels.filter((c) => {
            const uploadCount = uploadCountByChannel.get(c.id) ?? 0;
            const scheduleEntry = entriesByChannel.get(c.id);
            if (onlyZeroUploads && uploadCount !== 0) return false;
            if (
              onlyUploadNow &&
              !isNowInRange(isToday, scheduleEntry?.start_time ?? null, scheduleEntry?.end_time ?? null)
            ) {
              return false;
            }
            return true;
          }),
        };
      })
      .filter((group) => group.channels.length > 0);
  }, [groups, groupFilter, onlyZeroUploads, onlyUploadNow, isToday, entriesByChannel, uploadCountByChannel]);

  const headerActions = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          aria-label="Previous week"
          className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ‹
        </button>
        <span className="min-w-[7.5rem] text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {formatWeekRange(weekStart)}
        </span>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          aria-label="Next week"
          className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ›
        </button>
        {!isToday && (
          <button
            type="button"
            onClick={jumpToToday}
            className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
          >
            Today
          </button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {DAYS.map((d, index) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setSelectedDayIndex(index)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              index === selectedDayIndex
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <select
        value={groupFilter}
        onChange={(e) => setGroupFilter(e.target.value)}
        className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <option value="all">All groups</option>
        {namedGroupLabels.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={onlyZeroUploads}
          onChange={(e) => setOnlyZeroUploads(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
        />
        0 uploads
      </label>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={onlyUploadNow}
          onChange={(e) => setOnlyUploadNow(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
        />
        Upload now
      </label>
      <button
        type="button"
        onClick={() => {
          void accountsQuery.refetch();
          void postingTimesQuery.refetch();
          void uploadLogsQuery.refetch();
        }}
        disabled={accountsQuery.isFetching || postingTimesQuery.isFetching || uploadLogsQuery.isFetching}
        aria-label="Refresh"
        title="Refresh - recheck which channels are due now"
        className="shrink-0 rounded-md border border-zinc-300 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <IconRefresh
          className={`h-3.5 w-3.5 ${
            accountsQuery.isFetching || postingTimesQuery.isFetching || uploadLogsQuery.isFetching
              ? "animate-spin"
              : ""
          }`}
        />
      </button>
    </div>
  );

  return (
    <RightDrawer open={open} onClose={onClose} title="Channels" width="5xl" actions={headerActions}>
      <div className="space-y-4">
        {!token ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Log in to view channels.</p>
        ) : accountsQuery.isLoading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading channels…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No connected channels yet.</p>
        ) : visibleGroups.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No channels match the current filters.</p>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                {group.label && group.accounts.length > 1 && (
                  <h3 className="border-b border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300">
                    {group.label}
                  </h3>
                )}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {group.channels.map((channel) => (
                    <ChannelPostingRow
                      key={channel.id}
                      channel={channel}
                      dayKey={dayKey}
                      date={selectedDate}
                      isToday={isToday}
                      scheduleEntry={entriesByChannel.get(channel.id)}
                      uploadCount={uploadCountByChannel.get(channel.id) ?? 0}
                      token={token}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RightDrawer>
  );
}
