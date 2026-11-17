"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RightDrawer } from "@/components/RightDrawer";
import { DropdownMenu } from "@/components/DropdownMenu";
import { Dialog } from "@/components/Dialog";
import { TiptapRichTextEditor } from "@/components/editor/TiptapRichTextEditor";
import { useAuth } from "@/lib/hooks/use-auth";
import { getCurrentUser, putBookIdeasBook } from "@/lib/api/auth";
import {
  createAzwBookChapter,
  deleteAzwBookChapter,
  getAzwBookChapters,
  getAzwBooks,
  updateAzwBookChapter,
  type AzwBookChapter,
} from "@/lib/api/azw-books";

// Chapter titles here are meaningless auto-generated "Chapter N" labels - the
// actual idea lives in the (Tiptap HTML) content, so rows show a stripped
// plain-text preview of that instead of the title.
function stripHtml(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

// Shared form drawer for both "New book idea" (Add) and "Edit book idea" -
// stacks on top of BookIdeasDrawer (stackLevel 1), mirroring the Add/Edit
// drawers in ChannelsDrawer/LinkedInPagesDrawer. It's always mounted, so
// content only resets from `initialContent` while open - that keeps the
// previous content visible during the close transition instead of flashing
// empty.
function IdeaFormDrawer({
  open,
  onClose,
  title,
  initialContent,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setContent(initialContent);
  }, [open, initialContent]);

  const save = async () => {
    const trimmed = stripHtml(content);
    if (!trimmed) {
      alert("Write something first.");
      return;
    }
    setSaving(true);
    try {
      await onSave(content);
      alert("Book idea saved.");
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RightDrawer open={open} onClose={onClose} title={title} width="2xl" stackLevel={1}>
      <div className="flex flex-col gap-4">
        <TiptapRichTextEditor value={content} onChange={setContent} minHeight="12rem" aria-label="Book idea" />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </RightDrawer>
  );
}

// Read-only view of a single idea's full content, stacked on top of
// BookIdeasDrawer. Keeps rendering the last-viewed chapter while closing so
// the content doesn't flash empty during the slide-out transition.
function ViewIdeaDrawer({ chapter, onClose }: { chapter: AzwBookChapter | null; onClose: () => void }) {
  return (
    <RightDrawer open={!!chapter} onClose={onClose} title="Book idea" width="2xl" stackLevel={1}>
      <div
        className="prose prose-sm prose-zinc max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: chapter?.content || '<p class="text-zinc-400">(empty)</p>' }}
      />
    </RightDrawer>
  );
}

function IdeaRow({
  chapter,
  onView,
  onEdit,
  onCopy,
  onDeleteClick,
}: {
  chapter: AzwBookChapter;
  onView: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDeleteClick: () => void;
}) {
  const preview = useMemo(() => stripHtml(chapter.content) || "(empty)", [chapter.content]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">{preview}</p>
      <DropdownMenu
        menuButtonAriaLabel="Idea actions"
        overlayOnBody
        items={[
          { label: "View", onClick: onView },
          { label: "Edit", onClick: onEdit },
          { label: "Copy", onClick: onCopy },
          { label: "Delete", onClick: onDeleteClick, danger: true },
        ]}
      />
    </div>
  );
}

export function BookIdeasDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const [pickerValue, setPickerValue] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [viewingChapter, setViewingChapter] = useState<AzwBookChapter | null>(null);
  const [editingChapter, setEditingChapter] = useState<AzwBookChapter | null>(null);
  const [deletingChapter, setDeletingChapter] = useState<AzwBookChapter | null>(null);
  const [choosingBook, setChoosingBook] = useState(false);
  const [changingBook, setChangingBook] = useState(false);
  const [pendingBookId, setPendingBookId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Which book holds book ideas is stored on the user's profile (not
  // localStorage), so the choice is shared between the web app and mobile
  // instead of being picked separately per device.
  const meQuery = useQuery({
    queryKey: ["auth-me", token],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getCurrentUser(token);
    },
    enabled: !!token && open,
  });
  const bookId = meQuery.data?.book_ideas_book_id ?? null;

  const booksQuery = useQuery({
    queryKey: ["azw-books", token],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getAzwBooks(token);
    },
    enabled: !!token && open,
  });

  const books = booksQuery.data ?? [];
  const selectedBook = books.find((b) => b.id === bookId) ?? null;
  // A saved id that no longer matches any book (deleted) falls back to the
  // picker rather than silently querying a dead id.
  const needsPicker =
    open && !booksQuery.isLoading && !meQuery.isLoading && (!bookId || !selectedBook);
  // "Change book" (explicit, via the header button) shows the same picker
  // but keeps the current selection live underneath until the user actually
  // picks a different book AND confirms - clicking "Change book" must never
  // itself clear/replace the existing choice.
  const showPicker = needsPicker || changingBook;
  const pendingBook = books.find((b) => b.id === pendingBookId) ?? null;

  const chaptersQuery = useQuery({
    queryKey: ["azw-book-chapters", token, bookId],
    queryFn: () => {
      if (!token || !bookId) throw new Error("No book selected");
      return getAzwBookChapters(token, bookId);
    },
    enabled: !!token && !!bookId && !!selectedBook && open,
  });

  const chooseBook = async (id: number) => {
    if (!token) return;
    setChoosingBook(true);
    try {
      await putBookIdeasBook(token, id);
      await queryClient.invalidateQueries({ queryKey: ["auth-me", token] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save book choice.");
    } finally {
      setChoosingBook(false);
    }
  };

  // Opens the picker only - the existing choice stays untouched until the
  // user picks a different book and confirms via the dialog below.
  const changeBook = () => {
    setPickerValue("");
    setChangingBook(true);
  };

  const cancelChangingBook = () => {
    setChangingBook(false);
    setPickerValue("");
  };

  const handleUseThisBook = (id: number) => {
    if (changingBook) {
      // Replacing an existing choice - require confirmation first.
      setPendingBookId(id);
    } else {
      // First-time pick (needsPicker) - nothing to replace, go straight through.
      void chooseBook(id);
    }
  };

  const confirmChangeBook = async () => {
    if (pendingBookId == null) return;
    await chooseBook(pendingBookId);
    setPendingBookId(null);
    setChangingBook(false);
    setPickerValue("");
  };

  const invalidateChapters = () =>
    queryClient.invalidateQueries({ queryKey: ["azw-book-chapters", token, bookId] });

  // Re-fetches everything from the backend, so edits/additions made from the
  // mobile app show up here without needing a full page reload.
  const refresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth-me", token] }),
        queryClient.invalidateQueries({ queryKey: ["azw-books", token] }),
        bookId ? queryClient.invalidateQueries({ queryKey: ["azw-book-chapters", token, bookId] }) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const addIdea = async (content: string) => {
    if (!token || !bookId) return;
    await createAzwBookChapter(token, bookId, { content });
    await invalidateChapters();
  };

  const saveEdit = async (content: string) => {
    if (!token || !editingChapter) return;
    await updateAzwBookChapter(token, editingChapter.id, { content });
    await invalidateChapters();
  };

  const copyIdea = async (chapter: AzwBookChapter) => {
    if (!token || !bookId) return;
    await createAzwBookChapter(token, bookId, { content: chapter.content });
    await invalidateChapters();
  };

  const confirmDelete = async () => {
    if (!token || !deletingChapter) return;
    try {
      await deleteAzwBookChapter(token, deletingChapter.id);
      setDeletingChapter(null);
      await invalidateChapters();
      alert("Book idea deleted.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete.");
    }
  };

  const headerActions = selectedBook ? (
    <div className="flex w-full items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={refreshing}
        title="Pick up changes made from the mobile app"
        className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {refreshing ? "Refreshing…" : "⟳ Refresh"}
      </button>
      {!changingBook && (
        <>
          <button
            type="button"
            onClick={changeBook}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Change book
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="shrink-0 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            + Add idea
          </button>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <>
      <RightDrawer open={open} onClose={onClose} title="Book ideas" width="5xl" actions={headerActions}>
        <div className="space-y-4">
          {!token ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Log in to view book ideas.</p>
          ) : booksQuery.isLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading books…</p>
          ) : books.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No books yet - create one on the AZW Books page first, then pick it here.
            </p>
          ) : showPicker ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Which book holds your future book ideas, as chapters?
              </p>
              <select
                value={pickerValue}
                onChange={(e) => setPickerValue(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="" disabled>
                  Choose a book…
                </option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => pickerValue && handleUseThisBook(Number(pickerValue))}
                  disabled={!pickerValue || choosingBook}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {choosingBook ? "Saving…" : "Use this book"}
                </button>
                {changingBook && (
                  <button
                    type="button"
                    onClick={cancelChangingBook}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : chaptersQuery.isLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading ideas…</p>
          ) : (chaptersQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No ideas yet - click "+ Add idea" above to write your first one.
            </p>
          ) : (
            <div className="space-y-2">
              {(chaptersQuery.data ?? []).map((chapter) => (
                <IdeaRow
                  key={chapter.id}
                  chapter={chapter}
                  onView={() => setViewingChapter(chapter)}
                  onEdit={() => setEditingChapter(chapter)}
                  onCopy={() => void copyIdea(chapter)}
                  onDeleteClick={() => setDeletingChapter(chapter)}
                />
              ))}
            </div>
          )}
        </div>
      </RightDrawer>
      <IdeaFormDrawer open={addOpen} onClose={() => setAddOpen(false)} title="New book idea" initialContent="" onSave={addIdea} />
      <IdeaFormDrawer
        open={!!editingChapter}
        onClose={() => setEditingChapter(null)}
        title="Edit book idea"
        initialContent={editingChapter?.content ?? ""}
        onSave={saveEdit}
      />
      <ViewIdeaDrawer chapter={viewingChapter} onClose={() => setViewingChapter(null)} />
      <Dialog
        isOpen={pendingBookId != null}
        onClose={() => setPendingBookId(null)}
        title="Change book?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Switch the book ideas list to &quot;{pendingBook?.title}&quot;
            {selectedBook ? <> (replacing &quot;{selectedBook.title}&quot;)</> : null}? This applies
            everywhere - web and mobile.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingBookId(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmChangeBook()}
              disabled={choosingBook}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {choosingBook ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        isOpen={!!deletingChapter}
        onClose={() => setDeletingChapter(null)}
        title="Delete idea?"
        variant="danger"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            This book idea will be permanently deleted. This can't be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingChapter(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
