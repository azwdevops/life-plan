"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { registerDrawerStackEntry } from "./drawerStack";

interface RightDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Extra controls shown in the header, between the title and the close button (e.g. a search input, an "Add" button). */
  actions?: ReactNode;
  children: ReactNode;
  /** @default "sm" */
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  /** Set to 1+ when this drawer can open on top of another already-open drawer, so z-index and Escape-to-close stack correctly. @default 0 */
  stackLevel?: number;
}

const WIDTH_CLASSES: Record<NonNullable<RightDrawerProps["width"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
  "3xl": "max-w-4xl",
  full: "",
};

/**
 * Right-side drawer, always mounted so opening/closing is a pure CSS
 * transform transition instead of a mount/unmount pop. Reuse this for any
 * section that needs a right sidebar (detail panels, pickers, filters, add
 * forms, etc.) instead of a centered dialog — right sidebars are the
 * preferred pattern in this app.
 *
 * Portals to `document.body` so it's never affected by an ancestor's CSS —
 * in particular, an ancestor with any `transform` (e.g. another open
 * RightDrawer's own slide animation) would otherwise become this drawer's
 * containing block and break its `position: fixed` positioning, causing it
 * to add to page width / participate in layout instead of overlaying it.
 */
export function RightDrawer({
  open,
  onClose,
  title,
  actions,
  children,
  width = "sm",
  stackLevel = 0,
}: RightDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const zBackdrop = 40 + stackLevel * 10;
  const zPanel = 50 + stackLevel * 10;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else if (stackLevel === 0) document.body.style.overflow = "";
    return () => {
      if (stackLevel === 0) document.body.style.overflow = "";
    };
  }, [open, stackLevel]);

  useEffect(() => {
    if (!open) return;
    return registerDrawerStackEntry(stackLevel, onClose);
  }, [open, stackLevel, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: zBackdrop }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 flex w-full ${WIDTH_CLASSES[width]} flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-zinc-700 dark:bg-zinc-900 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ zIndex: zPanel }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <h2 className="shrink-0 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {actions ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {actions}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </aside>
    </>,
    document.body
  );
}
