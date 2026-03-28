"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  className?: string;
  /** Accessible label for the trigger button (default: "Menu"). */
  menuButtonAriaLabel?: string;
  /**
   * When true, the panel is `position: fixed` on `document.body` with a high z-index so it
   * stacks above sticky headers and is not clipped by `overflow: hidden` ancestors.
   */
  overlayOnBody?: boolean;
}

const PANEL_CLASS =
  "min-w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800";

export function DropdownMenu({
  items,
  className = "",
  menuButtonAriaLabel = "Menu",
  overlayOnBody = false,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [fixedPos, setFixedPos] = useState({ top: 0, right: 0 });

  const updateFixedPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFixedPos({
      top: r.bottom + 4,
      right: window.innerWidth - r.right,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !overlayOnBody) return;
    updateFixedPosition();
  }, [isOpen, overlayOnBody, updateFixedPosition]);

  useEffect(() => {
    if (!isOpen || !overlayOnBody) return;
    window.addEventListener("scroll", updateFixedPosition, true);
    window.addEventListener("resize", updateFixedPosition);
    return () => {
      window.removeEventListener("scroll", updateFixedPosition, true);
      window.removeEventListener("resize", updateFixedPosition);
    };
  }, [isOpen, overlayOnBody, updateFixedPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const panel = isOpen ? (
    <div
      ref={panelRef}
      className={
        overlayOnBody
          ? `${PANEL_CLASS} fixed z-200`
          : `${PANEL_CLASS} absolute right-0 top-full z-50 mt-1`
      }
      style={
        overlayOnBody
          ? { top: fixedPos.top, right: fixedPos.right }
          : undefined
      }
      role="menu"
    >
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          role="menuitem"
          title={item.title}
          onClick={() => {
            item.onClick();
            setIsOpen(false);
          }}
          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
            item.danger
              ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label={menuButtonAriaLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {panel && overlayOnBody && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : panel}
    </div>
  );
}
