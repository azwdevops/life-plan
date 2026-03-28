"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Op = "+" | "-" | "*" | "/";

type CalcState = {
  display: string;
  accumulator: number | null;
  pendingOp: Op | null;
  fresh: boolean;
  error: boolean;
};

const initialCalc: CalcState = {
  display: "0",
  accumulator: null,
  pendingOp: null,
  fresh: true,
  error: false,
};

function applyOp(a: number, op: Op, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const rounded = Math.round(n * 1e12) / 1e12;
  let s = Object.is(rounded, -0) ? "0" : String(rounded);
  if (s.length > 14) s = Number(rounded.toPrecision(12)).toString();
  return s;
}

type CalcAction =
  | { type: "DIGIT"; d: string }
  | { type: "OP"; op: Op }
  | { type: "EQUALS" }
  | { type: "CLEAR" }
  | { type: "BACK" }
  | { type: "DOT" };

function calcReducer(state: CalcState, action: CalcAction): CalcState {
  if (state.error && action.type !== "CLEAR") {
    return initialCalc;
  }

  switch (action.type) {
    case "CLEAR":
      return initialCalc;
    case "BACK": {
      if (state.fresh) return state;
      if (state.display.length <= 1) {
        return { ...state, display: "0" };
      }
      return { ...state, display: state.display.slice(0, -1) };
    }
    case "DOT": {
      if (state.fresh) {
        return { ...state, display: "0.", fresh: false };
      }
      if (state.display.includes(".")) return state;
      return { ...state, display: `${state.display}.`, fresh: false };
    }
    case "DIGIT": {
      const d = action.d;
      if (state.fresh) {
        return {
          ...state,
          display: d === "." ? "0." : d,
          fresh: false,
        };
      }
      if (d === "." && state.display.includes(".")) return state;
      if (state.display === "0" && d !== ".") {
        return { ...state, display: d, fresh: false };
      }
      return { ...state, display: state.display + d, fresh: false };
    }
    case "OP": {
      const v = parseFloat(state.display);
      if (Number.isNaN(v)) {
        return { ...initialCalc, display: "Error", error: true };
      }
      if (state.fresh && state.pendingOp) {
        return { ...state, pendingOp: action.op };
      }
      if (
        state.accumulator !== null &&
        state.pendingOp &&
        !state.fresh
      ) {
        const r = applyOp(state.accumulator, state.pendingOp, v);
        if (!Number.isFinite(r)) {
          return { ...initialCalc, display: "Error", error: true };
        }
        const next = formatNum(r);
        return {
          ...state,
          display: next,
          accumulator: r,
          pendingOp: action.op,
          fresh: true,
        };
      }
      return {
        ...state,
        accumulator: v,
        pendingOp: action.op,
        fresh: true,
      };
    }
    case "EQUALS": {
      const v = parseFloat(state.display);
      if (state.accumulator === null || !state.pendingOp) {
        return { ...state, fresh: true };
      }
      const r = applyOp(state.accumulator, state.pendingOp, v);
      if (!Number.isFinite(r)) {
        return { ...initialCalc, display: "Error", error: true };
      }
      return {
        ...initialCalc,
        display: formatNum(r),
        fresh: true,
      };
    }
    default:
      return state;
  }
}

const PANEL_W = 280;
const PANEL_H = 380;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}

interface FloatingCalculatorProps {
  open: boolean;
  onClose: () => void;
}

export function FloatingCalculator({ open, onClose }: FloatingCalculatorProps) {
  const [mounted, setMounted] = useState(false);
  const [calc, dispatch] = useReducer(calcReducer, initialCalc);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragging, setDragging] = useState(false);
  const dragPointerRef = useRef<{ id: number; ox: number; oy: number } | null>(
    null
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || position !== null || typeof window === "undefined") return;
    setPosition({
      x: clamp(
        window.innerWidth - PANEL_W - 24,
        8,
        window.innerWidth - PANEL_W - 8
      ),
      y: clamp(88, 8, window.innerHeight - PANEL_H - 8),
    });
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    el?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        dispatch({ type: "DIGIT", d: e.key });
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        dispatch({ type: "DOT" });
        return;
      }
      if (e.key === "+" || e.key === "-") {
        e.preventDefault();
        dispatch({ type: "OP", op: e.key });
        return;
      }
      if (e.key === "*") {
        e.preventDefault();
        dispatch({ type: "OP", op: "*" });
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        dispatch({ type: "OP", op: "/" });
        return;
      }
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        dispatch({ type: "EQUALS" });
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: "BACK" });
        return;
      }
      if (e.key === "Delete" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        dispatch({ type: "CLEAR" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragPointerRef.current;
      if (!d) return;
      setPosition((prev) => {
        if (!prev) return prev;
        const nx = e.clientX - d.ox;
        const ny = e.clientY - d.oy;
        return {
          x: clamp(nx, 0, window.innerWidth - PANEL_W),
          y: clamp(ny, 0, window.innerHeight - PANEL_H),
        };
      });
    };
    const onUp = (e: PointerEvent) => {
      if (dragPointerRef.current?.id === e.pointerId) {
        dragPointerRef.current = null;
        setDragging(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  const onDragHandleDown = useCallback(
    (e: React.PointerEvent) => {
      if (!position) return;
      if (e.button !== 0) return;
      // Don't start drag from the close button (would swallow its click).
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      dragPointerRef.current = {
        id: e.pointerId,
        ox: e.clientX - position.x,
        oy: e.clientY - position.y,
      };
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position]
  );

  const keyClass =
    "flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

  const opClass =
    "flex h-11 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/50";

  if (!mounted || !open || position === null) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Calculator"
      tabIndex={-1}
      className={`fixed z-100 w-[280px] select-none rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none ring-zinc-400/30 focus-visible:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-zinc-500/30 ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={{ left: position.x, top: position.y }}
    >
      <div
        data-drag-handle
        onPointerDown={onDragHandleDown}
        className="touch-none flex cursor-grab items-center justify-between gap-2 rounded-t-xl border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800/80"
      >
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Calculator
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          aria-label="Close calculator"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3">
        <div
          className="mb-3 min-h-12 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-right font-mono text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          aria-live="polite"
        >
          {calc.display}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "CLEAR" })}>
            C
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "BACK" })}>
            ⌫
          </button>
          <button type="button" className={opClass} onClick={() => dispatch({ type: "OP", op: "/" })}>
            ÷
          </button>
          <button type="button" className={opClass} onClick={() => dispatch({ type: "OP", op: "*" })}>
            ×
          </button>

          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "7" })}>
            7
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "8" })}>
            8
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "9" })}>
            9
          </button>
          <button type="button" className={opClass} onClick={() => dispatch({ type: "OP", op: "-" })}>
            −
          </button>

          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "4" })}>
            4
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "5" })}>
            5
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "6" })}>
            6
          </button>
          <button type="button" className={opClass} onClick={() => dispatch({ type: "OP", op: "+" })}>
            +
          </button>

          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "1" })}>
            1
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "2" })}>
            2
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DIGIT", d: "3" })}>
            3
          </button>
          <button
            type="button"
            className="row-span-2 flex h-auto min-h-25 items-center justify-center rounded-lg border border-blue-200 bg-blue-600 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98] dark:border-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            onClick={() => dispatch({ type: "EQUALS" })}
          >
            =
          </button>

          <button
            type="button"
            className={`${keyClass} col-span-2`}
            onClick={() => dispatch({ type: "DIGIT", d: "0" })}
          >
            0
          </button>
          <button type="button" className={keyClass} onClick={() => dispatch({ type: "DOT" })}>
            .
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
