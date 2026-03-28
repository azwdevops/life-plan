"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SearchablePickerItem = {
  id: string;
  name: string;
  /** If set, filtering and “exact match” use this (e.g. base name when label includes extra text). */
  matchKey?: string;
};

type Props = {
  instanceId: string;
  items: SearchablePickerItem[];
  /** Shown on the closed trigger (e.g. selected name). */
  valueLabel: string;
  triggerPlaceholder: string;
  onSelectExisting: (id: string, name: string) => void;
  /** Opens create flow with suggested name from search. */
  onRequestCreate: (name: string) => void;
  disabled?: boolean;
  allowCreate: boolean;
  className?: string;
  /** Merged onto the trigger button (e.g. py-2 text-sm in modals). */
  triggerClassName?: string;
  /** Panel stacks above modals when set (e.g. z-[10050]). Default z-[9999]. */
  panelZClass?: string;
  /** Optional first row to clear selection (e.g. no parent goal). */
  noneOptionLabel?: string;
  onSelectNone?: () => void;
  /** Override default Create "…" row label. */
  formatCreateLabel?: (suggested: string) => string;
};

/** Closed state looks like a select; open shows search + scrollable list (+ optional create row). */
export function SearchableSelectPicker({
  instanceId,
  items,
  valueLabel,
  triggerPlaceholder,
  onSelectExisting,
  onRequestCreate,
  disabled,
  allowCreate,
  className,
  triggerClassName,
  panelZClass = "z-[9999]",
  noneOptionLabel,
  onSelectNone,
  formatCreateLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [panelFilter, setPanelFilter] = useState("");
  const [panelBox, setPanelBox] = useState({ top: 0, left: 0, width: 160 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const trimmed = panelFilter.trim();
  const q = trimmed.toLowerCase();
  const keyOf = (i: SearchablePickerItem) =>
    (i.matchKey ?? i.name).toLowerCase();
  const filtered =
    q === "" ? items : items.filter((i) => keyOf(i).includes(q));
  const exact = items.find((i) => keyOf(i) === q);
  const showCreate = allowCreate && trimmed.length > 0 && !exact;

  const syncPanelPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelBox({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 168),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    syncPanelPosition();
  }, [open, syncPanelPosition]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", syncPanelPosition, true);
    window.addEventListener("resize", syncPanelPosition);
    return () => {
      window.removeEventListener("scroll", syncPanelPosition, true);
      window.removeEventListener("resize", syncPanelPosition);
    };
  }, [open, syncPanelPosition]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPanelFilter("");
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  const panel =
    open && !disabled ? (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: panelBox.top,
          left: panelBox.left,
          width: panelBox.width,
        }}
        className={`${panelZClass} rounded-md border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40`}
      >
        <div className="border-b border-zinc-200 p-1.5 dark:border-zinc-700">
          <input
            type="search"
            placeholder="Search list…"
            value={panelFilter}
            onChange={(e) => setPanelFilter(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500"
            autoComplete="off"
          />
        </div>
        <ul
          id={`${instanceId}-listbox`}
          role="listbox"
          className="max-h-44 overflow-y-auto py-1"
        >
          {noneOptionLabel && onSelectNone ? (
            <li key="__none__" role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectNone();
                  setOpen(false);
                }}
              >
                {noneOptionLabel}
              </button>
            </li>
          ) : null}
          {items.length === 0 && !showCreate ? (
            <li className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              No items yet — type below to create one
            </li>
          ) : null}
          {filtered.map((i) => (
            <li key={i.id} role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectExisting(i.id, i.name);
                  setOpen(false);
                }}
              >
                {i.name}
              </button>
            </li>
          ))}
          {filtered.length === 0 && items.length > 0 && !showCreate ? (
            <li className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              No matches
            </li>
          ) : null}
          {showCreate ? (
            <li role="option" className="border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onRequestCreate(trimmed);
                  setOpen(false);
                }}
              >
                {formatCreateLabel
                  ? formatCreateLabel(trimmed)
                  : `Create "${trimmed}"`}
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    ) : null;

  return (
    <div className={`relative ${className ?? ""}`} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        id={instanceId}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${instanceId}-listbox`}
        className={`flex w-full min-w-0 items-center justify-between gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-left text-xs shadow-sm disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:shadow-none ${triggerClassName ?? ""}`}
      >
        <span
          className={
            valueLabel
              ? "truncate text-zinc-900 dark:text-zinc-100"
              : "truncate text-zinc-400 dark:text-zinc-500"
          }
        >
          {valueLabel || triggerPlaceholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {panel && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
