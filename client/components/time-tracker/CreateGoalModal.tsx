"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  type TimeTrackerGoal,
  newId,
  saveGoals,
} from "@/lib/time-tracker-storage";

type Props = {
  open: boolean;
  initialName: string;
  goals: TimeTrackerGoal[];
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
};

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreateGoalModal({
  open,
  initialName,
  goals,
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setEndDate(null);
    }
  }, [open, initialName]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (
      goals.some((g) => g.name.toLowerCase() === n.toLowerCase())
    ) {
      return;
    }
    const id = newId();
    const end: string | null = endDate ? toLocalYmd(endDate) : null;
    const next: TimeTrackerGoal[] = [...goals, { id, name: n, endDate: end }];
    saveGoals(next);
    onCreated(id, n);
    onClose();
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-goal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2
          id="create-goal-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          New goal
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="create-goal-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="create-goal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              required
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="create-goal-end"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Target end date (optional)
            </label>
            <DatePicker
              id="create-goal-end"
              selected={endDate}
              onChange={(d: Date | null) => setEndDate(d)}
              isClearable
              placeholderText="Optional"
              dateFormat="yyyy-MM-dd"
              popperPlacement="bottom-start"
              popperClassName="react-datepicker-popper-no-backdrop react-datepicker-popper-create-goal-modal"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500"
              wrapperClassName="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Save goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
