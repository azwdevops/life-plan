"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTheme } from "@/contexts/ThemeContext";
import { getTimeEntriesDurationSum } from "@/lib/api/time-entries";
import { TIME_TRACKER_ENTRIES_UPDATED_EVENT } from "@/lib/time-tracker-storage";
import { FloatingCalculator } from "@/components/FloatingCalculator";

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
 *
 * Also doubles as the account menu trigger (moved here from the header
 * avatar, which was removed to save space on small screens): clicking the
 * table opens the same Calculator/theme/logout dropdown the avatar used to.
 */
export function HeaderWithdrawalBank() {
  const router = useRouter();
  const { token, isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [withdrawnSeconds, setWithdrawnSeconds] = useState(0);
  const [ceilingSeconds, setCeilingSeconds] = useState(currentCeilingSeconds);
  const [elapsedAwakeSeconds, setElapsedAwakeSeconds] = useState(
    currentElapsedAwakeSeconds
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push("/login");
  };

  if (!isAuthenticated) return null;

  const wastedSeconds = Math.max(0, elapsedAwakeSeconds - withdrawnSeconds);

  return (
    <div className="relative" ref={menuRef}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
        onClick={() => setMenuOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setMenuOpen((o) => !o);
          }
        }}
        title="Seconds bank: every tracked project/goal is a withdrawal. Withdrawn updates when you save an entry; balance/wasted/total reflect time left until 11:59pm, refreshed when you focus this tab. Click for account menu."
        className="shrink-0 cursor-pointer rounded-lg bg-zinc-50 transition-colors hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/50"
      >
        <table className="border-collapse">
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
      </div>

      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-700">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {user?.first_name}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {user?.email}
            </p>
          </div>
          <div className="border-b border-zinc-100 py-1 dark:border-zinc-700">
            <button
              onClick={() => {
                setMenuOpen(false);
                setCalculatorOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700/50"
            >
              <svg
                className="h-4 w-4 text-zinc-500 dark:text-zinc-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 7h8M8 11h2M12 11h2M16 11h2M8 15h2M12 15h2M16 15h2" />
              </svg>
              Calculator
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleTheme();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700/50"
            >
              {theme === "light" ? (
                <svg
                  className="h-4 w-4 text-zinc-500 dark:text-zinc-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 text-zinc-500 dark:text-zinc-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
              {theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            </button>
          </div>
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      <FloatingCalculator
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />
    </div>
  );
}
