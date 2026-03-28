"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type TimeTrackerGoal,
  type TimeTrackerProject,
  newId,
  saveProjects,
} from "@/lib/time-tracker-storage";
import { CreateGoalModal } from "./CreateGoalModal";
import { SearchableSelectPicker } from "./SearchableSelectPicker";

type Props = {
  open: boolean;
  initialName: string;
  goals: TimeTrackerGoal[];
  projects: TimeTrackerProject[];
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
  refreshGoals: () => void;
};

export function CreateProjectModal({
  open,
  initialName,
  goals,
  projects,
  onClose,
  onCreated,
  refreshGoals,
}: Props) {
  const [name, setName] = useState("");
  const [goalId, setGoalId] = useState<string>("");
  const [goalLabel, setGoalLabel] = useState("");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalInitial, setGoalModalInitial] = useState("");

  const goalPickerItems = useMemo(
    () =>
      goals.map((g) => ({
        id: g.id,
        name: g.endDate ? `${g.name} (by ${g.endDate})` : g.name,
        matchKey: g.name,
      })),
    [goals]
  );

  useEffect(() => {
    if (open) {
      setName(initialName);
      setGoalId("");
      setGoalLabel("");
      setGoalModalOpen(false);
      setGoalModalInitial("");
    }
  }, [open, initialName]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (projects.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      return;
    }
    const id = newId();
    const gid = goalId === "" ? null : goalId;
    const next: TimeTrackerProject[] = [
      ...projects,
      { id, name: n, goalId: gid },
    ];
    saveProjects(next);
    onCreated(id, n);
    onClose();
  };

  const projectOverlay = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2
          id="create-project-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          New project
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="create-project-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="create-project-name"
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
              htmlFor="create-project-goal-picker"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Under goal (optional)
            </label>
            <div className="mt-1">
              <SearchableSelectPicker
                instanceId="create-project-goal-picker"
                items={goalPickerItems}
                valueLabel={goalLabel}
                triggerPlaceholder="Search goals or create…"
                onSelectExisting={(id, label) => {
                  setGoalId(id);
                  setGoalLabel(label);
                }}
                onRequestCreate={(suggested) => {
                  setGoalModalInitial(suggested);
                  setGoalModalOpen(true);
                }}
                allowCreate
                noneOptionLabel="No parent goal"
                onSelectNone={() => {
                  setGoalId("");
                  setGoalLabel("");
                }}
                panelZClass="z-[10050]"
                triggerClassName="rounded-lg py-2 text-sm"
                formatCreateLabel={(t) => `Create goal "${t}"`}
                className="w-full"
              />
            </div>
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
              Save project
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(projectOverlay, document.body)
        : null}

      <CreateGoalModal
        open={goalModalOpen}
        initialName={goalModalInitial}
        goals={goals}
        onClose={() => setGoalModalOpen(false)}
        onCreated={(newGoalId, newName) => {
          refreshGoals();
          setGoalId(newGoalId);
          setGoalLabel(newName);
          setGoalModalOpen(false);
        }}
      />
    </>
  );
}
