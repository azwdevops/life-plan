"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createFeasibilityProject,
  deleteFeasibilityProject as deleteFeasibilityProjectRequest,
  listFeasibilityProjects,
  updateFeasibilityProject,
  type FeasibilityProjectApi,
} from "@/lib/api/investments";

type CostLineItem = {
  id: string;
  label: string;
  unitCost: number;
  quantity: number;
};

type FeasibilityProject = {
  id: string;
  name: string;
  items: CostLineItem[];
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function lineTotal(item: CostLineItem): number {
  const unit = Number.isFinite(item.unitCost) ? item.unitCost : 0;
  const q = Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0;
  return unit * q;
}

function isServerProjectId(id: string): boolean {
  return /^\d+$/.test(id);
}

function fromApiProject(p: FeasibilityProjectApi): FeasibilityProject {
  return {
    id: String(p.id),
    name: p.name,
    items: p.items.map((it) => ({
      id: String(it.id),
      label: it.label,
      unitCost: it.unit_cost,
      quantity: it.quantity,
    })),
  };
}

type ItemDialogMode = "add" | "edit";
type ProjectDialogMode = "create" | "edit";
type DestructiveConfirmKind = "delete-project" | "reset-worksheet";

export function FeasibilityAnalysisTab() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<FeasibilityProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const projectsRef = useRef<FeasibilityProject[]>([]);
  projectsRef.current = projects;
  const persistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogMode, setProjectDialogMode] =
    useState<ProjectDialogMode>("create");
  const [projectDialogTargetId, setProjectDialogTargetId] = useState<
    string | null
  >(null);
  const [draftProjectName, setDraftProjectName] = useState("");

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDialogProjectId, setItemDialogProjectId] = useState<string | null>(
    null
  );
  const [dialogMode, setDialogMode] = useState<ItemDialogMode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draftLabel, setDraftLabel] = useState("");
  const [draftUnitCost, setDraftUnitCost] = useState<number | "">("");
  const [draftQuantity, setDraftQuantity] = useState(1);

  const [itemsListOpen, setItemsListOpen] = useState(false);
  const [itemsListProjectId, setItemsListProjectId] = useState<string | null>(
    null
  );

  const [destructiveConfirmOpen, setDestructiveConfirmOpen] = useState(false);
  const [destructiveConfirmKind, setDestructiveConfirmKind] =
    useState<DestructiveConfirmKind | null>(null);
  const [destructiveConfirmProjectId, setDestructiveConfirmProjectId] =
    useState<string | null>(null);

  const itemsListProject =
    itemsListProjectId != null
      ? projects.find((p) => p.id === itemsListProjectId)
      : undefined;

  const persistProject = useCallback(
    async (projectId: string) => {
      if (!token || !isServerProjectId(projectId)) return;
      const proj = projectsRef.current.find((p) => p.id === projectId);
      if (!proj) return;
      try {
        setSyncError(null);
        const updated = await updateFeasibilityProject(
          token,
          parseInt(projectId, 10),
          {
            name: proj.name.trim() || "-",
            items: proj.items.map((it) => ({
              label: it.label.trim() || "Item",
              unit_cost: it.unitCost,
              quantity: it.quantity,
            })),
          }
        );
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? fromApiProject(updated) : p))
        );
      } catch {
        setSyncError("Could not save changes.");
      }
    },
    [token]
  );

  const schedulePersist = useCallback(
    (projectId: string) => {
      if (!isServerProjectId(projectId)) return;
      const timers = persistTimersRef.current;
      const prev = timers[projectId];
      if (prev) clearTimeout(prev);
      timers[projectId] = setTimeout(() => {
        delete timers[projectId];
        void persistProject(projectId);
      }, 450);
    },
    [persistProject]
  );

  useEffect(() => {
    if (!token) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    setProjectsLoading(true);
    setSyncError(null);
    listFeasibilityProjects(token)
      .then((list) => {
        if (!cancelled) setProjects(list.map(fromApiProject));
      })
      .catch(() => {
        if (!cancelled) setSyncError("Could not load feasibility projects.");
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const closeItemsListDialog = useCallback(() => {
    setItemsListOpen(false);
    setItemsListProjectId(null);
  }, []);

  const openViewItems = useCallback((projectId: string) => {
    setItemsListProjectId(projectId);
    setItemsListOpen(true);
  }, []);

  const resetDraft = useCallback(() => {
    setDraftLabel("");
    setDraftUnitCost("");
    setDraftQuantity(1);
  }, []);

  const closeItemDialog = useCallback(() => {
    setItemDialogOpen(false);
    setItemDialogProjectId(null);
    setEditingId(null);
    resetDraft();
  }, [resetDraft]);

  const openAddAppend = useCallback(
    (projectId: string) => {
      setItemDialogProjectId(projectId);
      setDialogMode("add");
      setEditingId(null);
      resetDraft();
      setItemDialogOpen(true);
    },
    [resetDraft]
  );

  const openCreateProject = useCallback(() => {
    setProjectDialogMode("create");
    setProjectDialogTargetId(null);
    setDraftProjectName("");
    setProjectDialogOpen(true);
  }, []);

  const openEditProject = useCallback((projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    setProjectDialogMode("edit");
    setProjectDialogTargetId(projectId);
    setDraftProjectName(p?.name ?? "");
    setProjectDialogOpen(true);
  }, [projects]);

  const closeProjectDialog = useCallback(() => {
    setProjectDialogOpen(false);
  }, []);

  const saveProjectDialog = useCallback(() => {
    const trimmed = draftProjectName.trim();
    if (projectDialogMode === "create") {
      if (!trimmed) return;
      if (!token) {
        setSyncError("Sign in to create projects.");
        return;
      }
      void (async () => {
        try {
          setSyncError(null);
          const created = await createFeasibilityProject(token, {
            name: trimmed,
            items: [],
          });
          setProjects((prev) => [...prev, fromApiProject(created)]);
          setProjectDialogOpen(false);
        } catch {
          setSyncError("Could not create project.");
        }
      })();
      return;
    }
    if (projectDialogTargetId) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectDialogTargetId ? { ...p, name: trimmed } : p
        )
      );
      setProjectDialogOpen(false);
      if (token && isServerProjectId(projectDialogTargetId)) {
        schedulePersist(projectDialogTargetId);
      }
    }
  }, [
    draftProjectName,
    projectDialogMode,
    projectDialogTargetId,
    schedulePersist,
    token,
  ]);

  const deleteProjectById = useCallback(
    async (projectId: string) => {
      if (token && isServerProjectId(projectId)) {
        try {
          setSyncError(null);
          await deleteFeasibilityProjectRequest(
            token,
            parseInt(projectId, 10)
          );
        } catch {
          setSyncError("Could not delete project.");
          return;
        }
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setProjectDialogOpen(false);
      if (itemDialogProjectId === projectId) closeItemDialog();
      if (itemsListProjectId === projectId) closeItemsListDialog();
    },
    [
      closeItemDialog,
      closeItemsListDialog,
      itemDialogProjectId,
      itemsListProjectId,
      token,
    ]
  );

  const openEditLine = useCallback(
    (projectId: string, rowId: string) => {
      const project = projects.find((p) => p.id === projectId);
      const row = project?.items.find((i) => i.id === rowId);
      if (!row) return;
      setItemDialogProjectId(projectId);
      setDialogMode("edit");
      setEditingId(rowId);
      setDraftLabel(row.label);
      setDraftUnitCost(row.unitCost === 0 ? "" : row.unitCost);
      setDraftQuantity(Math.max(1, Math.floor(row.quantity)));
      setItemDialogOpen(true);
    },
    [projects]
  );

  const saveItemDialog = useCallback(() => {
    const label = draftLabel.trim();
    if (!label || !itemDialogProjectId) return;

    const unitRaw = draftUnitCost === "" ? 0 : Number(draftUnitCost);
    const unit = Number.isFinite(unitRaw) ? unitRaw : 0;
    const qty = Math.max(1, Math.floor(draftQuantity));
    const pid = itemDialogProjectId;

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        if (dialogMode === "edit" && editingId) {
          return {
            ...p,
            items: p.items.map((row) =>
              row.id === editingId
                ? { ...row, label, unitCost: unit, quantity: qty }
                : row
            ),
          };
        }
        const newItem: CostLineItem = {
          id: newId(),
          label,
          unitCost: unit,
          quantity: qty,
        };
        return { ...p, items: [...p.items, newItem] };
      })
    );
    if (isServerProjectId(pid)) schedulePersist(pid);
    closeItemDialog();
  }, [
    closeItemDialog,
    dialogMode,
    draftLabel,
    draftQuantity,
    draftUnitCost,
    editingId,
    itemDialogProjectId,
    schedulePersist,
  ]);

  const bumpDraftQuantity = useCallback((delta: number) => {
    setDraftQuantity((q) => Math.max(1, Math.floor(q) + delta));
  }, []);

  const updateItemQuantity = useCallback(
    (projectId: string, itemId: string, quantity: number) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            items: p.items.map((row) =>
              row.id === itemId ? { ...row, quantity } : row
            ),
          };
        })
      );
      if (isServerProjectId(projectId)) schedulePersist(projectId);
    },
    [schedulePersist]
  );

  const bumpQuantity = useCallback(
    (projectId: string, itemId: string, delta: number) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            items: p.items.map((row) => {
              if (row.id !== itemId) return row;
              const next = Math.max(1, Math.floor(row.quantity) + delta);
              return { ...row, quantity: next };
            }),
          };
        })
      );
      if (isServerProjectId(projectId)) schedulePersist(projectId);
    },
    [schedulePersist]
  );

  const removeRow = useCallback(
    (projectId: string, itemId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, items: p.items.filter((row) => row.id !== itemId) }
            : p
        )
      );
      if (isServerProjectId(projectId)) schedulePersist(projectId);
    },
    [schedulePersist]
  );

  const resetWorksheet = useCallback(
    (projectId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, items: [] } : p
        )
      );
      if (itemDialogProjectId === projectId) closeItemDialog();
      if (itemsListProjectId === projectId) closeItemsListDialog();
      if (isServerProjectId(projectId)) schedulePersist(projectId);
    },
    [
      closeItemDialog,
      closeItemsListDialog,
      itemDialogProjectId,
      itemsListProjectId,
      schedulePersist,
    ]
  );

  const closeDestructiveConfirm = useCallback(() => {
    setDestructiveConfirmOpen(false);
    setDestructiveConfirmKind(null);
    setDestructiveConfirmProjectId(null);
  }, []);

  const openDeleteProjectConfirm = useCallback((projectId: string) => {
    setDestructiveConfirmProjectId(projectId);
    setDestructiveConfirmKind("delete-project");
    setDestructiveConfirmOpen(true);
  }, []);

  const openResetWorksheetConfirm = useCallback((projectId: string) => {
    setDestructiveConfirmProjectId(projectId);
    setDestructiveConfirmKind("reset-worksheet");
    setDestructiveConfirmOpen(true);
  }, []);

  const confirmDestructiveAction = useCallback(() => {
    if (!destructiveConfirmProjectId || !destructiveConfirmKind) return;
    const id = destructiveConfirmProjectId;
    const kind = destructiveConfirmKind;
    closeDestructiveConfirm();
    if (kind === "delete-project") {
      void deleteProjectById(id);
    } else {
      resetWorksheet(id);
    }
  }, [
    closeDestructiveConfirm,
    deleteProjectById,
    destructiveConfirmKind,
    destructiveConfirmProjectId,
    resetWorksheet,
  ]);

  const destructiveConfirmProject =
    destructiveConfirmProjectId != null
      ? projects.find((p) => p.id === destructiveConfirmProjectId)
      : undefined;
  const destructiveConfirmProjectLabel =
    destructiveConfirmProject?.name.trim() || "-";

  const itemDialogTitle =
    dialogMode === "edit" ? "Edit line item" : "Add line item";

  const projectDialogTitle =
    projectDialogMode === "create" ? "Create project" : "Edit project name";

  return (
    <div className="container mx-auto px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Feasibility analysis
          </h2>
            <button
              type="button"
              onClick={openCreateProject}
              disabled={!token}
              title={!token ? "Sign in to add projects" : undefined}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Add project
            </button>
          </div>
          {syncError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {syncError}
            </p>
          ) : null}
          {projectsLoading ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Loading projects…
            </p>
          ) : null}
        </div>

        {!projectsLoading && token && projects.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            No projects yet. Add one to start a feasibility worksheet.
          </p>
        ) : null}

        {projects.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {projects.map((project) => {
              const displayName = project.name.trim() || "-";
              const n = project.items.length;
              const cardTotal = project.items.reduce(
                (sum, item) => sum + lineTotal(item),
                0
              );
              return (
                <div
                  key={project.id}
                  className="flex w-52 shrink-0 flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:w-60"
                >
                  <div className="flex items-start justify-between gap-1">
                    <h3
                      className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100"
                      title={displayName}
                    >
                      {displayName}
                    </h3>
                    <DropdownMenu
                      overlayOnBody
                      menuButtonAriaLabel={`Actions for ${displayName}`}
                      items={[
                        {
                          label: "View items",
                          onClick: () => openViewItems(project.id),
                        },
                        {
                          label: "Add item",
                          onClick: () => openAddAppend(project.id),
                        },
                        {
                          label: "Edit project name",
                          onClick: () => openEditProject(project.id),
                        },
                        {
                          label: "Reset worksheet",
                          onClick: () => openResetWorksheetConfirm(project.id),
                          danger: true,
                        },
                        {
                          label: "Delete project",
                          onClick: () => openDeleteProjectConfirm(project.id),
                          danger: true,
                        },
                      ]}
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {n === 0 ? "No items" : `${n} item${n === 1 ? "" : "s"}`}
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Total
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatMoney(cardTotal)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
        </div>

      <Dialog
        isOpen={projectDialogOpen}
        onClose={closeProjectDialog}
        title={projectDialogTitle}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Investment / project name
          </label>
          <input
            type="text"
              value={draftProjectName}
              onChange={(e) => setDraftProjectName(e.target.value)}
              placeholder="e.g. Residential house, Phase 1"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
          />
        </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={closeProjectDialog}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
              <button
                type="button"
              onClick={saveProjectDialog}
              disabled={
                (projectDialogMode === "create" && !draftProjectName.trim()) ||
                (projectDialogMode === "create" && !token)
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {projectDialogMode === "create" ? "Create" : "Save"}
              </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(itemsListOpen && itemsListProject)}
        onClose={closeItemsListDialog}
        title="Line items"
        size="lg"
      >
        {itemsListProject ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
                {itemsListProject.name.trim() || "-"}
              </p>
              <button
                type="button"
                onClick={() => openAddAppend(itemsListProject.id)}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Add item
              </button>
            </div>
            {itemsListProject.items.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No items yet. Add one with the button above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div className="hidden min-w-[520px] gap-2 border-b border-zinc-200 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,0.95fr)_minmax(0,0.65fr)_auto] md:items-center md:gap-2">
            <span>Item</span>
            <span>Unit cost</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Line</span>
            <span className="w-10" aria-hidden />
          </div>
                <ul className="mt-2 space-y-3">
                  {itemsListProject.items.map((item) => {
              const total = lineTotal(item);
                    const displayLabel =
                      item.label.trim() || "Untitled item";
                    const pid = itemsListProject.id;
              return (
                <li
                  key={item.id}
                        className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 md:border-0 md:p-0 md:pb-2 md:not-last:border-b md:dark:not-last:border-zinc-800"
                      >
                        <div className="grid grid-cols-1 gap-3 md:min-w-[520px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,0.95fr)_minmax(0,0.65fr)_auto] md:items-center md:gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 md:hidden">
                              Item
                            </span>
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {displayLabel}
                            </p>
                    </div>
                    <div>
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 md:hidden">
                        Unit cost
                            </span>
                            <p className="font-mono text-sm tabular-nums text-zinc-800 dark:text-zinc-200">
                              {formatMoney(item.unitCost)}
                            </p>
                    </div>
                    <div>
                            <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400 md:sr-only">
                        Quantity
                            </span>
                            <div className="flex items-center justify-center gap-1 md:justify-center">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                                onClick={() =>
                                  bumpQuantity(pid, item.id, -1)
                                }
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                          disabled={item.quantity <= 1}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                                  updateItemQuantity(
                                    pid,
                                    item.id,
                                    Number.isFinite(v) && v >= 1 ? v : 1
                                  );
                                }}
                                className="w-12 rounded-lg border border-zinc-300 bg-white py-1.5 text-center text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <button
                          type="button"
                          aria-label="Increase quantity"
                                onClick={() => bumpQuantity(pid, item.id, 1)}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                          <div className="flex items-center justify-between md:justify-end">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 md:hidden">
                        Line total
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatMoney(total)}
                      </span>
                    </div>
                    <div className="flex justify-end md:justify-center">
                            <DropdownMenu
                              overlayOnBody
                              menuButtonAriaLabel="Line item actions"
                              items={[
                                {
                                  label: "Edit item",
                                  onClick: () =>
                                    openEditLine(pid, item.id),
                                },
                                {
                                  label: "Remove item",
                                  onClick: () =>
                                    removeRow(pid, item.id),
                                  danger: true,
                                },
                              ]}
                            />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
              </div>
            )}
            <div className="flex flex-col items-stretch gap-1 border-t border-zinc-200 pt-4 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Total
            </span>
              <span className="font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100 sm:min-w-40 sm:text-right">
                {formatMoney(
                  itemsListProject.items.reduce(
                    (sum, item) => sum + lineTotal(item),
                    0
                  )
                )}
            </span>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={itemDialogOpen}
        onClose={closeItemDialog}
        title={itemDialogTitle}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Item name *
            </label>
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. Plot, Lorry of stones, Labour week"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Unit cost
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={draftUnitCost === "" ? "" : draftUnitCost}
              onChange={(e) => {
                const v = e.target.value;
                setDraftUnitCost(v === "" ? "" : Number(v));
              }}
              placeholder="0"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => bumpDraftQuantity(-1)}
                disabled={draftQuantity <= 1}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={draftQuantity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setDraftQuantity(Number.isFinite(v) && v >= 1 ? v : 1);
                }}
                className="w-20 rounded-lg border border-zinc-300 bg-white py-2 text-center text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => bumpDraftQuantity(1)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={closeItemDialog}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveItemDialog}
              disabled={!draftLabel.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {dialogMode === "edit" ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={
          destructiveConfirmOpen &&
          Boolean(destructiveConfirmKind && destructiveConfirmProjectId)
        }
        onClose={closeDestructiveConfirm}
        title={
          destructiveConfirmKind === "delete-project"
            ? "Delete project?"
            : "Reset worksheet?"
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {destructiveConfirmKind === "delete-project" ? (
              <>
                Remove{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {destructiveConfirmProjectLabel}
                </span>{" "}
                and all of its line items? This cannot be undone.
              </>
            ) : (
              <>
                Clear all line items for{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {destructiveConfirmProjectLabel}
                </span>
                ? The project name will stay.
              </>
            )}
          </p>
          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={closeDestructiveConfirm}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDestructiveAction}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {destructiveConfirmKind === "delete-project"
                ? "Delete project"
                : "Reset worksheet"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
