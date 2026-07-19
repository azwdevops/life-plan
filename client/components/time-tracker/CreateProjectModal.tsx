"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type TimeTrackerGoal,
  type TimeTrackerProject,
  newId,
} from "@/lib/time-tracker-storage";
import {
  useAddTimeTrackerProjectToCache,
  useUpdateTimeTrackerProjectInCache,
} from "@/lib/hooks/use-time-tracker-subjects";
import { RightDrawer } from "@/components/RightDrawer";
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
  /** When set, edits this project instead of creating a new one. */
  editTarget?: TimeTrackerProject | null;
  /** @default 0 */
  stackLevel?: number;
};

export function CreateProjectModal({
  open,
  initialName,
  goals,
  projects,
  onClose,
  onCreated,
  refreshGoals,
  editTarget = null,
  stackLevel = 0,
}: Props) {
  const [name, setName] = useState("");
  const [goalId, setGoalId] = useState<string>("");
  const [goalLabel, setGoalLabel] = useState("");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalInitial, setGoalModalInitial] = useState("");
  const addProjectToCache = useAddTimeTrackerProjectToCache();
  const updateProjectInCache = useUpdateTimeTrackerProjectInCache();
  const nameInputRef = useRef<HTMLInputElement>(null);

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
      setName(editTarget ? editTarget.name : initialName);
      const targetGoalId = editTarget?.goalId ?? "";
      setGoalId(targetGoalId);
      setGoalLabel(
        targetGoalId
          ? goals.find((g) => g.id === targetGoalId)?.name ?? ""
          : ""
      );
      setGoalModalOpen(false);
      setGoalModalInitial("");
    }
  }, [open, initialName, editTarget, goals]);

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
      projects.some(
        (p) =>
          p.id !== editTarget?.id && p.name.toLowerCase() === n.toLowerCase()
      )
    ) {
      return;
    }
    const gid = goalId === "" ? null : goalId;
    if (editTarget) {
      const project: TimeTrackerProject = { ...editTarget, name: n, goalId: gid };
      updateProjectInCache(project);
      onCreated(project.id, n);
    } else {
      const id = newId();
      const project: TimeTrackerProject = { id, name: n, goalId: gid };
      addProjectToCache(project);
      onCreated(id, n);
    }
    onClose();
  };

  return (
    <>
      <RightDrawer
        open={open}
        onClose={onClose}
        title={editTarget ? "Edit project" : "New project"}
        width="sm"
        stackLevel={stackLevel}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="create-project-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              ref={nameInputRef}
              id="create-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              required
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
              {editTarget ? "Save changes" : "Save project"}
            </button>
          </div>
        </form>
      </RightDrawer>

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
        stackLevel={stackLevel + 1}
      />
    </>
  );
}
