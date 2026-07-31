"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RightDrawer } from "@/components/RightDrawer";
import { SearchableSelect } from "@/components/SearchableSelect";
import { TiptapRichTextEditor } from "@/components/editor/TiptapRichTextEditor";
import { RowActionsMenu } from "./RowActionsMenu";
import { ChaptersDrawer } from "./ChaptersDrawer";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePageHeaderActions, usePageHeaderExtra, usePageHeaderMenuExtra } from "@/contexts/PageHeaderActionsContext";
import {
  createAzwBook,
  deleteAzwBook,
  getAzwBooks,
  updateAzwBook,
  type AzwBook,
} from "@/lib/api/azw-books";
import {
  createLibraryAuthor,
  getLibraryAuthors,
  getLibraryCategories,
  type LibraryAuthor,
  type LibraryCategory,
} from "@/lib/api/reading-library";

const DEFAULT_AUTHOR_NAME = "AZW";

const COPY_ICON = (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
    <rect x="8" y="8" width="12" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CHECK_ICON = (
  <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function AzwBooksListContent() {
  const { token } = useAuth();

  const [authors, setAuthors] = useState<LibraryAuthor[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [books, setBooks] = useState<AzwBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [bookSearch, setBookSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<AzwBook | null>(null);
  const [title, setTitle] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<Set<string>>(new Set());
  const [categoryPickerKey, setCategoryPickerKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [chaptersDrawerBook, setChaptersDrawerBook] = useState<AzwBook | null>(null);
  const [chaptersDrawerAction, setChaptersDrawerAction] = useState<"add" | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
      })
      .catch(() => {});
  };

  const loadAll = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([getLibraryAuthors(token), getLibraryCategories(token), getAzwBooks(token)])
      .then(([a, c, b]) => {
        setAuthors(a);
        setCategories(c);
        setBooks(b);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load books"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const authorOptions = useMemo(
    () => authors.map((a) => ({ value: String(a.id), label: a.name, searchText: a.name })),
    [authors]
  );

  const visibleBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    return books.filter((b) => {
      if (categoryFilter && !b.category_names.includes(categoryFilter)) return false;
      if (!q) return true;
      const plainSummary = b.summary ? b.summary.replace(/<[^>]+>/g, " ") : "";
      return b.title.toLowerCase().includes(q) || plainSummary.toLowerCase().includes(q);
    });
  }, [books, categoryFilter, bookSearch]);

  const resetForm = () => {
    setTitle("");
    const defaultAuthor = authors.find(
      (a) => a.name.toLowerCase() === DEFAULT_AUTHOR_NAME.toLowerCase()
    );
    setAuthorId(defaultAuthor ? String(defaultAuthor.id) : authors[0] ? String(authors[0].id) : "");
    setSummary("");
    setSelectedCategoryNames(new Set());
    setCategoryPickerKey((k) => k + 1);
    setFormError(null);
    setEditingBook(null);
  };

  const openAddDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditDrawer = (book: AzwBook) => {
    setEditingBook(book);
    setTitle(book.title);
    setAuthorId(String(book.author_id));
    setSummary(book.summary ?? "");
    setSelectedCategoryNames(new Set(book.category_names));
    setCategoryPickerKey((k) => k + 1);
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const handleCreateAuthor = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || !token) return;
    createLibraryAuthor(token, trimmed)
      .then((a) => {
        setAuthors((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
        setAuthorId(String(a.id));
      })
      .catch((e) => setFormError(e instanceof Error ? e.message : "Could not create author"));
  };

  const handleSave = async () => {
    if (!token) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Title is required");
      return;
    }
    if (!authorId) {
      setFormError("Please select an author");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: trimmedTitle,
        author_id: authorId,
        summary: summary.trim() || null,
        category_names: [...selectedCategoryNames],
      };
      if (editingBook) {
        await updateAzwBook(token, editingBook.id, payload);
      } else {
        await createAzwBook(token, payload);
      }
      closeDrawer();
      loadAll();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save book");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (book: AzwBook) => {
    if (!token) return;
    try {
      await deleteAzwBook(token, book.id);
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete book");
    }
  };

  const openViewChapters = (book: AzwBook) => {
    setChaptersDrawerAction(null);
    setChaptersDrawerBook(book);
  };

  const openAddChapterFor = (book: AzwBook) => {
    setChaptersDrawerAction("add");
    setChaptersDrawerBook(book);
  };

  const closeChaptersDrawer = () => {
    setChaptersDrawerBook(null);
    setChaptersDrawerAction(null);
  };

  const headerActions = useMemo(
    () => [
      {
        label: loading ? "Refreshing..." : "Refresh",
        onClick: () => loadAll(),
        disabled: loading,
        icon: (
          <svg
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        ),
      },
      {
        label: "Add Book",
        onClick: openAddDrawer,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading]
  );
  usePageHeaderActions(headerActions);

  const bookSearchNode = useMemo(
    () => (
      <input
        type="search"
        value={bookSearch}
        onChange={(e) => setBookSearch(e.target.value)}
        placeholder="Search books by title or description…"
        className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:w-64"
      />
    ),
    [bookSearch]
  );
  usePageHeaderExtra(bookSearchNode);

  const categoryFilterOptions = useMemo(
    () => [
      { value: "", label: "All categories", searchText: "all" },
      ...categories.map((c) => ({ value: c.name, label: c.name, searchText: c.name })),
    ],
    [categories]
  );

  const categoryFilterNode = useMemo(
    () => (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Category</span>
        <SearchableSelect
          options={categoryFilterOptions}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(String(v))}
          placeholder="Filter by category"
          searchPlaceholder="Search categories…"
          className="w-full"
        />
      </div>
    ),
    [categoryFilterOptions, categoryFilter]
  );
  usePageHeaderMenuExtra(categoryFilterNode);

  return (
    <div className="container mx-auto px-4 pb-8 pt-6 md:px-6 md:pb-12 md:pt-8">
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading books…</p>
      ) : visibleBooks.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            {books.length === 0
              ? "No books yet. Create your first book to get started."
              : "No books match your search/filter."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBooks.map((book) => (
            <div
              key={book.id}
              className="relative flex min-h-[200px] flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="absolute right-2 top-2">
                <RowActionsMenu
                  ariaLabel={`Actions for ${book.title}`}
                  items={[
                    { label: "Edit", onClick: () => openEditDrawer(book) },
                    { label: "View chapters", onClick: () => openViewChapters(book) },
                    { label: "Add chapter", onClick: () => openAddChapterFor(book) },
                    { label: "Delete", onClick: () => void handleDeleteBook(book), danger: true },
                  ]}
                />
              </div>
              <div className="min-w-0 flex-1 pr-8">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {book.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${book.id}-title`, book.title)}
                    aria-label="Copy title"
                    title="Copy title"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    {copiedKey === `${book.id}-title` ? CHECK_ICON : COPY_ICON}
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">by {book.author_name}</p>
                {(() => {
                  const plainSummary = book.summary ? book.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
                  if (!plainSummary) return null;
                  return (
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div
                        className="prose prose-sm prose-zinc line-clamp-3 min-w-0 max-w-none text-zinc-600 dark:prose-invert dark:text-zinc-400"
                        dangerouslySetInnerHTML={{ __html: book.summary ?? "" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(`${book.id}-summary`, plainSummary)}
                        aria-label="Copy description"
                        title="Copy description"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {copiedKey === `${book.id}-summary` ? CHECK_ICON : COPY_ICON}
                      </button>
                    </div>
                  );
                })()}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {book.category_names.map((name) => (
                    <span
                      key={name}
                      className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {book.chapter_count} {book.chapter_count === 1 ? "chapter" : "chapters"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <RightDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingBook ? "Edit book" : "Add book"}
        width="2xl"
        actions={
          selectedCategoryNames.size > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {[...selectedCategoryNames].map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCategoryNames((prev) => {
                        const next = new Set(prev);
                        next.delete(name);
                        return next;
                      })
                    }
                    className="text-zinc-500 hover:text-red-600"
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Book title"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Author *</span>
              <SearchableSelect
                options={authorOptions}
                value={authorId}
                onChange={(v) => setAuthorId(String(v))}
                placeholder="Select or create author"
                searchPlaceholder="Type to search or create…"
                creatableMode="when-no-exact-match"
                onCreateNew={handleCreateAuthor}
                createNewLabel={(t) => `Create author "${t.trim()}"`}
                className="w-full"
              />
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Categories</span>
              <SearchableSelect
                key={categoryPickerKey}
                options={categories
                  .filter((c) => !selectedCategoryNames.has(c.name))
                  .map((c) => ({ value: c.name, label: c.name, searchText: c.name }))}
                value=""
                onChange={(v) => {
                  const name = String(v);
                  if (!name) return;
                  setSelectedCategoryNames((prev) => new Set([...prev, name]));
                  setCategoryPickerKey((k) => k + 1);
                }}
                placeholder="Add category…"
                searchPlaceholder="Type to search or create…"
                creatableMode="when-no-exact-match"
                onCreateNew={(term) => {
                  const trimmed = term.trim();
                  if (!trimmed) return;
                  setSelectedCategoryNames((prev) => new Set([...prev, trimmed]));
                  setCategoryPickerKey((k) => k + 1);
                }}
                createNewLabel={(t) => `Add category "${t.trim()}"`}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Brief summary</label>
            <TiptapRichTextEditor
              value={summary}
              onChange={setSummary}
              minHeight="16rem"
              aria-label="Brief summary"
            />
          </div>

          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {saving ? "Saving…" : editingBook ? "Save changes" : "Add book"}
            </button>
          </div>
        </div>
      </RightDrawer>

      <ChaptersDrawer
        book={chaptersDrawerBook}
        open={chaptersDrawerBook != null}
        onClose={closeChaptersDrawer}
        initialAction={chaptersDrawerAction}
        onChaptersChanged={loadAll}
      />
    </div>
  );
}
