"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/Dialog";
import {
  addPendingCategory,
  addPendingItem,
  createEmptyPendingWorkStore,
  isPendingCategoryNameTaken,
  isPendingItemTitleTakenInCategory,
  loadPendingWorkStore,
  removePendingCategory,
  removePendingItem,
  renamePendingCategory,
  renamePendingItem,
  savePendingWorkStore,
  savePendingWorkVisibility,
  setAllCategoriesVisible,
  toggleVisibleCategory,
  type PendingWorkStore,
} from "@/lib/pending-work-storage";
import {
  deletePendingCategory,
  deletePendingItem,
  fetchPendingWorkStore,
  patchPendingCategory,
  patchPendingItem,
  postPendingCategory,
  postPendingItem,
} from "@/lib/api/pending-work";
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

export const PendingWorkPanel = memo(function PendingWorkPanel() {
  const { token } = useAuth();
  const [store, setStore] = useState<PendingWorkStore>(() =>
    token ? createEmptyPendingWorkStore() : loadPendingWorkStore()
  );
  /** loading | error only used when syncing from API (authenticated). */
  const [remoteInit, setRemoteInit] = useState<"loading" | "ready" | "error">(() =>
    token ? "loading" : "ready"
  );
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [removeItemConfirm, setRemoveItemConfirm] = useState<{ id: string; title: string } | null>(null);
  const [removeCategoryConfirm, setRemoveCategoryConfirm] = useState<{
    id: string;
    name: string;
    itemCount: number;
  } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemCategorySearch, setItemCategorySearch] = useState("");
  const [itemCategoryComboOpen, setItemCategoryComboOpen] = useState(false);
  const itemCategoryComboRef = useRef<HTMLDivElement>(null);
  const itemCategoryListPortalRef = useRef<HTMLDivElement>(null);
  const itemComboInputRef = useRef<HTMLInputElement>(null);
  const [itemComboListLayout, setItemComboListLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const [categoryMenuLayout, setCategoryMenuLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const updateCategoryMenuLayout = useCallback(() => {
    const btn = categoryTriggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 6;
    const edge = 8;
    const width = Math.min(r.width, window.innerWidth - edge * 2);
    const left = Math.min(Math.max(edge, r.left), window.innerWidth - width - edge);
    const top = r.bottom + gap;
    const maxHeight = Math.max(200, window.innerHeight - top - edge);
    setCategoryMenuLayout({ top, left, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!categoryDropdownOpen) {
      setCategoryMenuLayout(null);
      return;
    }
    updateCategoryMenuLayout();
    const onReposition = () => updateCategoryMenuLayout();
    window.addEventListener("resize", onReposition);
    document.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("scroll", onReposition, true);
    };
  }, [categoryDropdownOpen, updateCategoryMenuLayout]);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = categoryPickerRef.current;
      if (el && !el.contains(e.target as Node)) setCategoryDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCategoryDropdownOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [categoryDropdownOpen]);

  useEffect(() => {
    if (!categoryDropdownOpen) setCategorySearch("");
  }, [categoryDropdownOpen]);

  useEffect(() => {
    if (!token) {
      setStore(loadPendingWorkStore());
      setRemoteInit("ready");
      return;
    }
    let cancelled = false;
    setRemoteInit("loading");
    fetchPendingWorkStore(token)
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

  const updateStoreLocal = useCallback((fn: (s: PendingWorkStore) => PendingWorkStore) => {
    setStore((prev) => {
      const next = fn(prev);
      savePendingWorkStore(next);
      return next;
    });
  }, []);

  const toggleCategoryVisible = useCallback(
    (categoryId: string) => {
      if (!token) {
        updateStoreLocal((s) => toggleVisibleCategory(s, categoryId));
        return;
      }
      setStore((prev) => {
        const next = toggleVisibleCategory(prev, categoryId);
        savePendingWorkVisibility(next.visibleCategoryIds);
        return next;
      });
      setMutationError(null);
    },
    [token, updateStoreLocal]
  );

  const setAllBoardsVisible = useCallback(
    (visible: boolean) => {
      if (!token) {
        updateStoreLocal((s) => setAllCategoriesVisible(s, visible));
        return;
      }
      setStore((prev) => {
        const next = setAllCategoriesVisible(prev, visible);
        savePendingWorkVisibility(next.visibleCategoryIds);
        return next;
      });
      setMutationError(null);
    },
    [token, updateStoreLocal]
  );

  const visibleCategories = useMemo(() => {
    const vis = new Set(store.visibleCategoryIds);
    return store.categories.filter((c) => vis.has(c.id));
  }, [store.categories, store.visibleCategoryIds]);

  const itemsByCategory = useMemo(() => {
    const m = new Map<string, typeof store.items>();
    for (const c of store.categories) {
      m.set(c.id, []);
    }
    for (const it of store.items) {
      const list = m.get(it.categoryId);
      if (list) list.push(it);
    }
    return m;
  }, [store.categories, store.items]);

  const filteredCategoriesForPicker = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return store.categories;
    return store.categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [store.categories, categorySearch]);

  const filteredCategoriesForItemDialog = useMemo(() => {
    const q = itemCategorySearch.trim().toLowerCase();
    if (!q) return store.categories;
    return store.categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [store.categories, itemCategorySearch]);

  useEffect(() => {
    if (!itemDialogOpen) {
      setItemCategorySearch("");
      setItemCategoryComboOpen(false);
      setItemComboListLayout(null);
    }
  }, [itemDialogOpen]);

  useLayoutEffect(() => {
    if (!itemCategoryComboOpen) {
      setItemComboListLayout(null);
      return;
    }
    const measure = () => {
      const el = itemComboInputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setItemComboListLayout({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(120, window.innerHeight - r.bottom - 12),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, true);
    };
  }, [itemCategoryComboOpen]);

  useEffect(() => {
    if (!itemCategoryComboOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (itemCategoryComboRef.current?.contains(t)) return;
      if (itemCategoryListPortalRef.current?.contains(t)) return;
      setItemCategoryComboOpen(false);
      setItemCategorySearch("");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [itemCategoryComboOpen]);

  const openAddItem = () => {
    setItemCategoryId(store.categories[0]?.id ?? "");
    setItemTitle("");
    setItemCategoryComboOpen(false);
    setItemCategorySearch("");
    setItemDialogOpen(true);
  };

  const openAddItemForBoard = (categoryId: string) => {
    setItemCategoryId(categoryId);
    setItemTitle("");
    setItemCategoryComboOpen(false);
    setItemCategorySearch("");
    setItemDialogOpen(true);
  };

  const selectedItemCategoryName = useMemo(
    () => store.categories.find((c) => c.id === itemCategoryId)?.name ?? "",
    [store.categories, itemCategoryId]
  );

  const [editingBoardCategoryId, setEditingBoardCategoryId] = useState<string | null>(null);
  const [editingBoardNameDraft, setEditingBoardNameDraft] = useState("");
  const boardTitleInputRef = useRef<HTMLInputElement>(null);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitleDraft, setEditingItemTitleDraft] = useState("");
  const itemTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingBoardCategoryId || !boardTitleInputRef.current) return;
    boardTitleInputRef.current.focus();
    boardTitleInputRef.current.select();
  }, [editingBoardCategoryId]);

  useEffect(() => {
    if (!editingItemId || !itemTitleInputRef.current) return;
    itemTitleInputRef.current.focus();
    itemTitleInputRef.current.select();
  }, [editingItemId]);

  const commitBoardRename = (categoryId: string) => {
    const t = editingBoardNameDraft.trim();
    setEditingBoardCategoryId(null);
    if (!t) return;
    if (!token) {
      updateStoreLocal((s) => renamePendingCategory(s, categoryId, t));
      return;
    }
    void (async () => {
      try {
        const row = await patchPendingCategory(token, categoryId, t);
        setStore((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => (c.id === row.id ? { ...c, name: row.name } : c)),
        }));
        setMutationError(null);
      } catch {
        setMutationError("Could not save the board name.");
      }
    })();
  };

  const cancelBoardRename = () => {
    setEditingBoardCategoryId(null);
    setEditingBoardNameDraft("");
  };

  const commitItemRename = (itemId: string) => {
    const t = editingItemTitleDraft.trim();
    if (!t) {
      setEditingItemId(null);
      return;
    }
    const itemRow = store.items.find((i) => i.id === itemId);
    const itemCategoryId = itemRow?.categoryId ?? "";
    if (!token) {
      if (isPendingItemTitleTakenInCategory(store, itemCategoryId, t, itemId)) {
        setMutationError("An item with this title already exists in this category.");
        return;
      }
      setEditingItemId(null);
      updateStoreLocal((s) => renamePendingItem(s, itemId, t));
      setMutationError(null);
      return;
    }
    void (async () => {
      try {
        const row = await patchPendingItem(token, itemId, t);
        setEditingItemId(null);
        setStore((prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.id === row.id ? { ...i, title: row.title, categoryId: row.category_id } : i
          ),
        }));
        setMutationError(null);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not save the item title.");
      }
    })();
  };

  const cancelItemRename = () => {
    setEditingItemId(null);
    setEditingItemTitleDraft("");
  };

  const submitCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (!token) {
      if (isPendingCategoryNameTaken(store, name)) {
        setMutationError("A category with this name already exists.");
        return;
      }
      updateStoreLocal((s) => addPendingCategory(s, name));
      setNewCategoryName("");
      setCategoryDialogOpen(false);
      setMutationError(null);
      return;
    }
    void (async () => {
      try {
        const res = await postPendingCategory(token, name);
        setStore((prev) => {
          const nextVisible = prev.visibleCategoryIds.includes(res.category.id)
            ? prev.visibleCategoryIds
            : [...prev.visibleCategoryIds, res.category.id];
          savePendingWorkVisibility(nextVisible);
          return {
            ...prev,
            categories: [...prev.categories, { id: res.category.id, name: res.category.name }],
            visibleCategoryIds: nextVisible,
          };
        });
        setNewCategoryName("");
        setCategoryDialogOpen(false);
        setMutationError(null);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not create the category.");
      }
    })();
  };

  const submitItem = () => {
    if (!itemCategoryId) return;
    const title = itemTitle.trim();
    if (!title) return;
    if (!token) {
      if (isPendingItemTitleTakenInCategory(store, itemCategoryId, title)) {
        setMutationError("An item with this title already exists in this category.");
        return;
      }
      updateStoreLocal((s) => addPendingItem(s, itemCategoryId, title));
      setItemTitle("");
      setItemDialogOpen(false);
      setMutationError(null);
      return;
    }
    void (async () => {
      try {
        const row = await postPendingItem(token, itemCategoryId, title);
        setStore((prev) => ({
          ...prev,
          items: [
            ...prev.items,
            {
              id: row.id,
              categoryId: row.category_id,
              title: row.title,
              note: "",
            },
          ],
        }));
        setItemTitle("");
        setItemDialogOpen(false);
        setMutationError(null);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not create the item.");
      }
    })();
  };

  const retryLoadRemote = () => {
    if (!token) return;
    setRemoteInit("loading");
    void fetchPendingWorkStore(token)
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
        Loading pending work…
      </div>
    );
  }

  if (token && remoteInit === "error") {
    return (
      <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-6 text-center dark:border-red-900/60 dark:bg-red-950/40">
        <p className="text-sm text-red-800 dark:text-red-200">Could not load pending work from the server.</p>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
        <h2 className="shrink-0 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Pending work</h2>
        {store.categories.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 border-zinc-200 sm:border-l sm:pl-4 dark:border-zinc-700">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAllBoardsVisible(true)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Show all
              </button>
              <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={() => setAllBoardsVisible(false)}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Hide all
              </button>
            </div>
            {visibleCategories.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-zinc-200 sm:border-l sm:pl-4 dark:border-zinc-700">
                {visibleCategories.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex max-w-full items-center gap-0.5 rounded-md bg-zinc-100 py-0.5 pl-2 pr-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <span className="max-w-56 truncate">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCategoryVisible(c.id)}
                      className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                      aria-label={`Hide board: ${c.name}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => {
              setNewCategoryName("");
              setCategoryDialogOpen(true);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Add category
          </button>
          <button
            type="button"
            onClick={openAddItem}
            disabled={store.categories.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Add item
          </button>
        </div>
      </div>

      {store.categories.length > 0 ? (
        <div className="max-w-md space-y-1.5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Search, then click a category to show its column; click again to hide. Use the × on a row to
            remove that category (and its items).
          </p>
          <div ref={categoryPickerRef} className="relative w-full">
          <button
            ref={categoryTriggerRef}
            type="button"
            aria-expanded={categoryDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => {
              setCategoryDropdownOpen((o) => !o);
            }}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <span>Categories</span>
            <svg
              className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${categoryDropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {categoryDropdownOpen && categoryMenuLayout ? (
            <div
              className="fixed z-80 flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white py-2 shadow-xl ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10"
              style={{
                top: categoryMenuLayout.top,
                left: categoryMenuLayout.left,
                width: categoryMenuLayout.width,
                maxHeight: categoryMenuLayout.maxHeight,
              }}
            >
              <div className="shrink-0 px-2 pb-2">
                <label htmlFor="pending-category-search" className="sr-only">
                  Filter categories
                </label>
                <input
                  id="pending-category-search"
                  type="search"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Type to filter…"
                  autoComplete="off"
                  autoFocus
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-zinc-100 dark:border-zinc-700"
                role="listbox"
                aria-label="Categories — click to toggle board visibility"
                aria-multiselectable="true"
              >
                {filteredCategoriesForPicker.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No categories match.
                  </p>
                ) : (
                  filteredCategoriesForPicker.map((c) => {
                    const active = store.visibleCategoryIds.includes(c.id);
                    const itemCount = store.items.filter((it) => it.categoryId === c.id).length;
                    return (
                      <div
                        key={c.id}
                        className={[
                          "flex w-full items-stretch border-b border-zinc-100 last:border-b-0 dark:border-zinc-700",
                          active ? "bg-blue-100 dark:bg-blue-950/50" : "",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => toggleCategoryVisible(c.id)}
                          className={[
                            "min-w-0 flex-1 px-3 py-2.5 text-left text-sm transition-colors",
                            active
                              ? "font-medium text-blue-950 ring-2 ring-inset ring-blue-500/40 dark:text-blue-100 dark:ring-blue-400/50"
                              : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80",
                          ].join(" ")}
                        >
                          <span className="block truncate">{c.name}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryDropdownOpen(false);
                            setRemoveCategoryConfirm({
                              id: c.id,
                              name: c.name,
                              itemCount,
                            });
                          }}
                          className="shrink-0 border-l border-zinc-200/80 px-2.5 py-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:border-zinc-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          aria-label={`Remove category ${c.name}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          {token
            ? "Add a category first, then add items. Your boards are saved to your account."
            : "Add a category first, then add items. Everything is saved in your browser."}
        </p>
      )}

      {store.categories.length > 0 && visibleCategories.length === 0 ? (
        <p className="text-sm text-amber-800 dark:text-amber-200/90">
          No columns selected. Open Categories and activate at least one to see boards.
        </p>
      ) : null}

      {visibleCategories.length > 0 ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-h-[min(70vh,520px)] gap-4" style={{ width: "max-content" }}>
            {visibleCategories.map((cat) => {
              const columnItems = itemsByCategory.get(cat.id) ?? [];
              return (
                <div
                  key={cat.id}
                  className="flex w-[min(100vw-2rem,300px)] shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-900/50"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
                    <div className="min-w-0 flex-1">
                      {editingBoardCategoryId === cat.id ? (
                        <input
                          ref={boardTitleInputRef}
                          value={editingBoardNameDraft}
                          onChange={(e) => setEditingBoardNameDraft(e.target.value)}
                          onBlur={() => commitBoardRename(cat.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitBoardRename(cat.id);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelBoardRename();
                            }
                          }}
                          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                          aria-label="Board name"
                        />
                      ) : (
                        <div className="flex min-w-0 items-center gap-0.5">
                          <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {cat.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemId(null);
                              setEditingBoardCategoryId(cat.id);
                              setEditingBoardNameDraft(cat.name);
                            }}
                            className="shrink-0 rounded p-1 text-zinc-400 transition hover:bg-zinc-200/90 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            aria-label={`Edit board name: ${cat.name}`}
                          >
                            <IconPencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRemoveCategoryConfirm({
                                id: cat.id,
                                name: cat.name,
                                itemCount: columnItems.length,
                              });
                            }}
                            className="shrink-0 rounded p-1 text-zinc-400 transition hover:bg-zinc-200/90 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                            aria-label={`Remove board: ${cat.name}`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {columnItems.length} {columnItems.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddItemForBoard(cat.id)}
                      className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-200/90 hover:text-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-blue-400"
                      aria-label={`Add item to ${cat.name}`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                    {columnItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-zinc-300/80 px-2 py-6 text-center text-xs text-zinc-500 dark:border-zinc-600 dark:text-zinc-500">
                        No items yet
                      </p>
                    ) : (
                      columnItems.map((it) => (
                        <div
                          key={it.id}
                          className="group relative rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-800"
                        >
                          {editingItemId !== it.id ? (
                            <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBoardCategoryId(null);
                                  setEditingItemId(it.id);
                                  setEditingItemTitleDraft(it.title);
                                }}
                                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                                aria-label={`Edit ${it.title}`}
                              >
                                <IconPencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRemoveItemConfirm({ id: it.id, title: it.title })}
                                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                                aria-label={`Remove ${it.title}`}
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          ) : null}
                          {editingItemId === it.id ? (
                            <input
                              ref={itemTitleInputRef}
                              value={editingItemTitleDraft}
                              onChange={(e) => setEditingItemTitleDraft(e.target.value)}
                              onBlur={() => commitItemRename(it.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitItemRename(it.id);
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelItemRename();
                                }
                              }}
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                              aria-label="Item title"
                            />
                          ) : (
                            <p className="pr-16 text-sm font-medium text-zinc-900 dark:text-zinc-100">{it.title}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog
        isOpen={removeCategoryConfirm !== null}
        onClose={() => setRemoveCategoryConfirm(null)}
        title="Remove category"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {removeCategoryConfirm && removeCategoryConfirm.itemCount > 0 ? (
              <>
                Remove board{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {removeCategoryConfirm.name}
                </span>{" "}
                and {removeCategoryConfirm.itemCount}{" "}
                {removeCategoryConfirm.itemCount === 1 ? "item" : "items"}? This cannot be undone.
              </>
            ) : (
              <>
                Remove board{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {removeCategoryConfirm?.name ?? ""}
                </span>
                ? It has no items. This cannot be undone.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoveCategoryConfirm(null)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!removeCategoryConfirm) return;
                const catId = removeCategoryConfirm.id;
                setRemoveCategoryConfirm(null);
                setEditingBoardCategoryId((cur) => (cur === catId ? null : cur));
                setEditingItemId(null);
                setRemoveItemConfirm(null);
                if (!token) {
                  updateStoreLocal((s) => removePendingCategory(s, catId));
                  return;
                }
                void (async () => {
                  try {
                    await deletePendingCategory(token, catId);
                    setStore((prev) => {
                      const next = removePendingCategory(prev, catId);
                      savePendingWorkVisibility(next.visibleCategoryIds);
                      return next;
                    });
                    setMutationError(null);
                  } catch {
                    setMutationError("Could not remove the category.");
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

      <Dialog
        isOpen={removeItemConfirm !== null}
        onClose={() => setRemoveItemConfirm(null)}
        title="Remove item"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Remove{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {removeItemConfirm?.title ?? ""}
            </span>
            ? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoveItemConfirm(null)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!removeItemConfirm) return;
                const id = removeItemConfirm.id;
                setRemoveItemConfirm(null);
                if (!token) {
                  updateStoreLocal((s) => removePendingItem(s, id));
                  return;
                }
                void (async () => {
                  try {
                    await deletePendingItem(token, id);
                    setStore((prev) => ({
                      ...prev,
                      items: prev.items.filter((i) => i.id !== id),
                    }));
                    setMutationError(null);
                  } catch {
                    setMutationError("Could not remove the item.");
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

      <Dialog
        isOpen={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        title="New category"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="pending-cat-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name
            </label>
            <input
              id="pending-cat-name"
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Home repairs, Groceries"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCategory();
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCategoryDialogOpen(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCategory}
              disabled={!newCategoryName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={itemDialogOpen} onClose={() => setItemDialogOpen(false)} title="New item" size="sm">
        <div className="space-y-4">
          <div ref={itemCategoryComboRef}>
            <label htmlFor="pending-item-category-combo" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Category
            </label>
            <div className="relative mt-1">
              <input
                ref={itemComboInputRef}
                id="pending-item-category-combo"
                role="combobox"
                aria-expanded={itemCategoryComboOpen}
                aria-controls="pending-item-category-listbox"
                aria-autocomplete="list"
                type="text"
                autoComplete="off"
                readOnly={!itemCategoryComboOpen}
                value={itemCategoryComboOpen ? itemCategorySearch : selectedItemCategoryName}
                placeholder={itemCategoryComboOpen ? "Type to filter…" : "Select a category"}
                onChange={(e) => {
                  if (itemCategoryComboOpen) setItemCategorySearch(e.target.value);
                }}
                onClick={() => {
                  if (!itemCategoryComboOpen) {
                    setItemCategoryComboOpen(true);
                    setItemCategorySearch(selectedItemCategoryName);
                  }
                }}
                onFocus={() => {
                  if (!itemCategoryComboOpen) {
                    setItemCategoryComboOpen(true);
                    setItemCategorySearch(selectedItemCategoryName);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && itemCategoryComboOpen) {
                    e.stopPropagation();
                    setItemCategoryComboOpen(false);
                    setItemCategorySearch("");
                  }
                }}
                className={`w-full rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 ${itemCategoryComboOpen ? "cursor-text" : "cursor-pointer"}`}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={itemCategoryComboOpen ? "Close category list" : "Open category list"}
                className="absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                onClick={(e) => {
                  e.preventDefault();
                  if (itemCategoryComboOpen) {
                    setItemCategoryComboOpen(false);
                    setItemCategorySearch("");
                  } else {
                    setItemCategoryComboOpen(true);
                    setItemCategorySearch(selectedItemCategoryName);
                    itemComboInputRef.current?.focus();
                  }
                }}
              >
                <svg
                  className={`h-4 w-4 transition-transform ${itemCategoryComboOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {itemCategoryComboOpen &&
              itemComboListLayout &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={itemCategoryListPortalRef}
                  id="pending-item-category-listbox"
                  role="listbox"
                  aria-label="Choose category"
                  className="fixed z-300 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10"
                  style={{
                    top: itemComboListLayout.top,
                    left: itemComboListLayout.left,
                    width: itemComboListLayout.width,
                    maxHeight: itemComboListLayout.maxHeight,
                  }}
                >
                  {filteredCategoriesForItemDialog.length === 0 ? (
                    <p className="px-3 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400">No categories match.</p>
                  ) : (
                    filteredCategoriesForItemDialog.map((c) => {
                      const selected = itemCategoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setItemCategoryId(c.id);
                            setItemCategoryComboOpen(false);
                            setItemCategorySearch("");
                          }}
                          className={[
                            "flex w-full border-b border-zinc-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0 dark:border-zinc-700",
                            selected
                              ? "bg-blue-100 font-medium text-blue-950 dark:bg-blue-950/50 dark:text-blue-100"
                              : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80",
                          ].join(" ")}
                        >
                          {c.name}
                        </button>
                      );
                    })
                  )}
                </div>,
                document.body
              )}
          </div>
          <div>
            <label htmlFor="pending-item-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              What needs doing
            </label>
            <input
              id="pending-item-title"
              type="text"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder="e.g. Fix chair leg, Buy river stones"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setItemDialogOpen(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitItem}
              disabled={!itemTitle.trim() || !itemCategoryId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
});
