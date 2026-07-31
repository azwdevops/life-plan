"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface RowActionsMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/**
 * Per-row "more actions" kebab menu — hand-built fixed-position dropdown
 * matching the project convention (see CLAUDE.md "More actions (kebab)
 * menus"; reference implementation is SubjectItemMenu in
 * client/components/productivity/TimeTrackingPanel.tsx).
 */
export function RowActionsMenu({
  items,
  ariaLabel = "More actions",
  offset = { x: 0, y: 0 },
}: {
  items: RowActionsMenuItem[];
  ariaLabel?: string;
  offset?: { x: number; y: number };
}) {
  const [open, setOpen] = useState(false);
  const [menuFixed, setMenuFixed] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updateMenuPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gapBelowButton = 4;
    setMenuFixed({
      top: r.bottom + gapBelowButton + offset.y,
      right: window.innerWidth - r.right - offset.x,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset.x, offset.y]);

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

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 17 17" fill="currentColor" aria-hidden>
          <path d="M16 2v2h-11v-2h11zM5 9h11v-2h-11v2zM5 14h11v-2h-11v2zM2 2c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1zM2 7c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1zM2 12c-0.552 0-1 0.447-1 1s0.448 1 1 1 1-0.447 1-1-0.448-1-1-1z" />
        </svg>
      </button>
      {open && menuFixed ? (
        <ul
          className="fixed z-[70] min-w-36 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ top: menuFixed.top, right: menuFixed.right }}
          role="menu"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`w-full px-3 py-2 text-left transition-colors ${
                  item.danger
                    ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
