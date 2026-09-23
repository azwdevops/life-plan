"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { RightDrawer } from "@/components/RightDrawer";
import { Dialog } from "@/components/Dialog";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createDailyProductiveItem,
  deleteDailyProductiveItem,
  fetchDailyProductiveItems,
  getTodayIsoDate,
  isEditableIsoDate,
  patchDailyProductiveItem,
  reorderDailyProductiveItems,
  type DailyProductiveItemApi,
} from "@/lib/api/daily-productive-items";

function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function IconChecklist({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
      />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h5M20 20v-5h-5M4.5 9a7.5 7.5 0 0113-4.5L20 7M19.5 15a7.5 7.5 0 01-13 4.5L4 17"
      />
    </svg>
  );
}

function IconGrip({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m3 0-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7h14z"
      />
    </svg>
  );
}

export function HeaderDailyProductiveList() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<{ item: DailyProductiveItemApi; nextDone: boolean } | null>(
    null
  );
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<DailyProductiveItemApi | null>(null);
  const [editDraftText, setEditDraftText] = useState("");
  const [editDraftDate, setEditDraftDate] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DailyProductiveItemApi | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const dragIdRef = useRef<string | null>(null);

  const todayIso = getTodayIsoDate();

  const todayQuery = useQuery({
    queryKey: ["daily-productive-items", token, todayIso],
    queryFn: () => fetchDailyProductiveItems(token as string, todayIso),
    enabled: Boolean(token) && isAuthenticated,
    refetchInterval: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ["daily-productive-items", token, selectedDate],
    queryFn: () => fetchDailyProductiveItems(token as string, selectedDate),
    enabled: Boolean(token) && isAuthenticated && open,
  });

  useEffect(() => {
    if (open) setSelectedDate(getTodayIsoDate());
    setEditingItem(null);
    setDeleteConfirm(null);
  }, [open]);

  useEffect(() => {
    setEditingItem(null);
    setDeleteConfirm(null);
  }, [selectedDate]);

  const todayItems = todayQuery.data?.items ?? [];
  const todayTotal = todayItems.length;
  const todayDone = todayItems.filter((it) => it.is_done).length;
  const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  const items = listQuery.data?.items ?? [];
  const editable = listQuery.data?.editable ?? isEditableIsoDate(selectedDate);

  useEffect(() => {
    setLocalOrder(items.map((it) => it.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.data]);

  const orderedItems = localOrder
    .map((id) => items.find((it) => it.id === id))
    .filter((it): it is DailyProductiveItemApi => Boolean(it));

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["daily-productive-items", token] });
  }, [queryClient, token]);

  const refresh = useCallback(() => {
    void todayQuery.refetch();
    void listQuery.refetch();
  }, [todayQuery, listQuery]);

  const handleDragPointerDown = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIdRef.current = id;
    setDraggingId(id);
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const draggedId = dragIdRef.current;
    if (!draggedId) return;
    const pointerY = e.clientY;

    let closestId: string | null = null;
    let closestDistance = Infinity;
    itemRefs.current.forEach((el, id) => {
      if (id === draggedId) return;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const distance = Math.abs(pointerY - mid);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = id;
      }
    });
    if (!closestId) return;

    setLocalOrder((prev) => {
      const fromIndex = prev.indexOf(draggedId);
      const toIndex = prev.indexOf(closestId as string);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggedId);
      return next;
    });
  };

  const handleDragPointerUp = () => {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    setDraggingId(null);
    if (!draggedId || !token) return;
    const orderToSave = localOrder;
    void (async () => {
      try {
        await reorderDailyProductiveItems(token, selectedDate, orderToSave);
        setMutationError(null);
        invalidate();
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not reorder items");
        invalidate();
      }
    })();
  };

  const submitAdd = () => {
    const text = addDraft.trim();
    if (!text || !token) return;
    void (async () => {
      try {
        await createDailyProductiveItem(token, selectedDate, text);
        setAddDraft("");
        setAddOpen(false);
        setAddError(null);
        invalidate();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Could not add item");
      }
    })();
  };

  const confirmToggle = () => {
    if (!toggleConfirm || !token) return;
    const { item, nextDone } = toggleConfirm;
    setToggleConfirm(null);
    void (async () => {
      try {
        await patchDailyProductiveItem(token, item.id, { is_done: nextDone });
        setMutationError(null);
        invalidate();
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not update item");
      }
    })();
  };

  const confirmDelete = () => {
    if (!deleteConfirm || !token) return;
    const item = deleteConfirm;
    setDeleteConfirm(null);
    void (async () => {
      try {
        await deleteDailyProductiveItem(token, item.id);
        if (editingItem?.id === item.id) setEditingItem(null);
        setMutationError(null);
        invalidate();
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Could not delete item");
      }
    })();
  };

  const startEdit = (item: DailyProductiveItemApi) => {
    setEditingItem(item);
    setEditDraftText(item.text);
    setEditDraftDate(item.item_date);
    setEditError(null);
  };

  const submitEdit = () => {
    if (!editingItem || !token) return;
    const text = editDraftText.trim();
    if (!text) return;
    const patch: { text?: string; item_date?: string } = {};
    if (text !== editingItem.text) patch.text = text;
    if (editDraftDate !== editingItem.item_date) patch.item_date = editDraftDate;
    if (Object.keys(patch).length === 0) {
      setEditingItem(null);
      return;
    }
    void (async () => {
      try {
        await patchDailyProductiveItem(token, editingItem.id, patch);
        setEditingItem(null);
        setEditError(null);
        invalidate();
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Could not update item");
      }
    })();
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Daily productive list"
        title="Daily productive list"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:bg-zinc-700/50"
      >
        <IconChecklist className="h-4 w-4 shrink-0" />
        <span className="tabular-nums whitespace-nowrap">
          {todayDone}/{todayTotal}
          <span className="hidden text-zinc-500 dark:text-zinc-400 sm:inline"> · {todayPct}%</span>
        </span>
      </button>

      <RightDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Productive list"
        width="3xl"
        actions={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DatePicker
              selected={isoToLocalDate(selectedDate)}
              onChange={(date: Date | null) => {
                if (date) setSelectedDate(localDateToIso(date));
              }}
              maxDate={shiftDate(isoToLocalDate(todayIso), 7)}
              dateFormat="yyyy-MM-dd"
              popperPlacement="bottom-start"
              className="min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={refresh}
              disabled={listQuery.isFetching}
              aria-label="Refresh list"
              title="Refresh"
              className="shrink-0 rounded-md border border-zinc-300 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <IconRefresh className={`h-3.5 w-3.5 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
            {editable ? (
              <button
                type="button"
                onClick={() => {
                  setAddDraft("");
                  setAddError(null);
                  setAddOpen(true);
                }}
                className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 dark:bg-blue-500"
              >
                Add
              </button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-3">
          {!editable ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
              This date is view-only. Only dates within 7 days of today can be changed.
            </p>
          ) : null}
          {mutationError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {mutationError}
            </p>
          ) : null}

          {addOpen ? (
            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
              <input
                autoFocus
                type="text"
                value={addDraft}
                onChange={(e) => setAddDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdd();
                  if (e.key === "Escape") setAddOpen(false);
                }}
                placeholder="e.g. Finish the report"
                maxLength={500}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {addError ? <p className="text-xs text-red-600 dark:text-red-400">{addError}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={!addDraft.trim()}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500"
                >
                  Add
                </button>
              </div>
            </div>
          ) : null}

          {listQuery.isLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          ) : listQuery.isError ? (
            <p className="text-sm text-red-700 dark:text-red-300">Could not load the list for this date.</p>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-6 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
              No items yet{editable ? " — use Add to create your first one." : "."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
              {orderedItems.map((item) =>
                editingItem?.id === item.id ? (
                  <li key={item.id} className="space-y-2 bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                    <input
                      autoFocus
                      type="text"
                      value={editDraftText}
                      onChange={(e) => setEditDraftText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitEdit();
                        if (e.key === "Escape") setEditingItem(null);
                      }}
                      maxLength={500}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <DatePicker
                      selected={isoToLocalDate(editDraftDate)}
                      onChange={(date: Date | null) => {
                        if (date) setEditDraftDate(localDateToIso(date));
                      }}
                      minDate={shiftDate(isoToLocalDate(todayIso), -7)}
                      maxDate={shiftDate(isoToLocalDate(todayIso), 7)}
                      dateFormat="yyyy-MM-dd"
                      popperPlacement="bottom-start"
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    {editError ? <p className="text-xs text-red-600 dark:text-red-400">{editError}</p> : null}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitEdit}
                        disabled={!editDraftText.trim()}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el);
                      else itemRefs.current.delete(item.id);
                    }}
                    onClick={() => {
                      if (!editable) return;
                      setToggleConfirm({ item, nextDone: !item.is_done });
                    }}
                    className={`flex items-start gap-2.5 px-3 py-2 ${
                      editable ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60" : ""
                    } ${draggingId === item.id ? "opacity-50" : ""}`}
                  >
                    {editable ? (
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={handleDragPointerDown(item.id)}
                        onPointerMove={handleDragPointerMove}
                        onPointerUp={handleDragPointerUp}
                        onPointerCancel={handleDragPointerUp}
                        aria-label="Drag to reorder"
                        title="Drag to reorder"
                        className="mt-0.5 shrink-0 touch-none rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                      >
                        <IconGrip className="h-4 w-4" />
                      </button>
                    ) : null}
                    <input
                      type="checkbox"
                      checked={item.is_done}
                      disabled={!editable}
                      readOnly
                      className="pointer-events-none mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-900"
                    />
                    <span
                      className={`min-w-0 flex-1 break-words text-sm ${
                        item.is_done
                          ? "text-zinc-400 line-through dark:text-zinc-500"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {item.text}
                    </span>
                    {editable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(item);
                        }}
                        aria-label="Edit item"
                        title="Edit"
                        className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {editable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(item);
                        }}
                        aria-label="Delete item"
                        title="Delete"
                        className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      </RightDrawer>

      <Dialog
        isOpen={toggleConfirm !== null}
        onClose={() => setToggleConfirm(null)}
        title={toggleConfirm?.nextDone ? "Mark as done" : "Mark as not done"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {toggleConfirm?.nextDone ? "Mark" : "Unmark"}{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{toggleConfirm?.item.text}</span> as{" "}
            {toggleConfirm?.nextDone ? "done" : "not done"}?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setToggleConfirm(null)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmToggle}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500"
            >
              Confirm
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete item"
        size="sm"
        variant="danger"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Delete <span className="font-semibold text-zinc-900 dark:text-zinc-100">{deleteConfirm?.text}</span>?
            This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
