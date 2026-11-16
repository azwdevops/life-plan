"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RightDrawer } from "@/components/RightDrawer";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getYoutubeAccounts,
  getYoutubePostingTimes,
  getYoutubeUploadLogs,
  updateYoutubeChannel,
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

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5v14l11-7-11-7z" />
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

// e.g. "12-oct" - shown under the day abbreviation in each day pill.
function formatDayDate(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short" }).toLowerCase();
  return `${d.getDate()}-${month}`;
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

// Just shows the window and opens the shared EditPostingTimeDrawer on click -
// the actual time pickers used to be squeezed inline into this fixed-width
// column, which is why editing now happens in a right sidebar instead.
function TimeRangeField({
  startTime,
  endTime,
  onEdit,
}: {
  startTime: string | null;
  endTime: string | null;
  onEdit: () => void;
}) {
  return startTime && endTime ? (
    <button
      type="button"
      onClick={onEdit}
      className="truncate text-xs text-zinc-600 hover:underline dark:text-zinc-300"
    >
      {formatTime12h(startTime)} – {formatTime12h(endTime)}
    </button>
  ) : (
    <button type="button" onClick={onEdit} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
      + Add time
    </button>
  );
}

interface EditingTimeTarget {
  id: number;
  name: string;
  startTime: string | null;
  endTime: string | null;
}

// One shared drawer for the whole channel list - editing is keyed off
// whichever channel's "+ Add time"/time-range button was last clicked,
// rather than mounting a drawer per row.
function EditPostingTimeDrawer({
  target,
  onClose,
  onSave,
}: {
  target: EditingTimeTarget | null;
  onClose: () => void;
  onSave: (startTime: string, endTime: string) => Promise<void>;
}) {
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setDraftStart(toInputTime(target.startTime));
    setDraftEnd(toInputTime(target.endTime));
    setError(null);
  }, [target]);

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
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RightDrawer
      open={!!target}
      onClose={onClose}
      title={target ? `Posting time — ${target.name}` : "Posting time"}
      width="sm"
      stackLevel={1}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Start time</label>
            <input
              type="time"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">End time</label>
            <input
              type="time"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </RightDrawer>
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
    <div className="flex w-20 shrink-0 items-center gap-1.5" title="Videos uploaded">
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          scheduleSave(e.target.value);
        }}
        placeholder="0"
        aria-label="Videos uploaded"
        className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {saving && <span className="text-xs text-zinc-400">saving…</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

// One toggle per weekday, always showing all 7 regardless of which day is
// currently selected in the drawer - a channel hidden on the selected day
// (its upload day turned off) would otherwise have no row left to toggle it
// back on from, since the day-filtered list is exactly what hides it.
function UploadDaysToggle({
  channelId,
  entriesByDay,
  token,
}: {
  channelId: number;
  entriesByDay: Partial<Record<YoutubeDayOfWeek, YoutubePostingTime>>;
  token: string;
}) {
  const queryClient = useQueryClient();
  const [savingDay, setSavingDay] = useState<YoutubeDayOfWeek | null>(null);

  const toggleDay = async (day: YoutubeDayOfWeek, current: boolean) => {
    setSavingDay(day);
    try {
      await upsertYoutubePostingTime(token, channelId, day, { is_upload_day: !current });
      await queryClient.invalidateQueries({ queryKey: ["youtube-posting-times", token] });
    } finally {
      setSavingDay(null);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Days</span>
      <div className="flex items-center gap-2">
        {DAYS.map((d, index) => {
          const isUploadDay = entriesByDay[d.key]?.is_upload_day ?? true;
          const saving = savingDay === d.key;
          return (
            <Fragment key={d.key}>
              {index > 0 && <span className="h-4 w-px shrink-0 bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />}
              <button
                type="button"
                title={`${d.label}${isUploadDay ? "" : " (skipped)"}`}
                onClick={() => void toggleDay(d.key, isUploadDay)}
                disabled={saving}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                  isUploadDay
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500"
                } ${saving ? "opacity-50" : ""}`}
              >
                {d.label[0]}
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ChannelPostingRow({
  channel,
  date,
  isToday,
  scheduleEntry,
  entriesByDay,
  uploadCount,
  dayInactive,
  token,
  onEditTime,
}: {
  channel: YoutubeChannel;
  date: string;
  isToday: boolean;
  scheduleEntry: YoutubePostingTime | undefined;
  entriesByDay: Partial<Record<YoutubeDayOfWeek, YoutubePostingTime>>;
  uploadCount: number;
  dayInactive: boolean;
  token: string;
  onEditTime: () => void;
}) {
  const queryClient = useQueryClient();
  const [pausing, setPausing] = useState(false);

  const saveVideosUploaded = async (count: number) => {
    await upsertYoutubeUploadLog(token, channel.id, date, count);
    await queryClient.invalidateQueries({ queryKey: ["youtube-upload-logs", token, date] });
  };

  // Only flips channel.is_paused - never touches the individual
  // YoutubeChannelPostingTime rows, so resuming later restores exactly
  // whatever per-weekday pattern was already set, not "every day on".
  const pauseChannel = async () => {
    setPausing(true);
    try {
      await updateYoutubeChannel(token, channel.id, { is_paused: true });
      await queryClient.invalidateQueries({ queryKey: ["youtube-accounts", token] });
    } finally {
      setPausing(false);
    }
  };

  const uploadedOnDate = uploadCount > 0;
  const isUploadTimeNow = isNowInRange(isToday, scheduleEntry?.start_time ?? null, scheduleEntry?.end_time ?? null);
  const rowHighlightClass = uploadedOnDate
    ? "bg-green-300 dark:bg-green-600/50"
    : !dayInactive && isUploadTimeNow
      ? "bg-yellow-300 dark:bg-yellow-500/50"
      : "";

  // Every column after the title is fixed-width (not flex-wrap), so the same
  // field lines up vertically across every row - e.g. Monday's dot sits at
  // the same x for every channel. The title itself stays flex-1 so it still
  // uses the full available width instead of truncating names needlessly;
  // since every row has the same fixed-width trailing columns, flex-1 still
  // resolves to the same width for every row, so alignment holds either way.
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${rowHighlightClass} ${dayInactive ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {channel.thumbnail_url ? (
          <img src={channel.thumbnail_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        )}
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{channel.title}</p>
      </div>
      <div className="w-28 shrink-0">
        {uploadedOnDate ? (
          <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-green-400 dark:text-green-950">
            Uploaded
          </span>
        ) : dayInactive ? (
          <span className="rounded-full bg-zinc-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200">
            Skipped today
          </span>
        ) : isUploadTimeNow ? (
          <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-yellow-400 dark:text-yellow-950">
            Upload now
          </span>
        ) : null}
      </div>
      <UploadDaysToggle channelId={channel.id} entriesByDay={entriesByDay} token={token} />
      <div className="w-36 shrink-0">
        <TimeRangeField
          startTime={scheduleEntry?.start_time ?? null}
          endTime={scheduleEntry?.end_time ?? null}
          onEdit={onEditTime}
        />
      </div>
      <VideosUploadedField value={uploadCount} onSave={saveVideosUploaded} />
      <button
        type="button"
        onClick={() => void pauseChannel()}
        disabled={pausing}
        aria-label="Pause"
        title="Pause this channel - hides it from every day until resumed"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <IconPause className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Shown separately from the day-filtered list below, for a paused channel -
// the day filter would otherwise hide it from every single day, leaving no
// row anywhere to resume it from.
function PausedChannelRow({ channel, token }: { channel: YoutubeChannel; token: string }) {
  const queryClient = useQueryClient();
  const [resuming, setResuming] = useState(false);

  // Only clears channel.is_paused - the per-weekday YoutubeChannelPostingTime
  // rows were never touched by pausing, so whatever pattern existed before
  // (e.g. weekends already off) comes back exactly as it was.
  const resumeChannel = async () => {
    setResuming(true);
    try {
      await updateYoutubeChannel(token, channel.id, { is_paused: false });
      await queryClient.invalidateQueries({ queryKey: ["youtube-accounts", token] });
    } finally {
      setResuming(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {channel.thumbnail_url ? (
        <img
          src={channel.thumbnail_url}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover opacity-60"
        />
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      )}
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {channel.title}
      </p>
      <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
        Paused
      </span>
      <button
        type="button"
        onClick={() => void resumeChannel()}
        disabled={resuming}
        aria-label="Resume"
        title="Resume this channel - turns every day back on"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white disabled:opacity-50"
      >
        <IconPlay className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ChannelsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => todayIndex());
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [onlyZeroUploads, setOnlyZeroUploads] = useState(false);
  const [onlyUploadNow, setOnlyUploadNow] = useState(false);
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [editingTimeChannel, setEditingTimeChannel] = useState<YoutubeChannel | null>(null);

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
    queryKey: ["youtube-posting-times", token],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getYoutubePostingTimes(token);
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

  // All 7 days' rows per channel - needed by the upload-day toggle grid on
  // every row regardless of which single day is currently selected.
  const entriesByChannelAllDays = useMemo(() => {
    const map = new Map<number, Partial<Record<YoutubeDayOfWeek, YoutubePostingTime>>>();
    for (const entry of postingTimesQuery.data ?? []) {
      const byDay = map.get(entry.channel_id) ?? {};
      byDay[entry.day_of_week] = entry;
      map.set(entry.channel_id, byDay);
    }
    return map;
  }, [postingTimesQuery.data]);

  // Just the selected day's row per channel - used for the time-window
  // display/recommendation and for filtering the list to that day's channels.
  const entriesByChannel = useMemo(() => {
    const map = new Map<number, YoutubePostingTime>();
    for (const entry of postingTimesQuery.data ?? []) {
      if (entry.day_of_week === dayKey) map.set(entry.channel_id, entry);
    }
    return map;
  }, [postingTimesQuery.data, dayKey]);

  const uploadCountByChannel = useMemo(() => {
    const map = new Map<number, number>();
    for (const log of uploadLogsQuery.data ?? []) map.set(log.channel_id, log.videos_uploaded_count);
    return map;
  }, [uploadLogsQuery.data]);

  const editingTimeTarget: EditingTimeTarget | null = editingTimeChannel
    ? {
        id: editingTimeChannel.id,
        name: editingTimeChannel.title,
        startTime: entriesByChannel.get(editingTimeChannel.id)?.start_time ?? null,
        endTime: entriesByChannel.get(editingTimeChannel.id)?.end_time ?? null,
      }
    : null;

  const saveEditingTime = async (startTime: string, endTime: string) => {
    if (!token || !editingTimeChannel) return;
    await upsertYoutubePostingTime(token, editingTimeChannel.id, dayKey, { start_time: startTime, end_time: endTime });
    await queryClient.invalidateQueries({ queryKey: ["youtube-posting-times", token] });
  };

  const groups = useMemo(() => groupAccounts(accountsQuery.data ?? []), [accountsQuery.data]);

  const namedGroupLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const group of groups) {
      if (group.label && group.accounts.length > 1) labels.add(group.label);
    }
    return Array.from(labels).sort();
  }, [groups]);

  // Paused channels always live in the separate "Paused" section below,
  // regardless of showAllChannels, so they're excluded here unconditionally.
  // A channel whose selected day is off (but isn't paused) is excluded only
  // when showAllChannels is off; when it's on, such channels stay in and the
  // row itself renders greyed out instead of being hidden.
  const visibleGroups = useMemo(() => {
    return groups
      .filter((group) => groupFilter === "all" || group.label === groupFilter)
      .map((group) => {
        const channels = group.accounts.flatMap((account) => account.channels);
        return {
          ...group,
          channels: channels.filter((c) => {
            if (c.is_paused) return false;
            const uploadCount = uploadCountByChannel.get(c.id) ?? 0;
            const scheduleEntry = entriesByChannel.get(c.id);
            // No row for this channel/day means "yes, uploads this day" (the
            // default) - only an explicit false counts as inactive.
            const dayInactive = scheduleEntry?.is_upload_day === false;
            if (!showAllChannels && dayInactive) return false;
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
  }, [groups, groupFilter, onlyZeroUploads, onlyUploadNow, showAllChannels, isToday, entriesByChannel, uploadCountByChannel]);

  // Paused channels - the day filter above always hides these (regardless of
  // showAllChannels), so they're surfaced here instead, outside the day view
  // entirely, with a one-click way back in.
  const pausedChannels = useMemo(() => {
    return groups
      .filter((group) => groupFilter === "all" || group.label === groupFilter)
      .flatMap((group) => group.accounts.flatMap((account) => account.channels))
      .filter((c) => c.is_paused);
  }, [groups, groupFilter]);

  const headerActions = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-1">
        {!isToday && (
          <button
            type="button"
            onClick={jumpToToday}
            className="shrink-0 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
          >
            Today
          </button>
        )}
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          aria-label="Previous week"
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ‹
        </button>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DAYS.map((d, index) => {
            const date = addDays(weekStart, index);
            const selected = index === selectedDayIndex;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1 transition-colors ${
                  selected
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <span className="text-xs font-semibold">{d.label}</span>
                <span
                  className={`text-[10px] font-bold ${selected ? "text-amber-200" : "text-amber-600 dark:text-amber-400"}`}
                >
                  {formatDayDate(date)}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          aria-label="Next week"
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ›
        </button>
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
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={showAllChannels}
          onChange={(e) => setShowAllChannels(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
        />
        Show all
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
    <>
    <RightDrawer open={open} onClose={onClose} title="Channels" width="5xl" actions={headerActions}>
      <div className="space-y-4">
        {!token ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Log in to view channels.</p>
        ) : accountsQuery.isLoading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading channels…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No connected channels yet.</p>
        ) : visibleGroups.length === 0 && pausedChannels.length === 0 ? (
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
                      date={selectedDate}
                      isToday={isToday}
                      scheduleEntry={entriesByChannel.get(channel.id)}
                      entriesByDay={entriesByChannelAllDays.get(channel.id) ?? {}}
                      uploadCount={uploadCountByChannel.get(channel.id) ?? 0}
                      dayInactive={entriesByChannel.get(channel.id)?.is_upload_day === false}
                      token={token}
                      onEditTime={() => setEditingTimeChannel(channel)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {pausedChannels.length > 0 && (
              <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                <h3 className="border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  Paused (no upload days set)
                </h3>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pausedChannels.map((channel) => (
                    <PausedChannelRow key={channel.id} channel={channel} token={token} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </RightDrawer>
    <EditPostingTimeDrawer
      target={editingTimeTarget}
      onClose={() => setEditingTimeChannel(null)}
      onSave={saveEditingTime}
    />
    </>
  );
}
