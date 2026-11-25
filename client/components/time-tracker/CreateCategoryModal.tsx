"use client";

import { useEffect, useRef, useState } from "react";
import { type TimeTrackerCategory } from "@/lib/time-tracker-storage";
import {
  useCreateTimeTrackerCategory,
  useUpdateTimeTrackerCategory,
} from "@/lib/hooks/use-time-tracker-subjects";
import { RightDrawer } from "@/components/RightDrawer";

type Props = {
  open: boolean;
  initialName: string;
  categories: TimeTrackerCategory[];
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
  /** When set, edits this category instead of creating a new one. */
  editTarget?: TimeTrackerCategory | null;
  /** @default 0 */
  stackLevel?: number;
};

export function CreateCategoryModal({
  open,
  initialName,
  categories,
  onClose,
  onCreated,
  editTarget = null,
  stackLevel = 0,
}: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createCategory = useCreateTimeTrackerCategory();
  const updateCategory = useUpdateTimeTrackerCategory();
  const saving = createCategory.isPending || updateCategory.isPending;
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(editTarget ? editTarget.name : initialName);
      setError(null);
    }
  }, [open, initialName, editTarget]);

  useEffect(() => {
    if (open) nameInputRef.current?.focus();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (
      categories.some(
        (c) =>
          c.id !== editTarget?.id && c.name.toLowerCase() === n.toLowerCase()
      )
    ) {
      setError("A category with this name already exists");
      return;
    }
    try {
      if (editTarget) {
        const category = await updateCategory.mutateAsync({
          id: editTarget.id,
          body: { name: n },
        });
        onCreated(category.id, n);
      } else {
        const category = await createCategory.mutateAsync({ name: n });
        onCreated(category.id, n);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    }
  };

  return (
    <RightDrawer
      open={open}
      onClose={onClose}
      title={editTarget ? "Edit category" : "New category"}
      width="sm"
      stackLevel={stackLevel}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="create-category-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name
          </label>
          <input
            ref={nameInputRef}
            id="create-category-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
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
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {editTarget ? "Save changes" : "Save category"}
          </button>
        </div>
      </form>
    </RightDrawer>
  );
}
