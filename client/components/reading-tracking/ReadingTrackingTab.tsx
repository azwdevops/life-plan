"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { getReadingLibrary, putReadingLibrary } from "@/lib/api/reading-library";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createAuthor,
  createBookDraft,
  createCategory,
  findAuthorIdByName,
  findCategoryIdByName,
  loadReadingLibrary,
  saveReadingLibrary,
  type ReadingAuthor,
  type ReadingBook,
  type ReadingCategory,
  type ReadingLibrary,
  type ReadingShelf,
} from "@/lib/reading-books-storage";

const SHELF_TABS: Array<{ id: ReadingShelf; label: string }> = [
  { id: "want", label: "Want to read" },
  { id: "reading", label: "Currently reading" },
  { id: "read", label: "Read" },
];

function moveBookToShelf(book: ReadingBook, shelf: ReadingShelf): ReadingBook {
  const today = new Date().toISOString().slice(0, 10);
  if (shelf === "want") {
    return {
      ...book,
      shelf: "want",
      progressPercent: 0,
      startedAt: undefined,
      finishedAt: undefined,
      rating: undefined,
      currentPage: undefined,
      totalPages: undefined,
    };
  }
  if (shelf === "reading") {
    return {
      ...book,
      shelf: "reading",
      progressPercent: book.shelf === "read" ? 0 : book.progressPercent,
      finishedAt: undefined,
      rating: undefined,
      startedAt: book.startedAt ?? today,
    };
  }
  return {
    ...book,
    shelf: "read",
    progressPercent: 100,
    finishedAt: book.finishedAt ?? today,
    rating: book.rating && book.rating > 0 ? book.rating : undefined,
  };
}

function categoryNameById(categories: ReadingCategory[], id: string): string {
  return categories.find((c) => c.id === id)?.name ?? "Unknown category";
}

function authorNameById(authors: ReadingAuthor[], id: string): string {
  return authors.find((a) => a.id === id)?.name ?? "Unknown author";
}

function applyBookEdits(
  base: ReadingBook,
  title: string,
  authorId: string,
  categoryIds: string[],
  targetShelf: ReadingShelf,
  progressPercent: number,
  rating: number
): ReadingBook {
  const withBasics: ReadingBook = {
    ...base,
    title: title.trim() || base.title,
    authorId,
    categoryIds: [...new Set(categoryIds)],
  };
  let next = moveBookToShelf(withBasics, targetShelf);
  if (targetShelf === "reading") {
    next = {
      ...next,
      progressPercent: Math.min(100, Math.max(0, Math.round(progressPercent))),
    };
  }
  if (targetShelf === "read") {
    next = {
      ...next,
      progressPercent: 100,
      rating: rating > 0 ? Math.min(5, Math.max(1, rating)) : undefined,
    };
  }
  return next;
}

function BookCardOverflowMenu({
  onEdit,
  onRemove,
}: {
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Book actions"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          role="menu"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Edit
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
            >
              Remove
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

type ReadingTrackingTabProps = {
  embedded?: boolean;
};

export function ReadingTrackingTab({ embedded = true }: ReadingTrackingTabProps) {
  const [library, setLibrary] = useState<ReadingLibrary>({
    books: [],
    categories: [],
    authors: [],
  });
  const [hydrated, setHydrated] = useState(false);
  const [shelf, setShelf] = useState<ReadingShelf>("want");
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [authorFilterId, setAuthorFilterId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthorId, setNewAuthorId] = useState("");
  const [newShelf, setNewShelf] = useState<ReadingShelf>("want");
  const [newBookCategoryIds, setNewBookCategoryIds] = useState<Set<string>>(() => new Set());
  const [newBookCategoryPickerKey, setNewBookCategoryPickerKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthorId, setEditAuthorId] = useState("");
  const [editShelf, setEditShelf] = useState<ReadingShelf>("want");
  const [editCategoryIds, setEditCategoryIds] = useState<Set<string>>(() => new Set());
  const [editProgress, setEditProgress] = useState(0);
  const [editRating, setEditRating] = useState(0);
  const [editCategoryPickerKey, setEditCategoryPickerKey] = useState(0);

  const { token } = useAuth();
  const [remoteSyncComplete, setRemoteSyncComplete] = useState(false);

  useEffect(() => {
    setLibrary(loadReadingLibrary());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      setRemoteSyncComplete(true);
      return;
    }
    setRemoteSyncComplete(false);
    let cancelled = false;
    getReadingLibrary(token)
      .then((remote) => {
        if (cancelled) return;
        setLibrary(remote);
        saveReadingLibrary(remote);
      })
      .catch(() => {
        /* keep local library */
      })
      .finally(() => {
        if (!cancelled) setRemoteSyncComplete(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  useEffect(() => {
    if (!hydrated) return;
    saveReadingLibrary(library);
  }, [library, hydrated]);

  useEffect(() => {
    if (!hydrated || !token || !remoteSyncComplete) return;
    const timer = setTimeout(() => {
      putReadingLibrary(token, library).catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [library, hydrated, token, remoteSyncComplete]);

  const books = library.books;
  const categories = library.categories;
  const authors = library.authors;

  const filtered = useMemo(() => {
    return books
      .filter((b) => b.shelf === shelf)
      .filter((b) => !categoryFilterId || b.categoryIds.includes(categoryFilterId))
      .filter((b) => !authorFilterId || b.authorId === authorFilterId)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [books, shelf, categoryFilterId, authorFilterId]);

  const categoryFilterOptions = useMemo(() => {
    const rows = [
      { value: "", label: "All categories", searchText: "all" },
      ...categories.map((c) => ({
        value: c.id,
        label: c.name,
        searchText: c.name,
      })),
    ];
    if (
      categoryFilterId &&
      !categories.some((c) => c.id === categoryFilterId)
    ) {
      rows.push({
        value: categoryFilterId,
        label: "Unknown category",
        searchText: "unknown",
      });
    }
    return rows;
  }, [categories, categoryFilterId]);

  const authorFilterOptions = useMemo(
    () => [
      { value: "", label: "All authors", searchText: "all" },
      ...authors.map((a) => ({
        value: a.id,
        label: a.name,
        searchText: a.name,
      })),
    ],
    [authors]
  );

  const deleteCategory = useCallback((categoryId: string) => {
    setLibrary((prev) => ({
      categories: prev.categories.filter((c) => c.id !== categoryId),
      authors: prev.authors,
      books: prev.books.map((b) => ({
        ...b,
        categoryIds: b.categoryIds.filter((id) => id !== categoryId),
      })),
    }));
    setCategoryFilterId((fid) => (fid === categoryId ? "" : fid));
  }, []);

  const removeBook = useCallback((id: string) => {
    setLibrary((prev) => ({ ...prev, books: prev.books.filter((b) => b.id !== id) }));
    setEditingBookId((eid) => {
      if (eid === id) {
        setEditOpen(false);
        return null;
      }
      return eid;
    });
  }, []);

  const handleAddBook = () => {
    const title = newTitle.trim();
    if (!title || !newAuthorId) return;
    const shelfChoice = newShelf;
    const categoryIds = [...newBookCategoryIds];

    setLibrary((prev) => ({
      ...prev,
      books: [
        ...prev.books,
        createBookDraft({
          title,
          authorId: newAuthorId,
          shelf: shelfChoice,
          categoryIds,
        }),
      ],
    }));

    setNewTitle("");
    setNewAuthorId("");
    setNewShelf("want");
    setNewBookCategoryIds(new Set());
    setNewBookCategoryPickerKey((k) => k + 1);
    setAddOpen(false);
    setShelf(shelfChoice);
  };

  const pad = embedded ? "px-4 py-6 md:px-6 md:py-8" : "px-4 py-6";

  const authorOptionsForPicker = useMemo(
    () =>
      authors.map((a) => ({
        value: a.id,
        label: a.name,
        searchText: a.name,
      })),
    [authors]
  );

  const openAddDialog = () => {
    setNewTitle("");
    setNewAuthorId("");
    setNewShelf("want");
    setNewBookCategoryIds(new Set());
    setNewBookCategoryPickerKey((k) => k + 1);
    setAddOpen(true);
  };

  const openEditBook = useCallback((book: ReadingBook) => {
    setEditingBookId(book.id);
    setEditTitle(book.title);
    setEditAuthorId(book.authorId);
    setEditShelf(book.shelf);
    setEditCategoryIds(new Set(book.categoryIds));
    setEditProgress(book.progressPercent);
    setEditRating(book.rating ?? 0);
    setEditCategoryPickerKey((k) => k + 1);
    setEditOpen(true);
  }, []);

  const closeEditBook = useCallback(() => {
    setEditOpen(false);
    setEditingBookId(null);
  }, []);

  const handleSaveEditBook = useCallback(() => {
    if (!editingBookId || !editTitle.trim() || !editAuthorId) return;
    setLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) =>
        b.id === editingBookId
          ? applyBookEdits(
              b,
              editTitle,
              editAuthorId,
              [...editCategoryIds],
              editShelf,
              editProgress,
              editRating
            )
          : b
      ),
    }));
    closeEditBook();
  }, [
    closeEditBook,
    editAuthorId,
    editCategoryIds,
    editProgress,
    editRating,
    editShelf,
    editTitle,
    editingBookId,
  ]);

  return (
    <div
      className={
        embedded
          ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
          : "flex min-h-screen w-full flex-col"
      }
    >
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${pad}`}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
            Reading
          </h2>
          <button
            type="button"
            onClick={openAddDialog}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Add a book
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4 lg:gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Shelf</span>
            <div className="flex flex-wrap gap-2">
              {SHELF_TABS.map((tab) => {
                const count = books.filter((b) => b.shelf === tab.id).length;
                const active = shelf === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setShelf(tab.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                      active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="block">{tab.label}</span>
                    <span className="text-xs font-normal opacity-80">
                      {count} {count === 1 ? "book" : "books"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-w-[min(100%,11rem)] flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Category
            </label>
            <SearchableSelect
              options={categoryFilterOptions}
              value={categoryFilterId}
              onChange={(v) => setCategoryFilterId(String(v))}
              placeholder="Filter by category"
              searchPlaceholder="Type to search or create…"
              allowClear
              creatableMode="when-no-exact-match"
              onCreateNew={(term) => {
                const trimmed = term.trim();
                if (!trimmed) return;
                setLibrary((prev) => {
                  const existing = findCategoryIdByName(prev.categories, trimmed);
                  if (existing) {
                    queueMicrotask(() => setCategoryFilterId(existing));
                    return prev;
                  }
                  const c = createCategory(trimmed);
                  queueMicrotask(() => setCategoryFilterId(c.id));
                  return { ...prev, categories: [...prev.categories, c] };
                });
              }}
              createNewLabel={(t) => `Create category “${t.trim()}”`}
              className="w-full"
            />
          </div>
          <div className="min-w-[min(100%,11rem)] flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Author
            </label>
            <SearchableSelect
              options={authorFilterOptions}
              value={authorFilterId}
              onChange={(v) => setAuthorFilterId(String(v))}
              placeholder="Filter by author"
              searchPlaceholder="Type to search or create…"
              allowClear
              creatableMode="when-no-exact-match"
              onCreateNew={(term) => {
                const trimmed = term.trim();
                if (!trimmed) return;
                setLibrary((prev) => {
                  const existing = findAuthorIdByName(prev.authors, trimmed);
                  if (existing) {
                    queueMicrotask(() => setAuthorFilterId(existing));
                    return prev;
                  }
                  const a = createAuthor(trimmed);
                  queueMicrotask(() => setAuthorFilterId(a.id));
                  return { ...prev, authors: [...prev.authors, a] };
                });
              }}
              createNewLabel={(t) => `Create author “${t.trim()}”`}
              className="w-full"
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div
            className="mb-6 flex flex-wrap items-center gap-2"
            aria-label="Categories"
          >
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800"
              >
                <span className="text-zinc-800 dark:text-zinc-200">{c.name}</span>
                <button
                  type="button"
                  onClick={() => deleteCategory(c.id)}
                  className="rounded px-1 text-zinc-500 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                  aria-label={`Remove category ${c.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {!hydrated ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-12 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {books.filter((b) => b.shelf === shelf).length === 0
                ? "No books on this shelf yet"
                : "No books match this filter"}
            </p>
            {(categoryFilterId || authorFilterId) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilterId("");
                  setAuthorFilterId("");
                }}
                className="mt-4 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Clear filters
              </button>
            )}
            {books.filter((b) => b.shelf === shelf).length === 0 && (
              <button
                type="button"
                onClick={openAddDialog}
                className="mt-4 block w-full text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Add your first book
              </button>
            )}
          </div>
        ) : (
          <ul className="grid min-h-0 flex-1 auto-rows-min gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((book) => {
              const authorLabel = authorNameById(authors, book.authorId);
              const labelNames = book.categoryIds.map((cid) =>
                categoryNameById(categories, cid)
              );
              return (
                <li key={book.id}>
                  <article className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <h3 className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                          {book.title}
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{authorLabel}</p>
                        {labelNames.length > 0 ? (
                          <p className="text-sm text-zinc-500 dark:text-zinc-500">
                            {labelNames.join(", ")}
                          </p>
                        ) : null}
                        {book.shelf === "reading" ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Progress: {book.progressPercent}%
                          </p>
                        ) : null}
                        {book.shelf === "read" ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {(book.rating ?? 0) > 0
                              ? `Rating: ${book.rating} / 5`
                              : "Rating: —"}
                          </p>
                        ) : null}
                      </div>
                      <BookCardOverflowMenu
                        onEdit={() => openEditBook(book)}
                        onRemove={() => removeBook(book.id)}
                      />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add a book" size="md">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="reading-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Title
            </label>
            <input
              id="reading-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Author</span>
            <div className="mt-1">
              <SearchableSelect
                options={authorOptionsForPicker}
                value={newAuthorId}
                onChange={(v) => setNewAuthorId(String(v))}
                placeholder="Select or create author"
                searchPlaceholder="Type to search or create…"
                allowClear
                creatableMode="when-no-exact-match"
                onCreateNew={(term) => {
                  const trimmed = term.trim();
                  if (!trimmed) return;
                  setLibrary((prev) => {
                    const existing = findAuthorIdByName(prev.authors, trimmed);
                    if (existing) {
                      queueMicrotask(() => setNewAuthorId(existing));
                      return prev;
                    }
                    const a = createAuthor(trimmed);
                    queueMicrotask(() => setNewAuthorId(a.id));
                    return { ...prev, authors: [...prev.authors, a] };
                  });
                }}
                createNewLabel={(t) => `Create author “${t.trim()}”`}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Shelf</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SHELF_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNewShelf(tab.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    newShelf === tab.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100"
                      : "border-zinc-200 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Categories</span>
            {newBookCategoryIds.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[...newBookCategoryIds].map((cid) => (
                  <span
                    key={cid}
                    className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {categoryNameById(categories, cid)}
                    <button
                      type="button"
                      onClick={() =>
                        setNewBookCategoryIds((prev) => {
                          const next = new Set(prev);
                          next.delete(cid);
                          return next;
                        })
                      }
                      className="text-zinc-500 hover:text-red-600"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2">
              <SearchableSelect
                key={newBookCategoryPickerKey}
                options={categories
                  .filter((c) => !newBookCategoryIds.has(c.id))
                  .map((c) => ({
                    value: c.id,
                    label: c.name,
                    searchText: c.name,
                  }))}
                value=""
                onChange={(v) => {
                  const id = String(v);
                  if (!id) return;
                  setNewBookCategoryIds((prev) => new Set([...prev, id]));
                  setNewBookCategoryPickerKey((k) => k + 1);
                }}
                placeholder="Add category…"
                searchPlaceholder="Type to search or create…"
                creatableMode="when-no-exact-match"
                onCreateNew={(term) => {
                  const trimmed = term.trim();
                  if (!trimmed) return;
                  setLibrary((prev) => {
                    const existing = findCategoryIdByName(prev.categories, trimmed);
                    if (existing) {
                      queueMicrotask(() =>
                        setNewBookCategoryIds((s) => new Set([...s, existing]))
                      );
                      return prev;
                    }
                    const c = createCategory(trimmed);
                    queueMicrotask(() =>
                      setNewBookCategoryIds((s) => new Set([...s, c.id]))
                    );
                    return { ...prev, categories: [...prev.categories, c] };
                  });
                  setNewBookCategoryPickerKey((k) => k + 1);
                }}
                createNewLabel={(t) => `Create category “${t.trim()}”`}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddBook}
              disabled={!newTitle.trim() || !newAuthorId}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-600"
            >
              Add
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={editOpen} onClose={closeEditBook} title="Edit book" size="md">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-reading-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Title
            </label>
            <input
              id="edit-reading-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Author</span>
            <div className="mt-1">
              <SearchableSelect
                options={authorOptionsForPicker}
                value={editAuthorId}
                onChange={(v) => setEditAuthorId(String(v))}
                placeholder="Select or create author"
                searchPlaceholder="Type to search or create…"
                allowClear
                creatableMode="when-no-exact-match"
                onCreateNew={(term) => {
                  const trimmed = term.trim();
                  if (!trimmed) return;
                  setLibrary((prev) => {
                    const existing = findAuthorIdByName(prev.authors, trimmed);
                    if (existing) {
                      queueMicrotask(() => setEditAuthorId(existing));
                      return prev;
                    }
                    const a = createAuthor(trimmed);
                    queueMicrotask(() => setEditAuthorId(a.id));
                    return { ...prev, authors: [...prev.authors, a] };
                  });
                }}
                createNewLabel={(t) => `Create author “${t.trim()}”`}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Shelf</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SHELF_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEditShelf(tab.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    editShelf === tab.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100"
                      : "border-zinc-200 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Categories</span>
            {editCategoryIds.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[...editCategoryIds].map((cid) => (
                  <span
                    key={cid}
                    className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {categoryNameById(categories, cid)}
                    <button
                      type="button"
                      onClick={() =>
                        setEditCategoryIds((prev) => {
                          const next = new Set(prev);
                          next.delete(cid);
                          return next;
                        })
                      }
                      className="text-zinc-500 hover:text-red-600"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2">
              <SearchableSelect
                key={editCategoryPickerKey}
                options={categories
                  .filter((c) => !editCategoryIds.has(c.id))
                  .map((c) => ({
                    value: c.id,
                    label: c.name,
                    searchText: c.name,
                  }))}
                value=""
                onChange={(v) => {
                  const id = String(v);
                  if (!id) return;
                  setEditCategoryIds((prev) => new Set([...prev, id]));
                  setEditCategoryPickerKey((k) => k + 1);
                }}
                placeholder="Add category…"
                searchPlaceholder="Type to search or create…"
                creatableMode="when-no-exact-match"
                onCreateNew={(term) => {
                  const trimmed = term.trim();
                  if (!trimmed) return;
                  setLibrary((prev) => {
                    const existing = findCategoryIdByName(prev.categories, trimmed);
                    if (existing) {
                      queueMicrotask(() =>
                        setEditCategoryIds((s) => new Set([...s, existing]))
                      );
                      return prev;
                    }
                    const c = createCategory(trimmed);
                    queueMicrotask(() => setEditCategoryIds((s) => new Set([...s, c.id])));
                    return { ...prev, categories: [...prev.categories, c] };
                  });
                  setEditCategoryPickerKey((k) => k + 1);
                }}
                createNewLabel={(t) => `Create category “${t.trim()}”`}
                className="w-full"
              />
            </div>
          </div>
          {editShelf === "reading" && (
            <div>
              <label htmlFor="edit-progress" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Progress
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="edit-progress"
                  type="range"
                  min={0}
                  max={100}
                  value={editProgress}
                  onChange={(e) => setEditProgress(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer accent-emerald-600"
                />
                <span className="w-10 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                  {editProgress}%
                </span>
              </div>
            </div>
          )}
          {editShelf === "read" && (
            <div>
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Rating</span>
              <div className="mt-2 flex items-center gap-1" role="group" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = editRating >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRating(star)}
                      className={`rounded p-0.5 text-lg leading-none transition ${
                        filled
                          ? "text-amber-500"
                          : "text-zinc-300 hover:text-zinc-400 dark:text-zinc-600 dark:hover:text-zinc-500"
                      }`}
                      aria-label={`${star} stars`}
                    >
                      ★
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setEditRating(0)}
                  className="ml-2 text-xs text-zinc-500 underline dark:text-zinc-400"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeEditBook}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEditBook}
              disabled={!editTitle.trim() || !editAuthorId}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-600"
            >
              Save
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
