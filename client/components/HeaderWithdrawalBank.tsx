"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTimeEntriesDurationSum } from "@/lib/api/time-entries";
import { TIME_TRACKER_ENTRIES_UPDATED_EVENT } from "@/lib/time-tracker-storage";

const SLEEP_SECONDS = 6 * 3600;
/** Fixed daily ceiling: 86,400s in a day less an assumed 6h of sleep. */
const TOTAL_AVAILABLE_FOR_DAY = 86400 - SLEEP_SECONDS;

function startOfLocalDayIso(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString();
}

function startOfNextLocalDayIso(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() + 1);
  return s.toISOString();
}

function secondsUntil1159pm(now: Date): number {
  const target = new Date(now);
  target.setHours(23, 59, 0, 0);
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));
}

function currentCeilingSeconds(): number {
  return Math.min(TOTAL_AVAILABLE_FOR_DAY, secondsUntil1159pm(new Date()));
}

function secondsSinceMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - midnight.getTime()) / 1000));
}

/** Elapsed time today past the assumed 6h sleep window, before netting out withdrawn time. */
function currentElapsedAwakeSeconds(): number {
  return Math.max(0, secondsSinceMidnight(new Date()) - SLEEP_SECONDS);
}

/**
 * "Seconds bank" gamification: every tracked project/goal entry is a
 * withdrawal against a daily balance (86,400s less an assumed 6h sleep).
 * Withdrawn only updates when a time entry is saved; the ceiling only
 * updates on tab focus/app open — neither ticks live, by design.
 */
export function HeaderWithdrawalBank() {
  const { token, isAuthenticated } = useAuth();
  const [withdrawnSeconds, setWithdrawnSeconds] = useState(0);
  const [ceilingSeconds, setCeilingSeconds] = useState(currentCeilingSeconds);
  const [elapsedAwakeSeconds, setElapsedAwakeSeconds] = useState(
    currentElapsedAwakeSeconds
  );

  const refreshWithdrawn = useCallback(async () => {
    if (!token) return;
    const now = new Date();
    try {
      const totalMs = await getTimeEntriesDurationSum(
        token,
        startOfLocalDayIso(now),
        startOfNextLocalDayIso(now)
      );
      setWithdrawnSeconds(Math.round(totalMs / 1000));
    } catch {
      // Best-effort; keep previous value on failure.
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setCeilingSeconds(currentCeilingSeconds());
    setElapsedAwakeSeconds(currentElapsedAwakeSeconds());
    void refreshWithdrawn();
  }, [isAuthenticated, refreshWithdrawn]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onEntriesUpdated = () => void refreshWithdrawn();
    window.addEventListener(TIME_TRACKER_ENTRIES_UPDATED_EVENT, onEntriesUpdated);
    return () =>
      window.removeEventListener(TIME_TRACKER_ENTRIES_UPDATED_EVENT, onEntriesUpdated);
  }, [isAuthenticated, refreshWithdrawn]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onFocus = () => {
      setCeilingSeconds(currentCeilingSeconds());
      setElapsedAwakeSeconds(currentElapsedAwakeSeconds());
      void refreshWithdrawn();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [isAuthenticated, refreshWithdrawn]);

  if (!isAuthenticated) return null;

  const wastedSeconds = Math.max(0, elapsedAwakeSeconds - withdrawnSeconds);

  return (
    <table
      className="shrink-0 border-collapse rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
      title="Seconds bank: every tracked project/goal is a withdrawal. Withdrawn updates when you save an entry; balance/wasted/total reflect time left until 11:59pm, refreshed when you focus this tab."
    >
      <tbody>
        <tr>
          <td className="border border-zinc-300 px-2 py-0.5 text-center dark:border-zinc-600">
            <div className="text-[9px] font-bold uppercase leading-none tracking-wide text-zinc-800 dark:text-zinc-100">
              Total
            </div>
            <div className="mt-0.5 font-mono text-[11px] font-bold leading-none tabular-nums text-zinc-700 dark:text-zinc-300">
              {TOTAL_AVAILABLE_FOR_DAY.toLocaleString()}s
            </div>
          </td>
          <td className="border border-zinc-300 px-2 py-0.5 text-center dark:border-zinc-600">
            <div className="text-[9px] font-bold uppercase leading-none tracking-wide text-zinc-800 dark:text-zinc-100">
              Wasted
            </div>
            <div
              className={`mt-0.5 font-mono text-[11px] font-bold leading-none tabular-nums ${
                wastedSeconds > 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {wastedSeconds.toLocaleString()}s
            </div>
          </td>
        </tr>
        <tr>
          <td className="border border-zinc-300 px-2 py-0.5 text-center dark:border-zinc-600">
            <div className="text-[9px] font-bold uppercase leading-none tracking-wide text-zinc-800 dark:text-zinc-100">
              Bal
            </div>
            <div className="mt-0.5 font-mono text-[11px] font-bold leading-none tabular-nums text-sky-700 dark:text-sky-400">
              {ceilingSeconds.toLocaleString()}s
            </div>
          </td>
          <td className="border border-zinc-300 px-2 py-0.5 text-center dark:border-zinc-600">
            <div className="text-[9px] font-bold uppercase leading-none tracking-wide text-zinc-800 dark:text-zinc-100">
              Withdrawn
            </div>
            <div className="mt-0.5 font-mono text-[11px] font-bold leading-none tabular-nums text-emerald-700 dark:text-emerald-400">
              {withdrawnSeconds.toLocaleString()}s
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
