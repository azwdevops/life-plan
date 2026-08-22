"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { HeaderTimeTracker } from "@/components/HeaderTimeTracker";
import { HeaderCountdownTimer } from "@/components/HeaderCountdownTimer";
import { HeaderWithdrawalBank } from "@/components/HeaderWithdrawalBank";
import { usePageHeaderActionsValue, usePageHeaderExtraValue, usePageHeaderMenuExtraValue, type PageHeaderAction } from "@/contexts/PageHeaderActionsContext";

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
  /** Optional inline center content shown in main header row */
  centerContent?: ReactNode;
  /** Optional second row content shown below main header row */
  subHeaderContent?: ReactNode;
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

/**
 * "More actions" menu for page-level buttons registered via usePageHeaderActions.
 * Mirrors SubjectItemMenu in TimeTrackingPanel.tsx (fixed-positioned dropdown,
 * getBoundingClientRect + useLayoutEffect, click-outside-to-close), per the
 * project's "More actions (kebab) menus" convention.
 */
function HeaderMoreActionsMenu({ actions, menuExtra }: { actions: PageHeaderAction[]; menuExtra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [menuFixed, setMenuFixed] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updateMenuPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gapBelowButton = 4;
    // offset follows the same convention as SubjectItemMenu/biz-poa's DropdownMenu:
    // negative x/y nudge the menu left/up from its default right-aligned, gap-below position.
    const offset = { x: 0, y: 0 };
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
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (actions.length === 0 && !menuExtra) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg className="h-5 w-5" viewBox="0 0 17 17" fill="currentColor" aria-hidden>
          <path d="M16 2v2h-11v-2h11zM5 9h11v-2h-11v2zM5 14h11v-2h-11v2zM2 2c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1zM2 7c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1zM2 12c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1z" />
        </svg>
      </button>
      {open && menuFixed ? (
        <div
          role="dialog"
          className="fixed z-[55] min-w-44 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ top: menuFixed.top, right: menuFixed.right }}
        >
          {menuExtra ? (
            <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">{menuExtra}</div>
          ) : null}
          <ul role="menu">
            {actions.map((action) => (
              <li key={action.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    action.variant === "danger"
                      ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => {
                    setOpen(false);
                    action.onClick();
                  }}
                >
                  {action.icon}
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function Header({ onMenuClick, isSidebarOpen, centerContent, subHeaderContent, availableCash, hoursAvailable, portfolioValue, cashAnalysis, onViewCurrentDetails, onViewNextDetails, onAdvanceMonth, advanceMonthLabel }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const showHeaderTimeTracker = useMediaQuery("(min-width: 768px)");
  const pageHeaderActions = usePageHeaderActionsValue();
  const pageHeaderExtra = usePageHeaderExtraValue();
  const pageHeaderMenuExtra = usePageHeaderMenuExtraValue();

  return (
    <header
      id="app-site-header"
      className="sticky top-0 z-50 w-full border-b-2 border-zinc-400 bg-white/80 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-zinc-500 dark:bg-zinc-900/80 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]"
    >
      <div className="flex h-16 items-center gap-3 pl-1.5 pr-4 md:pl-2 md:pr-6">
        <div className="flex shrink-0 items-center gap-1">
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
            className="shrink-0 text-xl font-bold transition-colors hover:opacity-80"
          >
            <span className="bg-gradient-to-r from-blue-600 via-green-600 to-purple-600 bg-clip-text text-transparent">
              Life Plan
            </span>
          </button>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-x-auto overflow-y-visible px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 md:gap-x-5">
            {isAuthenticated && showHeaderTimeTracker === true ? (
              <>
                <HeaderTimeTracker inline />
                <HeaderCountdownTimer inline />
              </>
            ) : null}
            {centerContent ? (
              <div className="flex min-w-0 justify-center">{centerContent}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
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
              <div className="flex flex-col gap-0.5">
                {availableCash !== undefined && (
                  <span className="text-xs font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                    {availableCash.toLocaleString()} cash
                  </span>
                )}
                {hoursAvailable !== undefined && (
                  <span className="text-xs font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                    {(hoursAvailable ?? 300).toLocaleString()} hours
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
          {pageHeaderExtra}
          <HeaderMoreActionsMenu actions={pageHeaderActions} menuExtra={pageHeaderMenuExtra} />
          <HeaderWithdrawalBank />

          {!isAuthenticated && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/login")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Log In
              </button>
            </div>
          )}
        </div>
      </div>
      {subHeaderContent && (
        <div className="border-t border-zinc-200/80 dark:border-zinc-700/80">
          <div className="px-4 py-2 md:px-6">{subHeaderContent}</div>
        </div>
      )}
    </header>
  );
}

