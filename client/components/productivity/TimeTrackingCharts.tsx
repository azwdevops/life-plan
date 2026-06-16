"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatDurationMs,
  type TimeTrackerEntry,
  type TimeTrackerKind,
} from "@/lib/time-tracker-storage";

type DailyPoint = {
  date: string;
  totalMs: number;
  totalMinutes: number;
  entries: number;
};

type ProjectDayPoint = {
  subjectKey: string;
  name: string;
  kind: TimeTrackerKind;
  totalMs: number;
  totalMinutes: number;
  sessions: number;
};

type PeriodMode = "week" | "month" | "custom";

const CHART_AXIS = "#71717a";
const CHART_LINE = "#2563eb";
const CHART_GRID = "#d4d4d8";

function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function entryLocalDate(startedAt: string): string {
  return localISODate(new Date(startedAt));
}

function addCalendarDays(iso: string, days: number): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + days);
  return localISODate(d);
}

function weekStartMondayLocalFromDayIso(iso: string): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localISODate(d);
}

function formatAxisDate(iso: string): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatWeekRangeLabel(startIso: string): string {
  const endIso = addCalendarDays(startIso, 6);
  return `${formatAxisDate(startIso)} – ${formatAxisDate(endIso)}`;
}

function formatMonthKey(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatMinutesAxis(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function truncateLabel(name: string, max = 14): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function fitLabelToWidth(name: string, width: number, fontSize = 11): string {
  const maxChars = Math.max(8, Math.floor(width / (fontSize * 0.55)));
  return truncateLabel(name, maxChars);
}

function renderProjectBarShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: ProjectDayPoint;
}) {
  const { x, y, width, height, fill, payload } = props;
  if (x == null || y == null || width == null || height == null || !payload) {
    return null;
  }

  const barHeight = Math.max(height, 72);
  const cx = x + width / 2;
  const padX = 8;
  const label = fitLabelToWidth(payload.name, width - padX * 2);
  const duration = formatDurationMs(payload.totalMs);
  const kindLabel = payload.kind === "goal" ? "Goal" : "Project";
  const startY = y + 18;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={barHeight}
        rx={6}
        ry={6}
        fill={fill ?? CHART_LINE}
      />
      <text
        x={cx}
        y={startY}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={11}
        fontWeight={700}
        stroke="#0f172a"
        strokeWidth={0.45}
        paintOrder="stroke"
      >
        <tspan x={cx}>{label}</tspan>
        <tspan x={cx} dy={18} fontSize={10} fontWeight={600}>
          {kindLabel} · {duration}
        </tspan>
      </text>
      {label !== payload.name ? (
        <title>{payload.name}</title>
      ) : null}
    </g>
  );
}

function aggregateDailyFromEntries(
  entries: TimeTrackerEntry[]
): Map<string, DailyPoint> {
  const m = new Map<string, DailyPoint>();
  for (const row of entries) {
    const key = entryLocalDate(row.startedAt);
    const prev = m.get(key);
    if (prev) {
      prev.totalMs += row.durationMs;
      prev.totalMinutes = prev.totalMs / 60000;
      prev.entries += 1;
    } else {
      m.set(key, {
        date: key,
        totalMs: row.durationMs,
        totalMinutes: row.durationMs / 60000,
        entries: 1,
      });
    }
  }
  return m;
}

function deriveMonthKeys(dailyMap: Map<string, DailyPoint>): string[] {
  return Array.from(
    new Set(Array.from(dailyMap.keys()).map((k) => k.slice(0, 7)))
  ).sort();
}

function deriveDataBounds(
  dailyMap: Map<string, DailyPoint>
): { first: string; last: string } | null {
  const keys = Array.from(dailyMap.keys()).sort();
  if (keys.length === 0) return null;
  return { first: keys[0], last: keys[keys.length - 1] };
}

function deriveWeekOptions(
  dailyMap: Map<string, DailyPoint>
): { startIso: string; label: string }[] {
  const set = new Set<string>();
  for (const date of dailyMap.keys()) {
    set.add(weekStartMondayLocalFromDayIso(date));
  }
  return Array.from(set)
    .sort()
    .map((startIso) => ({
      startIso,
      label: formatWeekRangeLabel(startIso),
    }));
}

function fillRangeDaily(
  start: string,
  end: string,
  dailyMap: Map<string, DailyPoint>
): DailyPoint[] {
  const out: DailyPoint[] = [];
  let cur = start <= end ? start : end;
  const stop = start <= end ? end : start;
  while (cur <= stop) {
    out.push(
      dailyMap.get(cur) ?? {
        date: cur,
        totalMs: 0,
        totalMinutes: 0,
        entries: 0,
      }
    );
    cur = addCalendarDays(cur, 1);
  }
  return out;
}

function getFilteredDaily(
  mode: PeriodMode,
  weekStartIso: string,
  monthKey: string,
  customStart: string,
  customEnd: string,
  dailyMap: Map<string, DailyPoint>
): DailyPoint[] {
  if (mode === "week") {
    const end = addCalendarDays(weekStartIso, 6);
    return fillRangeDaily(weekStartIso, end, dailyMap);
  }
  if (mode === "month") {
    const keys = Array.from(dailyMap.keys())
      .filter((k) => k.startsWith(monthKey))
      .sort();
    if (keys.length === 0) {
      const [y, m] = monthKey.split("-").map(Number);
      const first = localISODate(new Date(y, m - 1, 1));
      const last = localISODate(new Date(y, m, 0));
      return fillRangeDaily(first, last, dailyMap);
    }
    return fillRangeDaily(keys[0], keys[keys.length - 1], dailyMap);
  }
  const start = customStart <= customEnd ? customStart : customEnd;
  const end = customStart <= customEnd ? customEnd : customStart;
  return fillRangeDaily(start, end, dailyMap);
}

function aggregateProjectsForDay(
  entries: TimeTrackerEntry[],
  dayIso: string
): ProjectDayPoint[] {
  const map = new Map<string, ProjectDayPoint>();
  for (const row of entries) {
    if (entryLocalDate(row.startedAt) !== dayIso) continue;
    const subjectKey = `${row.kind}:${row.subjectId || row.subjectName}`;
    const prev = map.get(subjectKey);
    if (prev) {
      prev.totalMs += row.durationMs;
      prev.totalMinutes = prev.totalMs / 60000;
      prev.sessions += 1;
    } else {
      map.set(subjectKey, {
        subjectKey,
        name: row.subjectName,
        kind: row.kind,
        totalMs: row.durationMs,
        totalMinutes: row.durationMs / 60000,
        sessions: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalMs - a.totalMs);
}

export function TimeTrackingCharts({ entries }: { entries: TimeTrackerEntry[] }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const weekPickerInitRef = useRef(false);

  const dailyMap = useMemo(
    () => aggregateDailyFromEntries(entries),
    [entries]
  );
  const dataBounds = useMemo(() => deriveDataBounds(dailyMap), [dailyMap]);
  const monthKeys = useMemo(() => deriveMonthKeys(dailyMap), [dailyMap]);
  const weekOptions = useMemo(() => deriveWeekOptions(dailyMap), [dailyMap]);

  const filteredDaily = useMemo(() => {
    if (dailyMap.size === 0) return [];
    if (periodMode === "week") {
      if (weekOptions.length === 0) return [];
      const idx = Math.min(selectedWeekIndex, weekOptions.length - 1);
      const weekStartIso = weekOptions[idx]!.startIso;
      return getFilteredDaily(
        periodMode,
        weekStartIso,
        selectedMonthKey,
        customStart,
        customEnd,
        dailyMap
      );
    }
    return getFilteredDaily(
      periodMode,
      "",
      selectedMonthKey,
      customStart,
      customEnd,
      dailyMap
    );
  }, [
    dailyMap,
    periodMode,
    selectedWeekIndex,
    selectedMonthKey,
    customStart,
    customEnd,
    weekOptions,
  ]);

  const lineSeries = useMemo(
    () =>
      filteredDaily.map((d) => ({
        ...d,
        dayLabel: formatAxisDate(d.date),
      })),
    [filteredDaily]
  );

  const selectedDayProjectSeries = useMemo(
    () =>
      selectedDayIso
        ? aggregateProjectsForDay(entries, selectedDayIso)
        : [],
    [entries, selectedDayIso]
  );

  const periodSummaryLabel = useMemo(() => {
    if (filteredDaily.length === 0) return "";
    const first = filteredDaily[0].date;
    const last = filteredDaily[filteredDaily.length - 1].date;
    return `${formatAxisDate(first)} – ${formatAxisDate(last)} (${filteredDaily.length} days in range)`;
  }, [filteredDaily]);

  useEffect(() => {
    if (monthKeys.length === 0) return;
    setSelectedMonthKey((prev) =>
      prev && monthKeys.includes(prev) ? prev : monthKeys[monthKeys.length - 1]
    );
  }, [monthKeys]);

  useEffect(() => {
    if (weekOptions.length === 0) {
      weekPickerInitRef.current = false;
      return;
    }
    if (!weekPickerInitRef.current) {
      setSelectedWeekIndex(weekOptions.length - 1);
      weekPickerInitRef.current = true;
    } else {
      setSelectedWeekIndex((i) =>
        i >= weekOptions.length ? weekOptions.length - 1 : i
      );
    }
  }, [weekOptions]);

  useEffect(() => {
    if (!dataBounds) {
      setCustomStart("");
      setCustomEnd("");
      return;
    }
    const todayIso = localISODate(new Date());
    setCustomStart((s) => {
      if (!s) return dataBounds.first;
      if (s < dataBounds.first) return dataBounds.first;
      if (s > todayIso) return todayIso;
      return s;
    });
    setCustomEnd((e) => {
      if (!e) return todayIso;
      if (e < dataBounds.first) return dataBounds.first;
      if (e > todayIso) return todayIso;
      return e;
    });
  }, [dataBounds]);

  useEffect(() => {
    if (lineSeries.length === 0) {
      setSelectedDayIso(null);
      return;
    }
    const hasSelected = selectedDayIso
      ? lineSeries.some((d) => d.date === selectedDayIso)
      : false;
    if (!hasSelected) {
      const preferred =
        [...lineSeries].reverse().find((d) => d.entries > 0) ??
        lineSeries[lineSeries.length - 1];
      setSelectedDayIso(preferred?.date ?? null);
    }
  }, [lineSeries, selectedDayIso]);

  if (dailyMap.size === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Activity over period
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Daily tracked time across the selected period.
      </p>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["week", "Week"],
              ["month", "Month"],
              ["custom", "Custom dates"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriodMode(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                periodMode === value
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {periodMode === "week" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Calendar week
            </span>
            <select
              value={
                weekOptions.length === 0
                  ? 0
                  : Math.min(selectedWeekIndex, weekOptions.length - 1)
              }
              onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {weekOptions.map((w, i) => (
                <option key={w.startIso} value={i}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {periodMode === "month" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Month
            </span>
            <select
              value={
                monthKeys.includes(selectedMonthKey)
                  ? selectedMonthKey
                  : (monthKeys[monthKeys.length - 1] ?? "")
              }
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {monthKeys.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthKey(mk)}
                </option>
              ))}
            </select>
          </label>
        )}

        {periodMode === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                From
              </span>
              <input
                type="date"
                value={customStart}
                min={dataBounds?.first}
                max={localISODate(new Date())}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                To
              </span>
              <input
                type="date"
                value={customEnd}
                min={dataBounds?.first}
                max={localISODate(new Date())}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          </div>
        )}
      </div>

      {periodSummaryLabel && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {periodSummaryLabel}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Daily total time
          </h3>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Click a day to inspect that day&apos;s projects.
          </p>
          <div className="h-96 w-full min-w-0">
            {lineSeries.length === 0 ? (
              <p className="text-sm text-zinc-500">No days in range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineSeries}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={(state) => {
                    const label = state?.activeLabel;
                    if (typeof label !== "string") return;
                    const hit = lineSeries.find((d) => d.dayLabel === label);
                    if (hit) setSelectedDayIso(hit.date);
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    className="dark:opacity-30"
                  />
                  <XAxis
                    dataKey="dayLabel"
                    tick={{ fontSize: 11, fill: CHART_AXIS }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_AXIS }}
                    width={48}
                    domain={[0, "auto"]}
                    tickFormatter={(v) => formatMinutesAxis(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e4e4e7",
                    }}
                    formatter={(value) => [
                      formatDurationMs(Math.round(Number(value ?? 0) * 60000)),
                      "Total time",
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date ?? ""
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="totalMinutes"
                    stroke={CHART_LINE}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Projects for{" "}
            {selectedDayIso ? formatAxisDate(selectedDayIso) : "day"}
          </h3>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Each bar shows the project name and total time for that day.
          </p>
          <div className="h-96 w-full min-w-0">
            {selectedDayIso == null ? (
              <p className="text-sm text-zinc-500">
                Select a day on the left chart.
              </p>
            ) : selectedDayProjectSeries.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No time was tracked on this day.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={selectedDayProjectSeries}
                  margin={{ top: 12, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    className="dark:opacity-30"
                  />
                  <XAxis dataKey="subjectKey" hide />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_AXIS }}
                    width={48}
                    domain={[0, "auto"]}
                    tickFormatter={(v) => formatMinutesAxis(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e4e4e7",
                    }}
                    formatter={(value, _name, item) => {
                      const p = item?.payload as ProjectDayPoint | undefined;
                      const sessions = p?.sessions ?? 0;
                      const kind = p?.kind === "goal" ? "Goal" : "Project";
                      return [
                        `${formatDurationMs(Math.round(Number(value ?? 0) * 60000))} (${sessions} session${sessions === 1 ? "" : "s"})`,
                        kind,
                      ];
                    }}
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as ProjectDayPoint | undefined)
                        ?.name ?? ""
                    }
                  />
                  <Bar
                    dataKey="totalMinutes"
                    stroke={CHART_LINE}
                    fill={CHART_LINE}
                    minPointSize={72}
                    shape={(props) => renderProjectBarShape(props as never)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
