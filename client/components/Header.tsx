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

export function Header({ onMenuClick, isSidebarOpen, availableCash, portfolioValue, cashAnalysis, onViewCurrentDetails, onViewNextDetails, onAdvanceMonth, advanceMonthLabel }: HeaderProps) {
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
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
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
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 pl-2 pr-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <span className="shrink-0 rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                {cashAnalysis.currentMonthLabel}
              </span>
              <span className="font-medium text-zinc-500 dark:text-zinc-400 text-xs">Current:</span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">+{cashAnalysis.currentIn.toLocaleString()}</span>
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-sm font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">−{cashAnalysis.currentOut.toLocaleString()}</span>
              <span className="font-medium text-zinc-500 dark:text-zinc-400 text-xs">net</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-sm font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{(cashAnalysis.currentIn - cashAnalysis.currentOut).toLocaleString()}</span>
              {onViewCurrentDetails && (
                <button
                  type="button"
                  onClick={onViewCurrentDetails}
                  className="ml-1 shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  View details
                </button>
              )}
            </div>
          )}
          {availableCash !== undefined && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-900/30">
              <span className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                {availableCash.toLocaleString()}
              </span>
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
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 pl-2 pr-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <span className="font-medium text-zinc-500 dark:text-zinc-400 text-xs">Next:</span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">+{cashAnalysis.nextIn.toLocaleString()}</span>
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-sm font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">−{cashAnalysis.nextOut.toLocaleString()}</span>
              <span className="font-medium text-zinc-500 dark:text-zinc-400 text-xs">net</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-sm font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{(cashAnalysis.nextIn - cashAnalysis.nextOut).toLocaleString()}</span>
              {onViewNextDetails && (
                <button
                  type="button"
                  onClick={onViewNextDetails}
                  className="ml-1 shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  View details
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

