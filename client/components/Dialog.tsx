"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** @default "info" */
  variant?: "info" | "danger";
}

export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  variant = "info",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Handle click outside
  const handleOverlayClick = () => {
      onClose();
  };

  if (!isOpen || !mounted) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-6xl",
  };

  const variantClasses =
    variant === "danger"
      ? {
          border: "border-red-500 dark:border-red-400",
          shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(239, 68, 68, 0.3)",
          headerBorder: "border-red-500 dark:border-red-400",
          headerBg: "bg-red-50 dark:bg-red-900/20",
        }
      : {
          border: "border-blue-500 dark:border-blue-400",
          shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.3)",
          headerBorder: "border-blue-500 dark:border-blue-400",
          headerBg: "bg-blue-50 dark:bg-blue-900/20",
        };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={handleOverlayClick}
      />
      
      {/* Dialog Content */}
      <div
        ref={dialogRef}
        className={`relative z-10 w-full ${sizeClasses[size]} rounded-xl border-4 ${variantClasses.border} bg-white dark:bg-zinc-900 pointer-events-auto`}
        onClick={(e) => e.stopPropagation()}
        style={{
          overflow: "visible",
          boxShadow: variantClasses.shadow
        }}
      >
        {/* Header */}
        {title && (
          <div className={`flex items-center justify-between border-b-2 ${variantClasses.headerBorder} ${variantClasses.headerBg} px-6 py-4`}>
            <h2
              id="dialog-title"
              className="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Close dialog"
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
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-8rem)] overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

