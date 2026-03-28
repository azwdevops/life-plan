"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Dialog } from "@/components/Dialog";
import { FitnessProfileModal } from "@/components/FitnessProfileModal";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  completeRunSession,
  deleteRunSession,
  listRunSessions,
  startRunSession,
  type RunSessionResponse,
} from "@/lib/api/run-sessions";
import {
  distanceKmFromSpeed,
  fatEquivKgFromKcal,
  kcalRunningMassDistance,
  KCAL_PER_KG_FAT_THEORY,
} from "@/lib/run-energy";
import {
  clearActiveRun,
  peekActiveRun,
  persistActiveRun,
  readActiveRun,
  updateActiveRunPauseFields,
} from "@/lib/active-run-storage";

type DailyPoint = {
  date: string;
  distanceKm: number;
  minutes: number;
  kcal: number;
  sessions: number;
};

type WeekRow = {
  weekStartIso: string;
  weekLabel: string;
  sessions: number;
  distanceKm: number;
  activeMinutes: number;
  kcal: number;
};

type DaySessionPoint = {
  id: number;
  timeLabel: string;
  startTimeLabel: string;
  distanceKm: number;
  kcal: number;
  durationSeconds: number;
  fatKg: number;
  durationLongLabel: string;
};

type PeriodMode = "week" | "month" | "custom";

function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sessionLocalDate(createdAt: string): string {
  return localISODate(new Date(createdAt));
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

function mondayOfContainingLocalDate(d: Date): string {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return localISODate(c);
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

function aggregateDailyFromSessions(
  sessions: RunSessionResponse[]
): Map<string, DailyPoint> {
  const m = new Map<string, DailyPoint>();
  for (const row of sessions) {
    const key = sessionLocalDate(row.created_at);
    const prev = m.get(key);
    const minutes = Math.round(row.duration_seconds / 60);
    if (prev) {
      prev.distanceKm += row.distance_km;
      prev.minutes += minutes;
      prev.kcal += row.calories_kcal;
      prev.sessions += 1;
    } else {
      m.set(key, {
        date: key,
        distanceKm: row.distance_km,
        minutes,
        kcal: Math.round(row.calories_kcal),
        sessions: 1,
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

function aggregateWeeklyRows(sessions: RunSessionResponse[]): WeekRow[] {
  const byWeek = new Map<string, WeekRow>();
  for (const r of sessions) {
    const day = sessionLocalDate(r.created_at);
    const ws = weekStartMondayLocalFromDayIso(day);
    const prev = byWeek.get(ws);
    const dist = r.distance_km;
    const min = Math.round(r.duration_seconds / 60);
    const kcal = r.calories_kcal;
    if (prev) {
      prev.sessions += 1;
      prev.distanceKm += dist;
      prev.activeMinutes += min;
      prev.kcal += kcal;
    } else {
      byWeek.set(ws, {
        weekStartIso: ws,
        weekLabel: formatWeekRangeLabel(ws),
        sessions: 1,
        distanceKm: dist,
        activeMinutes: min,
        kcal,
      });
    }
  }
  return Array.from(byWeek.values()).sort((a, b) =>
    a.weekStartIso.localeCompare(b.weekStartIso)
  );
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
        distanceKm: 0,
        minutes: 0,
        kcal: 0,
        sessions: 0,
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

function formatMonthKey(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatNumber(n: number, decimals: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDurationLong(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function renderDaySessionBarShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: DaySessionPoint;
}) {
  const { x, y, width, height, fill, payload } = props;
  if (
    x == null ||
    y == null ||
    width == null ||
    height == null ||
    !payload
  )
    return null;
  const cx = x + width / 2;
  const blockWidth = Math.max(140, width * 0.9);
  const leftX = cx - blockWidth / 2;
  const colGap = 14;
  const colWidth = (blockWidth - colGap) / 2;
  const rightX = leftX + colWidth + colGap;
  const lineGap = 26;
  const startY = y + 16;
  const altA = "#fde68a";
  const altB = "#ffffff";
  const leftCol: { text: string; color: string }[] = [
    { text: `Start: ${payload.startTimeLabel}`, color: altA },
    { text: `Duration: ${payload.durationLongLabel}`, color: altA },
    { text: `Fat: ${formatNumber(payload.fatKg, 4)} kg`, color: altA },
  ];
  const rightCol: { text: string; color: string }[] = [
    { text: `Energy: ${Math.round(payload.kcal).toLocaleString()} kcal`, color: altB },
    { text: `Distance: ${formatNumber(payload.distanceKm, 3)} km`, color: altB },
  ];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={fill ?? CHART_LINE} />
      <text
        x={leftX}
        y={startY}
        textAnchor="start"
        fill="#ffffff"
        fontSize={10}
        fontWeight={700}
        stroke="#0f172a"
        strokeWidth={0.45}
        paintOrder="stroke"
      >
        {leftCol.map((line, i) => (
          <tspan key={`${payload.id}-l-${i}`} x={leftX} dy={i === 0 ? 0 : lineGap}>
            <tspan fill={line.color}>{line.text}</tspan>
          </tspan>
        ))}
      </text>
      <text
        x={rightX}
        y={startY}
        textAnchor="start"
        fill="#ffffff"
        fontSize={10}
        fontWeight={700}
        stroke="#0f172a"
        strokeWidth={0.45}
        paintOrder="stroke"
      >
        {rightCol.map((line, i) => (
          <tspan key={`${payload.id}-r-${i}`} x={rightX} dy={i === 0 ? 0 : lineGap}>
            <tspan fill={line.color}>{line.text}</tspan>
          </tspan>
        ))}
      </text>
    </g>
  );
}

function toDateTimeLocalInputValue(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da}T${hh}:${mm}`;
}

const CHART_AXIS = "#71717a";
const CHART_LINE = "#2563eb";
const CHART_GRID = "#d4d4d8";

/** Profile default when `stats_refresh_interval_seconds` is unset (not stored). */
const DEFAULT_STATS_REFRESH_SEC = 3;

function clampStatsRefreshSec(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return DEFAULT_STATS_REFRESH_SEC;
  const n = Math.round(v);
  return Math.min(300, Math.max(1, n));
}

function hasCompleteExerciseMetrics(
  u: {
    weight_kg?: number | null;
    height_cm?: number | null;
    age?: number | null;
    sex?: string | null;
  } | null
): boolean {
  if (!u) return false;
  if (u.weight_kg == null || u.height_cm == null || u.age == null) return false;
  return u.sex === "male" || u.sex === "female" || u.sex === "other";
}

function activeRunElapsedSeconds(
  startedAtMs: number,
  accumulatedPauseMs: number,
  pauseStartedAtMs: number | null,
  nowMs: number = Date.now()
): number {
  let pauseMs = accumulatedPauseMs;
  if (pauseStartedAtMs != null) {
    pauseMs += nowMs - pauseStartedAtMs;
  }
  return Math.max(0, Math.floor((nowMs - startedAtMs - pauseMs) / 1000));
}

function snapshotLiveActive(
  weightKg: number,
  met: number,
  speedKmh: number,
  startedAtMs: number,
  accumulatedPauseMs: number,
  pauseStartedAtMs: number | null,
  nowMs: number = Date.now()
) {
  const sec = activeRunElapsedSeconds(
    startedAtMs,
    accumulatedPauseMs,
    pauseStartedAtMs,
    nowMs
  );
  const distanceKm = distanceKmFromSpeed(speedKmh, sec);
  const kcal = kcalRunningMassDistance(weightKg, distanceKm, met);
  return {
    elapsedSec: sec,
    distanceKm,
    kcal,
    fatKg: fatEquivKgFromKcal(kcal),
  };
}

function ExerciseContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user, token, applyUser } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const isEmbedded = searchParams.get("embedded") === "1" || pathname === "/personal-growth";
  const isAdmin = user?.groups?.includes("admin");

  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);

  const [runSessions, setRunSessions] = useState<RunSessionResponse[]>([]);
  const [runSessionsError, setRunSessionsError] = useState<string | null>(null);
  const [runSaveError, setRunSaveError] = useState<string | null>(null);
  const [metricsGateMessage, setMetricsGateMessage] = useState<string | null>(
    null
  );
  const [speedKmhInput, setSpeedKmhInput] = useState("");
  const [manualSpeedKmhInput, setManualSpeedKmhInput] = useState("");
  const [manualDurationSecInput, setManualDurationSecInput] = useState("");
  const [manualStartLocalInput, setManualStartLocalInput] = useState(
    toDateTimeLocalInputValue(new Date())
  );
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSaveError, setManualSaveError] = useState<string | null>(null);
  const [manualIsSaving, setManualIsSaving] = useState(false);
  const [manualSavedDialogOpen, setManualSavedDialogOpen] = useState(false);
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);
  const [isRunActive, setIsRunActive] = useState(false);
  const [isRunPaused, setIsRunPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveDistanceKm, setLiveDistanceKm] = useState(0);
  const [liveKcal, setLiveKcal] = useState(0);
  const [liveFatKg, setLiveFatKg] = useState(0);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardRunError, setDiscardRunError] = useState<string | null>(null);
  const [deleteSavedSessionId, setDeleteSavedSessionId] = useState<number | null>(
    null
  );
  const [deleteSavedError, setDeleteSavedError] = useState<string | null>(null);
  const [openRunMenuId, setOpenRunMenuId] = useState<number | null>(null);

  const runStartedAtRef = useRef<number | null>(null);
  const runSpeedKmhRef = useRef(0);
  const runTickSecRef = useRef(DEFAULT_STATS_REFRESH_SEC);
  const accumulatedPauseMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const manualStartInputRef = useRef<HTMLInputElement | null>(null);
  const serverSessionIdRef = useRef<number | null>(null);
  const weekPickerInitRef = useRef(false);

  const dailyMap = useMemo(
    () => aggregateDailyFromSessions(runSessions),
    [runSessions]
  );
  const dataBounds = useMemo(() => deriveDataBounds(dailyMap), [dailyMap]);
  const monthKeys = useMemo(() => deriveMonthKeys(dailyMap), [dailyMap]);
  const weekOptions = useMemo(() => deriveWeekOptions(dailyMap), [dailyMap]);
  const weeklyRows = useMemo(
    () => aggregateWeeklyRows(runSessions),
    [runSessions]
  );

  const effectiveStatsRefreshSec = useMemo(
    () => clampStatsRefreshSec(user?.stats_refresh_interval_seconds),
    [user?.stats_refresh_interval_seconds]
  );
  const effectiveRunningMet = useMemo(() => {
    const m = user?.running_met;
    if (m == null || !Number.isFinite(m)) return 1;
    return Math.max(0.1, Math.min(20, m));
  }, [user?.running_met]);

  const totals = useMemo(() => {
    if (runSessions.length === 0) return null;
    const now = new Date();
    const wkStart = mondayOfContainingLocalDate(now);
    const wkEnd = addCalendarDays(wkStart, 6);
    const thisWeekSessions = runSessions.filter((r) => {
      const d = sessionLocalDate(r.created_at);
      return d >= wkStart && d <= wkEnd;
    }).length;
    const distanceKm = runSessions.reduce((s, r) => s + r.distance_km, 0);
    const activeMinutes = runSessions.reduce(
      (s, r) => s + Math.floor(r.duration_seconds / 60),
      0
    );
    const kcal = runSessions.reduce((s, r) => s + r.calories_kcal, 0);
    return {
      thisWeekSessions,
      distanceKm,
      activeMinutes,
      kcal,
    };
  }, [runSessions]);

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

  const selectedDaySessionSeries = useMemo<DaySessionPoint[]>(() => {
    if (!selectedDayIso) return [];
    return runSessions
      .filter((row) => sessionLocalDate(row.created_at) === selectedDayIso)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map((row) => {
        const when = new Date(row.created_at);
        const duration = row.duration_seconds;
        const kcal = row.calories_kcal;
        const fatKg = row.fat_equiv_kg;
        return {
          id: row.id,
          timeLabel: when.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }),
          startTimeLabel: when.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          distanceKm: row.distance_km,
          kcal,
          durationSeconds: duration,
          fatKg,
          durationLongLabel: formatDurationLong(duration),
        };
      });
  }, [runSessions, selectedDayIso]);

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
    setCustomStart((s) => {
      if (!s) return dataBounds.first;
      if (s < dataBounds.first || s > dataBounds.last) return dataBounds.first;
      return s;
    });
    setCustomEnd((e) => {
      if (!e) return dataBounds.last;
      if (e < dataBounds.first || e > dataBounds.last) return dataBounds.last;
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
        [...lineSeries].reverse().find((d) => d.sessions > 0) ??
        lineSeries[lineSeries.length - 1];
      setSelectedDayIso(preferred?.date ?? null);
    }
  }, [lineSeries, selectedDayIso]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    let cancelled = false;
    setRunSessionsError(null);
    listRunSessions(token)
      .then((rows) => {
        if (!cancelled) setRunSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setRunSessionsError("Could not load saved runs.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !user?.id || isRunActive) return;

    const peek = peekActiveRun();
    if (
      peek &&
      peek.userId === user.id &&
      !hasCompleteExerciseMetrics(user)
    ) {
      clearActiveRun();
      return;
    }

    if (!hasCompleteExerciseMetrics(user)) return;

    const saved = readActiveRun(user.id);
    if (!saved) return;

    const w = user.weight_kg!;
    serverSessionIdRef.current = saved.serverSessionId;
    runStartedAtRef.current = saved.startedAtMs;
    runSpeedKmhRef.current = saved.speedKmh;
    runTickSecRef.current = saved.tickIntervalSec;
    accumulatedPauseMsRef.current = saved.accumulatedPauseMs;
    pauseStartedAtRef.current = saved.pauseStartedAtMs;
    setIsRunPaused(saved.pauseStartedAtMs != null);
    setSpeedKmhInput(String(saved.speedKmh));
    const snap = snapshotLiveActive(
      w,
      effectiveRunningMet,
      saved.speedKmh,
      saved.startedAtMs,
      saved.accumulatedPauseMs,
      saved.pauseStartedAtMs
    );
    setElapsedSec(snap.elapsedSec);
    setLiveDistanceKm(snap.distanceKm);
    setLiveKcal(snap.kcal);
    setLiveFatKg(snap.fatKg);
    setIsRunActive(true);
  }, [effectiveRunningMet, isAdmin, user, isRunActive]);

  useEffect(() => {
    if (!isRunActive || user?.weight_kg == null || isRunPaused) return;

    const weightKg = user.weight_kg;

    const tickLiveStats = () => {
      const t0 = runStartedAtRef.current;
      if (t0 == null) return;
      const snap = snapshotLiveActive(
        weightKg,
        effectiveRunningMet,
        runSpeedKmhRef.current,
        t0,
        accumulatedPauseMsRef.current,
        pauseStartedAtRef.current
      );
      setLiveDistanceKm(snap.distanceKm);
      setLiveKcal(snap.kcal);
      setLiveFatKg(snap.fatKg);
    };

    const tickMs = runTickSecRef.current * 1000;
    const idStats = setInterval(tickLiveStats, tickMs);
    const idClock = setInterval(() => {
      const t0 = runStartedAtRef.current;
      if (t0 == null) return;
      setElapsedSec(
        activeRunElapsedSeconds(
          t0,
          accumulatedPauseMsRef.current,
          pauseStartedAtRef.current
        )
      );
    }, 1000);

    return () => {
      clearInterval(idStats);
      clearInterval(idClock);
    };
  }, [effectiveRunningMet, isRunActive, user?.weight_kg, isRunPaused]);

  if (!isAuthenticated && !isLoading) {
    return null;
  }
  if (isAuthenticated && !isLoading && !isAdmin) {
    return null;
  }

  const summaryLines: {
    key: string;
    prefix: string;
    value: string;
    suffix: string;
    title?: string;
  }[] = [
    {
      key: "sessions",
      prefix: "This week",
      value: totals ? String(totals.thisWeekSessions) : "-",
      suffix: "sessions",
    },
    {
      key: "dist",
      prefix: "Total distance",
      value: totals ? `${formatNumber(totals.distanceKm, 1)} km` : "-",
      suffix: "",
    },
    {
      key: "time",
      prefix: "Active time",
      value: totals ? formatMinutes(totals.activeMinutes) : "-",
      suffix: "",
    },
    {
      key: "kcal",
      prefix: "Est. energy",
      value: totals ? `${Math.round(totals.kcal).toLocaleString()} kcal` : "-",
      suffix: "",
    },
    {
      key: "fat_equiv",
      prefix: "Theor. fat equiv.",
      value: totals
        ? `${formatNumber(Number(totals.kcal) / KCAL_PER_KG_FAT_THEORY, 2)} kg`
        : "-",
      suffix: "",
      title:
        "Illustrative only: total est. kcal ÷ ~7,700 kcal per kg body fat. Not actual weight change; energy balance over time dominates.",
    },
  ];

  function formatElapsed(totalSeconds: number): string {
    const s = Math.max(0, totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  const manualPreview = useMemo(() => {
    if (!user?.weight_kg) return null;
    const speed = Number.parseFloat(manualSpeedKmhInput.replace(",", "."));
    const seconds = Number.parseFloat(manualDurationSecInput.replace(",", "."));
    const start = new Date(manualStartLocalInput);
    if (!Number.isFinite(speed) || speed <= 0 || speed > 80) return null;
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86400 * 7)
      return null;
    if (Number.isNaN(start.getTime())) return null;
    const durationSeconds = Math.max(1, Math.round(seconds));
    const distanceKm = distanceKmFromSpeed(speed, durationSeconds);
    const kcal = kcalRunningMassDistance(
      user.weight_kg,
      distanceKm,
      effectiveRunningMet
    );
    return {
      speed,
      durationSeconds,
      startIso: start.toISOString(),
      endLocal: new Date(start.getTime() + durationSeconds * 1000),
      distanceKm,
      kcal,
      fatKg: fatEquivKgFromKcal(kcal),
    };
  }, [
    effectiveRunningMet,
    manualDurationSecInput,
    manualSpeedKmhInput,
    manualStartLocalInput,
    user,
  ]);

  const handleStartRun = async () => {
    setRunSaveError(null);
    if (!hasCompleteExerciseMetrics(user)) {
      setMetricsGateMessage(
        "Set all exercise metrics (weight, height, age, sex) in Settings before starting a run."
      );
      return;
    }
    if (!token || !user) {
      setMetricsGateMessage("You must be signed in to start a run.");
      return;
    }
    const parsed = Number.parseFloat(speedKmhInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMetricsGateMessage("Enter a speed greater than 0 km/h.");
      return;
    }
    setMetricsGateMessage(null);
    runSpeedKmhRef.current = parsed;
    runTickSecRef.current = clampStatsRefreshSec(
      user.stats_refresh_interval_seconds
    );
    try {
      const started = await startRunSession(token, {
        speed_kmh: parsed,
        tick_interval_seconds: runTickSecRef.current,
      });
      serverSessionIdRef.current = started.id;
      const startedAtMs = Date.now();
      runStartedAtRef.current = startedAtMs;
      accumulatedPauseMsRef.current = 0;
      pauseStartedAtRef.current = null;
      setIsRunPaused(false);
      persistActiveRun({
        userId: user.id,
        serverSessionId: started.id,
        startedAtMs,
        speedKmh: parsed,
        tickIntervalSec: runTickSecRef.current,
      });
      setElapsedSec(0);
      setLiveDistanceKm(0);
      setLiveKcal(0);
      setLiveFatKg(0);
      setIsRunActive(true);
    } catch (e) {
      serverSessionIdRef.current = null;
      setRunSaveError(
        e instanceof Error ? e.message : "Could not start run on server."
      );
    }
  };

  const handlePauseRun = () => {
    if (!isRunActive || isRunPaused || runStartedAtRef.current == null) return;
    const now = Date.now();
    pauseStartedAtRef.current = now;
    setIsRunPaused(true);
    updateActiveRunPauseFields(accumulatedPauseMsRef.current, now);
  };

  const handleResumeRun = () => {
    if (!isRunActive || !isRunPaused || pauseStartedAtRef.current == null) return;
    const ended = Date.now();
    accumulatedPauseMsRef.current += ended - pauseStartedAtRef.current;
    pauseStartedAtRef.current = null;
    setIsRunPaused(false);
    updateActiveRunPauseFields(accumulatedPauseMsRef.current, null);
  };

  const resetLiveRunTrackingState = () => {
    clearActiveRun();
    serverSessionIdRef.current = null;
    runStartedAtRef.current = null;
    accumulatedPauseMsRef.current = 0;
    pauseStartedAtRef.current = null;
    setIsRunPaused(false);
    setIsRunActive(false);
    setElapsedSec(0);
    setLiveDistanceKm(0);
    setLiveKcal(0);
    setLiveFatKg(0);
    setRunSaveError(null);
  };

  const confirmDiscardRun = async () => {
    setDiscardRunError(null);
    const sid = serverSessionIdRef.current;
    if (!token || sid == null) {
      resetLiveRunTrackingState();
      setDiscardDialogOpen(false);
      return;
    }
    try {
      await deleteRunSession(token, sid);
    } catch (e) {
      setDiscardRunError(
        e instanceof Error ? e.message : "Could not delete run on server."
      );
      return;
    }
    resetLiveRunTrackingState();
    setDiscardDialogOpen(false);
  };

  const confirmDeleteSavedRun = async () => {
    if (!token || deleteSavedSessionId == null) return;
    setDeleteSavedError(null);
    try {
      await deleteRunSession(token, deleteSavedSessionId);
      setDeleteSavedSessionId(null);
      setOpenRunMenuId(null);
      const rows = await listRunSessions(token);
      setRunSessions(rows);
    } catch (e) {
      setDeleteSavedError(
        e instanceof Error ? e.message : "Could not delete saved run."
      );
    }
  };

  const handleStopRun = async () => {
    if (!token) return;
    const t0 = runStartedAtRef.current;
    const tickSec = runTickSecRef.current;
    const sid = serverSessionIdRef.current;
    if (t0 == null || sid == null) return;

    const durationSeconds = Math.max(
      1,
      activeRunElapsedSeconds(
        t0,
        accumulatedPauseMsRef.current,
        pauseStartedAtRef.current
      )
    );
    setRunSaveError(null);
    try {
      await completeRunSession(token, sid, {
        duration_seconds: durationSeconds,
        tick_interval_seconds: tickSec,
      });
      resetLiveRunTrackingState();
      const rows = await listRunSessions(token);
      setRunSessions(rows);
    } catch (e) {
      setRunSaveError(e instanceof Error ? e.message : "Could not save run.");
    }
  };

  const handleSaveManualRun = async () => {
    setManualSaveError(null);
    if (!token) {
      setManualSaveError("You must be signed in to save a manual run.");
      return;
    }
    if (!hasCompleteExerciseMetrics(user)) {
      setManualSaveError(
        "Set all exercise metrics (weight, height, age, sex) in Settings before saving runs."
      );
      return;
    }
    if (!manualPreview) {
      setManualSaveError("Enter valid speed, duration, and start time.");
      return;
    }
    setManualIsSaving(true);
    try {
      const started = await startRunSession(token, {
        speed_kmh: manualPreview.speed,
        tick_interval_seconds: effectiveStatsRefreshSec,
        started_at: manualPreview.startIso,
      });
      await completeRunSession(token, started.id, {
        duration_seconds: manualPreview.durationSeconds,
        tick_interval_seconds: effectiveStatsRefreshSec,
      });
      const rows = await listRunSessions(token);
      setRunSessions(rows);
      setManualDurationSecInput("");
      setManualSpeedKmhInput("");
      setManualStartLocalInput(toDateTimeLocalInputValue(new Date()));
      setManualDialogOpen(false);
      setManualSavedDialogOpen(true);
    } catch (e) {
      setManualSaveError(
        e instanceof Error ? e.message : "Could not save manual run."
      );
    } finally {
      setManualIsSaving(false);
    }
  };

  const liveRunPhase: "idle" | "running" | "paused" = !isRunActive
    ? "idle"
    : isRunPaused
      ? "paused"
      : "running";

  return (
    <div
      className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950"
      suppressHydrationWarning
    >
      {!isEmbedded && <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />}
      {!isEmbedded && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isLoggedIn={isAuthenticated}
        />
      )}
      <main
        className={
          isEmbedded
            ? "flex-1"
            : `flex-1 transition-all duration-300 ${
                isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
              }`
        }
      >
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Exercise
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {token && (
                  <button
                    type="button"
                    onClick={() => setMetricsModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    Edit exercise metrics…
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setManualSaveError(null);
                    setManualDialogOpen(true);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  Manual entry
                </button>
              </div>
            </div>
          </div>

          <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Live run (constant speed)
            </h2>

            {metricsGateMessage && (
              <p
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100"
                role="alert"
              >
                {metricsGateMessage}{" "}
                <Link
                  href="/settings"
                  className="font-semibold underline underline-offset-2 hover:text-rose-950 dark:hover:text-rose-50"
                >
                  Open Settings
                </Link>
              </p>
            )}

            {runSaveError && (
              <p
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100"
                role="alert"
              >
                {runSaveError}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Speed (km/h)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={speedKmhInput}
                  onChange={(e) => setSpeedKmhInput(e.target.value)}
                  disabled={isRunActive}
                  placeholder="e.g. 8.5"
                  className="w-full min-w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:w-40"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={
                    liveRunPhase === "idle"
                      ? () => void handleStartRun()
                      : liveRunPhase === "running"
                        ? handlePauseRun
                        : handleResumeRun
                  }
                  className={
                    liveRunPhase === "idle"
                      ? "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      : liveRunPhase === "running"
                        ? "rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
                        : "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
                  }
                >
                  {liveRunPhase === "idle"
                    ? "Start"
                    : liveRunPhase === "running"
                      ? "Pause"
                      : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={handleStopRun}
                  disabled={!isRunActive}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  Stop &amp; save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscardRunError(null);
                    setDiscardDialogOpen(true);
                  }}
                  disabled={!isRunActive}
                  className="rounded-lg border border-rose-400 bg-white px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-700 dark:bg-zinc-900 dark:text-rose-200 dark:hover:bg-rose-950/40"
                >
                  Discard run
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Active elapsed
                  {isRunPaused && (
                    <span className="ml-1 font-normal normal-case text-amber-700 dark:text-amber-300">
                      (paused)
                    </span>
                  )}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatElapsed(elapsedSec)}
                </p>
              </div>
              <div
                className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                title={`Distance updates every ${isRunActive ? runTickSecRef.current : effectiveStatsRefreshSec}s while running.`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Distance (km)
                </p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatNumber(liveDistanceKm, 3)}
                </p>
              </div>
              <div
                className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                title={`Est. kcal ≈ weight (kg) × distance (km) × 1; refreshes every ${isRunActive ? runTickSecRef.current : effectiveStatsRefreshSec}s.`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Est. energy (kcal)
                </p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {Math.round(liveKcal).toLocaleString()}
                </p>
              </div>
              <div
                className="cursor-help rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                title="Illustrative only: est. kcal ÷ ~7,700 kcal per kg body fat. Not actual scale weight change."
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Theor. fat equiv. (kg)
                </p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatNumber(liveFatKg, 4)}
                </p>
              </div>
            </div>
          </section>

          <div className="mb-6 flex flex-wrap gap-x-8 gap-y-1 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
            {summaryLines.map(({ key, prefix, value, suffix, title }) => (
              <span
                key={key}
                className={
                  title
                    ? "cursor-help text-zinc-600 underline decoration-dotted decoration-zinc-400 underline-offset-2 dark:text-zinc-400 dark:decoration-zinc-500"
                    : "text-zinc-600 dark:text-zinc-400"
                }
                title={title}
              >
                {prefix}{" "}
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {value}
                </span>
                {suffix ? ` ${suffix}` : ""}
              </span>
            ))}
          </div>

          {dailyMap.size > 0 && (
            <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Activity over period
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Daily distance (km) across the selected period.
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
                      onChange={(e) =>
                        setSelectedWeekIndex(Number(e.target.value))
                      }
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
                        max={dataBounds?.last}
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
                        max={dataBounds?.last}
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
                    Daily distance (km)
                  </h3>
                  <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Click a day to inspect that day&apos;s sessions.
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
                            width={36}
                            domain={[0, "auto"]}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid #e4e4e7",
                            }}
                            formatter={(value) => [
                              `${formatNumber(Number(value ?? 0), 2)} km`,
                              "Distance",
                            ]}
                            labelFormatter={(_, payload) =>
                              payload?.[0]?.payload?.date ?? ""
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="distanceKm"
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
                    Sessions for {selectedDayIso ? formatAxisDate(selectedDayIso) : "day"}
                  </h3>
                  <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Bar height is distance. Labels show duration and energy.
                  </p>
                  <div className="h-72 w-full min-w-0">
                    {selectedDayIso == null ? (
                      <p className="text-sm text-zinc-500">
                        Select a day on the left chart.
                      </p>
                    ) : selectedDaySessionSeries.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No sessions were saved on this day.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={selectedDaySessionSeries}
                          margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_GRID}
                            className="dark:opacity-30"
                          />
                          <XAxis
                            dataKey="timeLabel"
                            tick={{ fontSize: 11, fill: CHART_AXIS }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: CHART_AXIS }}
                            width={36}
                            domain={[0, "auto"]}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid #e4e4e7",
                            }}
                            formatter={(value, name, payload) => {
                              const p = payload?.payload as DaySessionPoint | undefined;
                              if (name === "distanceKm")
                                return [`${formatNumber(Number(value ?? 0), 2)} km`, "Distance"];
                              if (name === "kcal")
                                return [`${Math.round(Number(value ?? 0)).toLocaleString()} kcal`, "Est. energy"];
                              if (name === "fatKg")
                                return [`${formatNumber(Number(value ?? 0), 4)} kg`, "Theor. fat equiv."];
                              if (name === "durationSeconds")
                                return [formatElapsed(Number(value ?? p?.durationSeconds ?? 0)), "Duration"];
                              return [String(value ?? ""), String(name ?? "")];
                            }}
                          />
                          <Bar
                            dataKey="distanceKm"
                            stroke={CHART_LINE}
                            fill={CHART_LINE}
                            minPointSize={72}
                            shape={(props) =>
                              renderDaySessionBarShape(props as never)
                            }
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Activity & history
            </h2>

            {runSessionsError && (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                {runSessionsError}
              </p>
            )}

            {runSessions.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Saved runs
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        <th className="pb-3 pr-4">When</th>
                        <th className="pb-3 pr-4 text-right">Speed (km/h)</th>
                        <th className="pb-3 pr-4 text-right">Duration</th>
                        <th className="pb-3 pr-4 text-right">Refresh (s)</th>
                        <th className="pb-3 pr-4 text-right">Distance (km)</th>
                        <th className="pb-3 pr-4 text-right">Est. kcal</th>
                        <th className="pb-3 pr-4 text-right">Theor. fat (kg)</th>
                        <th className="pb-3 text-right"> </th>
                      </tr>
                    </thead>
                    <tbody onClick={() => setOpenRunMenuId(null)}>
                      {runSessions.map((row) => {
                        const when = new Date(row.created_at);
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-zinc-100 dark:border-zinc-800"
                          >
                            <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">
                              {when.toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatNumber(row.speed_kmh, 1)}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatElapsed(row.duration_seconds)}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {row.tick_interval_seconds}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatNumber(row.distance_km, 3)}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {Math.round(row.calories_kcal).toLocaleString()}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatNumber(row.fat_equiv_kg, 4)}
                            </td>
                            <td className="relative py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenRunMenuId((current) =>
                                    current === row.id ? null : row.id
                                  );
                                }}
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                aria-label="Open actions menu"
                              >
                                ⋯
                              </button>
                              {openRunMenuId === row.id && (
                                <div
                                  className="absolute right-0 z-10 mt-1 min-w-28 rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteSavedError(null);
                                      setDeleteSavedSessionId(row.id);
                                      setOpenRunMenuId(null);
                                    }}
                                    className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {weeklyRows.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      <th className="pb-3 pr-4">Week</th>
                      <th className="pb-3 pr-4 text-right">Sessions</th>
                      <th className="pb-3 pr-4 text-right">Distance (km)</th>
                      <th className="pb-3 pr-4 text-right">Active time</th>
                      <th className="pb-3 text-right">Est. kcal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyRows.map((row) => (
                      <tr
                        key={row.weekStartIso}
                        className="border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {row.weekLabel}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {row.sessions}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {formatNumber(row.distanceKm, 1)}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {formatMinutes(row.activeMinutes)}
                        </td>
                        <td className="py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {Math.round(row.kcal).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Weekly totals appear here after you complete runs with{" "}
                <strong>Stop &amp; save</strong>. The chart above uses the same
                saved sessions.
              </p>
            )}
          </section>
        </div>
      </main>

      {token && (
        <FitnessProfileModal
          isOpen={metricsModalOpen}
          onClose={() => setMetricsModalOpen(false)}
          token={token}
          user={user}
          onSaved={applyUser}
        />
      )}

      <Dialog
        isOpen={manualDialogOpen}
        onClose={() => {
          if (manualIsSaving) return;
          setManualDialogOpen(false);
          setManualSaveError(null);
        }}
        title="Manual entry"
        size="lg"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Input speed, duration, and start time, then review the computed preview
          before saving.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Speed (km/h)
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={manualSpeedKmhInput}
              onChange={(e) => setManualSpeedKmhInput(e.target.value)}
              placeholder="e.g. 8.5"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Duration (seconds)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={manualDurationSecInput}
              onChange={(e) => setManualDurationSecInput(e.target.value)}
              placeholder="e.g. 2520"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Start time
            </span>
            <input
              ref={manualStartInputRef}
              type="datetime-local"
              value={manualStartLocalInput}
              onChange={(e) => setManualStartLocalInput(e.target.value)}
              onFocus={() => manualStartInputRef.current?.showPicker?.()}
              onClick={() => manualStartInputRef.current?.showPicker?.()}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
        </div>

        {manualSaveError && (
          <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">
            {manualSaveError}
          </p>
        )}
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Preview
          </p>
          {manualPreview ? (
            <div className="mt-2 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
              <p>
                Duration:{" "}
                <span className="font-semibold">
                  {formatElapsed(manualPreview.durationSeconds)}
                </span>
              </p>
              <p>
                Distance:{" "}
                <span className="font-semibold">
                  {formatNumber(manualPreview.distanceKm, 3)} km
                </span>
              </p>
              <p>
                Est. energy:{" "}
                <span className="font-semibold">
                  {Math.round(manualPreview.kcal).toLocaleString()} kcal
                </span>
              </p>
              <p>
                Theor. fat equiv.:{" "}
                <span className="font-semibold">
                  {formatNumber(manualPreview.fatKg, 4)} kg
                </span>
              </p>
              <p className="sm:col-span-2 lg:col-span-4">
                End time:{" "}
                <span className="font-semibold">
                  {manualPreview.endLocal.toLocaleString()}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Enter valid values to see computed output before saving.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              if (manualIsSaving) return;
              setManualDialogOpen(false);
              setManualSaveError(null);
            }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleSaveManualRun()}
            disabled={!manualPreview || manualIsSaving || isRunActive}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {manualIsSaving ? "Saving..." : "Save manual run"}
          </button>
        </div>
      </Dialog>

      <Dialog
        isOpen={manualSavedDialogOpen}
        onClose={() => setManualSavedDialogOpen(false)}
        title="Run saved"
        size="sm"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Manual run was saved successfully.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => setManualSavedDialogOpen(false)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            OK
          </button>
        </div>
      </Dialog>

      <Dialog
        isOpen={deleteSavedSessionId != null}
        onClose={() => {
          setDeleteSavedSessionId(null);
          setDeleteSavedError(null);
        }}
        title="Delete saved run?"
        size="sm"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This removes the run from your account on the server. This cannot be
          undone.
        </p>
        {deleteSavedError && (
          <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">
            {deleteSavedError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setDeleteSavedSessionId(null);
              setDeleteSavedError(null);
            }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmDeleteSavedRun()}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            Delete from server
          </button>
        </div>
      </Dialog>

      <Dialog
        isOpen={discardDialogOpen}
        onClose={() => {
          setDiscardDialogOpen(false);
          setDiscardRunError(null);
        }}
        title="Discard this run?"
        size="sm"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          A draft session was created on the server when you started. Discarding
          deletes that server row and clears local storage on this device. This
          does not remove runs you already finished with{" "}
          <strong>Stop &amp; save</strong>.
        </p>
        {discardRunError && (
          <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">
            {discardRunError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setDiscardDialogOpen(false);
              setDiscardRunError(null);
            }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmDiscardRun()}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            Discard
          </button>
        </div>
      </Dialog>
    </div>
  );
}

const exerciseSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default function ExercisePage() {
  return (
    <Suspense fallback={exerciseSuspenseFallback}>
      <ExerciseContent />
    </Suspense>
  );
}

