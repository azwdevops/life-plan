"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import {
  deleteDisciplineTrack,
  fetchDisciplineStore,
  patchDisciplineTrack,
  postDisciplineTrack,
} from "@/lib/api/discipline";
import {
  addDisciplineCategory,
  adjustDisciplineCount,
  createEmptyDisciplineStore,
  isDisciplineLabelTaken,
  loadDisciplineStore,
  removeDisciplineCategory,
  renameDisciplineCategory,
  saveDisciplineStore,
  sortDisciplineCategoriesByLabel,
  type DisciplineStore,
} from "@/lib/discipline-storage";
import { useAuth } from "@/lib/hooks/use-auth";

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

export function DisciplinePanel() {
  const { token } = useAuth();
  const [store, setStore] = useState<DisciplineStore>(() =>
    token ? createEmptyDisciplineStore() : loadDisciplineStore()
  );
  const [remoteInit, setRemoteInit] = useState<"loading" | "ready" | "error">(() =>
    token ? "loading" : "ready"
  );
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; label: string } | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelDraft, setEditingLabelDraft] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);

  const sortedCategories = useMemo(
    () => sortDisciplineCategoriesByLabel(store.categories),
    [store.categories]
  );

  const totalCount = useMemo(
    () => store.categories.reduce((sum, c) => sum + c.count, 0),
    [store.categories]
  );

  useEffect(() => {
    if (!token) {
      setStore(loadDisciplineStore());
      setRemoteInit("ready");
      return;
    }
    let cancelled = false;
    setRemoteInit("loading");
    fetchDisciplineStore(token)
      .then((s) => {
        if (!cancelled) {
          setStore(s);
          setRemoteInit("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setRemoteInit("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useLayoutEffect(() => {
    if (!editingLabelId || !labelInputRef.current) return;
    labelInputRef.current.focus();
    labelInputRef.current.select();
  }, [editingLabelId]);

  const updateStoreLocal = useCallback((fn: (s: DisciplineStore) => DisciplineStore) => {
    setStore((prev) => {
      const next = fn(prev);
      saveDisciplineStore(next);
      return next;
    });
  }, []);

  const applyCountDelta = useCallback(
    (id: string, delta: number) => {
      if (!token) {
        updateStoreLocal((s) => adjustDisciplineCount(s, id, delta));
        return;
      }
      setStore((prev) => {
        const next = adjustDisciplineCount(prev, id, delta);
        const row = next.categories.find((c) => c.id === id);
        if (row) {
          void patchDisciplineTrack(token, id, { count: row.count })
            .then(() => setMutationError(null))
            .catch(async () => {
              setMutationError("Could not save count.");
              try {
                const fresh = await fetchDisciplineStore(token);
                setStore(fresh);
              } catch {
                // keep optimistic state if refetch fails
              }
            });
        }
        return next;
      });
    },
    [token, updateStoreLocal]
  );

  const commitLabelRename = (categoryId: string) => {
    const t = editingLabelDraft.trim();
    if (!t) {
      setEditingLabelId(null);
      setEditingLabelDraft("");
      return;
    }
    if (!token) {
      if (isDisciplineLabelTaken(store, t, categoryId)) {
        setMutationError("A track with this label already exists.");
        return;
      }
      setEditingLabelId(null);
      setEditingLabelDraft("");
      updateStoreLocal((s) => renameDisciplineCategory(s, categoryId, t));
      setMutationError(null);
      return;
    }
    void (async () => {
      try {
        const row = await patchDisciplineTrack(token, categoryId, { label: t });
        setEditingLabelId(null);
        setEditingLabelDraft("");
        setStore((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => (c.id === row.id ? { ...c, label: row.label } : c)),
        }));
        setMutationError(null);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not save the label.");
      }
    })();
  };

  const cancelLabelRename = () => {
    setEditingLabelId(null);
    setEditingLabelDraft("");
  };

  const submitAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (!token) {
      if (isDisciplineLabelTaken(store, label)) {
        setMutationError("A track with this label already exists.");
        return;
      }
      updateStoreLocal((s) => addDisciplineCategory(s, label));
      setNewLabel("");
      setAddOpen(false);
      setMutationError(null);
      return;
    }
    void (async () => {
      try {
        const row = await postDisciplineTrack(token, label);
        setStore((prev) => ({
          ...prev,
          categories: [...prev.categories, { id: row.id, label: row.label, count: row.count }],
        }));
        setNewLabel("");
        setAddOpen(false);
        setMutationError(null);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not create the track.");
      }
    })();
  };

  const retryLoadRemote = () => {
    if (!token) return;
    setRemoteInit("loading");
    void fetchDisciplineStore(token)
      .then((s) => {
        setStore(s);
        setRemoteInit("ready");
        setMutationError(null);
      })
      .catch(() => setRemoteInit("error"));
  };

  if (token && remoteInit === "loading") {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading discipline…
      </div>
    );
  }

  if (token && remoteInit === "error") {
    return (
      <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-6 text-center dark:border-red-900/60 dark:bg-red-950/40">
        <p className="text-sm text-red-800 dark:text-red-200">Could not load discipline data from the server.</p>
        <button
          type="button"
          onClick={retryLoadRemote}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {mutationError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          {mutationError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Discipline</h2>
        <button
          type="button"
          onClick={() => {
            setNewLabel("");
            setAddOpen(true);
          }}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Add track
        </button>
      </div>

      {store.categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          No tracks yet. Use <span className="font-medium text-zinc-800 dark:text-zinc-200">Add track</span> to
          create your first category, then tap + or − to log each time.
          {token ? (
            <span className="mt-2 block text-zinc-500 dark:text-zinc-500">
              Tracks are saved to your account.
            </span>
          ) : null}
        </p>
      ) : (
        <>
          <ul className="grid min-w-0 gap-2 grid-cols-[repeat(auto-fill,minmax(9.25rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]">
            {sortedCategories.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-600 dark:bg-zinc-800/80"
              >
                <div className="flex gap-1">
                  <div className="min-w-0 flex-1">
                    {editingLabelId === c.id ? (
                      <input
                        ref={labelInputRef}
                        value={editingLabelDraft}
                        onChange={(e) => setEditingLabelDraft(e.target.value)}
                        onBlur={() => commitLabelRename(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitLabelRename(c.id);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelLabelRename();
                          }
                        }}
                        className="w-full rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs font-medium text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                        aria-label="Track label"
                      />
                    ) : (
                      <div className="flex min-h-8 items-start justify-between gap-0.5">
                        <p className="line-clamp-2 flex-1 text-xs font-medium leading-tight text-zinc-900 dark:text-zinc-100">
                          {c.label}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLabelId(c.id);
                            setEditingLabelDraft(c.label);
                          }}
                          className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                          aria-label={`Edit label: ${c.label}`}
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoveConfirm({ id: c.id, label: c.label })}
                    className="shrink-0 self-start rounded-md p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={`Remove track: ${c.label}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => applyCountDelta(c.id, -1)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    aria-label={`Decrease count for ${c.label} (failure or setback)`}
                  >
                    −
                  </button>
                  <span
                    className="min-w-8 text-center text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
                    aria-live="polite"
                  >
                    {c.count}
                  </span>
                  <button
                    type="button"
                    onClick={() => applyCountDelta(c.id, 1)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    aria-label={`Increase count for ${c.label} (success)`}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <section
            className="w-full max-w-[16rem] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm sm:max-w-[18rem] dark:border-zinc-600 dark:bg-zinc-800/80"
            aria-labelledby="discipline-summary-heading"
          >
            <h3
              id="discipline-summary-heading"
              className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-600 dark:text-zinc-100"
            >
              Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                    <th className="w-[70%] px-3 py-1.5 font-medium">Track</th>
                    <th className="px-3 py-1.5 text-right font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCategories.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-700/80"
                    >
                      <td className="truncate px-3 py-1.5 text-zinc-800 dark:text-zinc-200" title={c.label}>
                        {c.label}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {c.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 bg-zinc-50/90 font-semibold dark:border-zinc-600 dark:bg-zinc-900/60">
                    <td className="truncate px-3 py-2 text-zinc-900 dark:text-zinc-100">Total (net)</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                      {totalCount}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}

      <Dialog isOpen={addOpen} onClose={() => setAddOpen(false)} title="New track" size="sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="discipline-track-label" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Label
            </label>
            <input
              id="discipline-track-label"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Resisted temptation"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAdd();
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAdd}
              disabled={!newLabel.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500"
            >
              Add
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={removeConfirm !== null}
        onClose={() => setRemoveConfirm(null)}
        title="Remove track"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Remove{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {removeConfirm?.label ?? ""}
            </span>
            ? The count will be lost. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoveConfirm(null)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!removeConfirm) return;
                const id = removeConfirm.id;
                setRemoveConfirm(null);
                if (editingLabelId === id) cancelLabelRename();
                if (!token) {
                  updateStoreLocal((s) => removeDisciplineCategory(s, id));
                  return;
                }
                void (async () => {
                  try {
                    await deleteDisciplineTrack(token, id);
                    setStore((prev) => ({
                      ...prev,
                      categories: prev.categories.filter((c) => c.id !== id),
                    }));
                    setMutationError(null);
                  } catch (err) {
                    setMutationError(err instanceof Error ? err.message : "Could not remove the track.");
                  }
                })();
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
            >
              Remove
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
