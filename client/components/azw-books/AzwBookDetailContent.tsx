"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RightDrawer } from "@/components/RightDrawer";
import { DropdownMenu } from "@/components/DropdownMenu";
import { TiptapRichTextEditor } from "@/components/editor/TiptapRichTextEditor";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createAzwBookChapter,
  deleteAzwBookChapter,
  getAzwBook,
  getAzwBookChapters,
  updateAzwBookChapter,
  type AzwBook,
  type AzwBookChapter,
} from "@/lib/api/azw-books";

export function AzwBookDetailContent({ bookId }: { bookId: number }) {
  const { token } = useAuth();

  const [book, setBook] = useState<AzwBook | null>(null);
  const [chapters, setChapters] = useState<AzwBookChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<AzwBookChapter | null>(null);
  const [chapterContent, setChapterContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([getAzwBook(token, bookId), getAzwBookChapters(token, bookId)])
      .then(([b, c]) => {
        setBook(b);
        setChapters(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load book"))
      .finally(() => setLoading(false));
  }, [token, bookId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openAddDrawer = () => {
    setEditingChapter(null);
    setChapterContent("");
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (chapter: AzwBookChapter) => {
    setEditingChapter(chapter);
    setChapterContent(chapter.content);
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingChapter(null);
    setChapterContent("");
    setFormError(null);
  };

  const nextChapterNumber = chapters.length === 0 ? 1 : Math.max(...chapters.map((c) => c.order_index)) + 1;

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingChapter) {
        await updateAzwBookChapter(token, editingChapter.id, { content: chapterContent });
      } else {
        await createAzwBookChapter(token, bookId, { content: chapterContent });
      }
      closeDrawer();
      loadAll();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save chapter");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChapter = async (chapter: AzwBookChapter) => {
    if (!token) return;
    try {
      await deleteAzwBookChapter(token, chapter.id);
      setChapters((prev) => prev.filter((c) => c.id !== chapter.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete chapter");
    }
  };

  return (
    <div className="container mx-auto px-4 pb-8 pt-6 md:px-6 md:pb-12 md:pt-8">
      <Link
        href="/personal-growth/books"
        className="mb-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to books
      </Link>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading book…</p>
      ) : book ? (
        <>
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{book.title}</h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">by {book.author_name}</p>
              </div>
              <button
                type="button"
                onClick={openAddDrawer}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                + Add Chapter
              </button>
            </div>
            {book.summary && book.summary.replace(/<[^>]+>/g, "").trim() && (
              <div
                className="prose prose-sm prose-zinc mt-3 max-w-none text-zinc-600 dark:prose-invert dark:text-zinc-400"
                dangerouslySetInnerHTML={{ __html: book.summary }}
              />
            )}
            {book.category_names.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {book.category_names.map((name) => (
                  <span
                    key={name}
                    className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Chapters ({chapters.length})
          </h2>
          {chapters.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-600 dark:text-zinc-400">
                No chapters yet. Add your first chapter to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="relative flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() => openEditDrawer(chapter)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                      {chapter.title}
                    </h3>
                  </button>
                  <DropdownMenu
                    items={[
                      { label: "Edit", onClick: () => openEditDrawer(chapter) },
                      { label: "Delete", onClick: () => void handleDeleteChapter(chapter), danger: true },
                    ]}
                    menuButtonAriaLabel={`Actions for ${chapter.title}`}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      <RightDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingChapter ? editingChapter.title : `Add Chapter ${nextChapterNumber}`}
        width="lg"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Content
            </label>
            <TiptapRichTextEditor
              value={chapterContent}
              onChange={setChapterContent}
              minHeight="16rem"
              aria-label="Chapter content"
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
              {saving ? "Saving…" : editingChapter ? "Save changes" : "Add chapter"}
            </button>
          </div>
        </div>
      </RightDrawer>
    </div>
  );
}
