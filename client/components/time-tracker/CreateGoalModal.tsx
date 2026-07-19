"use client";

import { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { type TimeTrackerGoal, newId } from "@/lib/time-tracker-storage";
import {
  useAddTimeTrackerGoalToCache,
  useUpdateTimeTrackerGoalInCache,
} from "@/lib/hooks/use-time-tracker-subjects";
import { RightDrawer } from "@/components/RightDrawer";

type Props = {
  open: boolean;
  initialName: string;
  goals: TimeTrackerGoal[];
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
  /** When set, edits this goal instead of creating a new one. */
  editTarget?: TimeTrackerGoal | null;
  /** @default 0 */
  stackLevel?: number;
};

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalYmd(s: string): Date | null {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function CreateGoalModal({
  open,
  initialName,
  goals,
  onClose,
  onCreated,
  editTarget = null,
  stackLevel = 0,
}: Props) {
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState<Date | null>(null);
  const addGoalToCache = useAddTimeTrackerGoalToCache();
  const updateGoalInCache = useUpdateTimeTrackerGoalInCache();
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(editTarget ? editTarget.name : initialName);
      setEndDate(editTarget?.endDate ? parseLocalYmd(editTarget.endDate) : null);
    }
  }, [open, initialName, editTarget]);

  // RightDrawer stays mounted while closed, so native `autoFocus` (mount-time
  // only) would fire while off-screen and scroll the page to it. Focus only
  // when the drawer actually opens instead.
  useEffect(() => {
    if (open) nameInputRef.current?.focus();
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (
      goals.some(
        (g) =>
          g.id !== editTarget?.id && g.name.toLowerCase() === n.toLowerCase()
      )
    ) {
      return;
    }
    const end: string | null = endDate ? toLocalYmd(endDate) : null;
    if (editTarget) {
      const goal: TimeTrackerGoal = { ...editTarget, name: n, endDate: end };
      updateGoalInCache(goal);
      onCreated(goal.id, n);
    } else {
      const id = newId();
      const goal: TimeTrackerGoal = { id, name: n, endDate: end };
      addGoalToCache(goal);
      onCreated(id, n);
    }
    onClose();
  };

  return (
    <RightDrawer
      open={open}
      onClose={onClose}
      title={editTarget ? "Edit goal" : "New goal"}
      width="sm"
      stackLevel={stackLevel}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="create-goal-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name
          </label>
          <input
            ref={nameInputRef}
            id="create-goal-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            required
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
            {editTarget ? "Save changes" : "Save goal"}
          </button>
        </div>
      </form>
    </RightDrawer>
  );
}
