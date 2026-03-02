"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTheme } from "@/contexts/ThemeContext";

export interface CashAnalysisSummary {
  currentMonthLabel: string;
  nextMonthLabel: string;
  currentIn: number;
  currentOut: number;
  nextIn: number;
  nextOut: number;
}

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
  /** When set (e.g. on game page), show available cash in the header */
  availableCash?: number;
  /** When set (e.g. on game page), show hours available this month in the header */
  hoursAvailable?: number;
  /** When set (e.g. on game page), show portfolio value in the header */
  portfolioValue?: number;
  /** When set (e.g. on game page), show current/next month cash analysis in the header */
  cashAnalysis?: CashAnalysisSummary;
  /** Called when user clicks "View details" for current month */
  onViewCurrentDetails?: () => void;
  /** Called when user clicks "View details" for next month */
  onViewNextDetails?: () => void;
  /** When set with onAdvanceMonth (e.g. on game page), show advance month button; label e.g. "April 2025" */
  onAdvanceMonth?: () => void;
  advanceMonthLabel?: string;
}

export function Header({ onMenuClick, isSidebarOpen, availableCash, hoursAvailable, portfolioValue, cashAnalysis, onViewCurrentDetails, onViewNextDetails, onAdvanceMonth, advanceMonthLabel }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    if (avatarMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarMenuOpen]);

  const handleLogout = () => {
    setAvatarMenuOpen(false);
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-zinc-400 bg-white/80 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-zinc-500 dark:bg-zinc-900/80 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <button
              onClick={onMenuClick}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg
                className="h-6 w-6 text-zinc-700 dark:text-zinc-300"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isSidebarOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="text-xl font-bold transition-colors hover:opacity-80"
          >
            <span className="bg-gradient-to-r from-blue-600 via-green-600 to-purple-600 bg-clip-text text-transparent">
              Pesa Plan
            </span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          {cashAnalysis !== undefined && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 pl-2 pr-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <span className="shrink-0 rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                {cashAnalysis.currentMonthLabel}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">In</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">+{cashAnalysis.currentIn.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Out</span>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">−{cashAnalysis.currentOut.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Net</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{(cashAnalysis.currentIn - cashAnalysis.currentOut).toLocaleString()}</span>
                </div>
              </div>
              {onViewCurrentDetails && (
                <button
                  type="button"
                  onClick={onViewCurrentDetails}
                  aria-label="View current month details"
                  title="View details"
                  className="shrink-0 rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {(availableCash !== undefined || hoursAvailable !== undefined) && (
            <div className="min-w-0 shrink overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/30">
              <span className="block text-[11px] font-medium leading-tight text-emerald-600 dark:text-emerald-400">Available resources</span>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {availableCash !== undefined && (
                  <span className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                    {availableCash.toLocaleString()} cash
                  </span>
                )}
                {availableCash !== undefined && hoursAvailable !== undefined && (
                  <span className="text-emerald-400 dark:text-emerald-500">·</span>
                )}
                {hoursAvailable !== undefined && (
                  <span className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                    {(hoursAvailable ?? 300).toLocaleString()} h
                  </span>
                )}
              </div>
            </div>
          )}
          {portfolioValue !== undefined && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-900/30">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Portfolio</span>
              <span className="ml-1.5 text-lg font-bold tabular-nums text-blue-800 dark:text-blue-200">
                {portfolioValue.toLocaleString()}
              </span>
            </div>
          )}
          {cashAnalysis !== undefined && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 pl-2 pr-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-teal-100 px-2 py-1 text-xs font-bold text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Upcoming
              </span>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">In</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">+{cashAnalysis.nextIn.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Out</span>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">−{cashAnalysis.nextOut.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Net</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{(cashAnalysis.nextIn - cashAnalysis.nextOut).toLocaleString()}</span>
                </div>
              </div>
              {onViewNextDetails && (
                <button
                  type="button"
                  onClick={onViewNextDetails}
                  aria-label="View next month details"
                  title="View details"
                  className="shrink-0 rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {onAdvanceMonth && advanceMonthLabel && (
            <button
              type="button"
              onClick={onAdvanceMonth}
              className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              Advance to {advanceMonthLabel}
            </button>
          )}
          {/* Theme Toggle */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleTheme();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Toggle theme"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? (
              // Moon icon for dark mode
              <svg
                className="h-5 w-5 text-zinc-700 dark:text-zinc-300"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              // Sun icon for light mode
              <svg
                className="h-5 w-5 text-zinc-700 dark:text-zinc-300"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>

          {isAuthenticated ? (
            <div className="relative" ref={avatarMenuRef}>
              <button
                onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                aria-label="Account menu"
                aria-expanded={avatarMenuOpen}
              >
                {user?.first_name?.[0]?.toUpperCase() || "U"}
              </button>
              {avatarMenuOpen && (
                <div className="absolute right-0 top-12 z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-700">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {user?.first_name}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {user?.email}
                    </p>
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
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/login")}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Log In
              </button>
              <button
                onClick={() => router.push("/signup")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

