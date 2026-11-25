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
  /** Merged onto the trigger input (e.g. py-2 text-sm in modals). */
  triggerClassName?: string;
  /** Panel stacks above modals when set (e.g. z-[10050]). Default z-[9999]. */
  panelZClass?: string;
  /** Optional first row to clear selection (e.g. no parent goal). */
  noneOptionLabel?: string;
  onSelectNone?: () => void;
  /** Override default Create "…" row label. */
  formatCreateLabel?: (suggested: string) => string;
};

/** Closed state looks like a select; focusing the field itself opens the list and lets
 * you type directly into it to filter - no separate search box inside the panel. */
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
  const triggerRef = useRef<HTMLInputElement>(null);
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

  const openWithCurrentValue = () => {
    if (disabled) return;
    setPanelFilter(valueLabel);
    setOpen(true);
  };

  const selectExisting = (id: string, name: string) => {
    onSelectExisting(id, name);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      e.currentTarget.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (exact) {
        selectExisting(exact.id, exact.name);
      } else if (showCreate) {
        onRequestCreate(trimmed);
        setOpen(false);
      }
    }
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
              No items yet. Type to create one.
            </li>
          ) : null}
          {filtered.map((i) => (
            <li key={i.id} role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectExisting(i.id, i.name)}
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
      <input
        ref={triggerRef}
        type="text"
        id={instanceId}
        disabled={disabled}
        value={open ? panelFilter : valueLabel}
        onChange={(e) => {
          if (!open) setOpen(true);
          setPanelFilter(e.target.value);
        }}
        onFocus={(e) => {
          openWithCurrentValue();
          e.target.select();
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        placeholder={triggerPlaceholder}
        autoComplete="off"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${instanceId}-listbox`}
        aria-autocomplete="list"
        className={`w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-left text-xs text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-none dark:placeholder:text-zinc-500 dark:focus:border-blue-500 ${triggerClassName ?? ""}`}
      />
      {panel && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
