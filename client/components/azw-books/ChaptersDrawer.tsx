"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RightDrawer } from "@/components/RightDrawer";
import { TiptapRichTextEditor } from "@/components/editor/TiptapRichTextEditor";
import { RowActionsMenu } from "./RowActionsMenu";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createAzwBookChapter,
  deleteAzwBookChapter,
  getAzwBookChapters,
  updateAzwBookChapter,
  type AzwBook,
  type AzwBookChapter,
} from "@/lib/api/azw-books";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getPreview(html: string, maxLen = 140): string {
  const text = stripHtml(html);
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "…";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Downloads the book as a PDF via the browser's native print-to-PDF (choose
 * "Save as PDF" in the print dialog) — there's no HTML-rendering PDF library
 * in this project (pdf-lib only manipulates existing PDF bytes/pages), so this
 * is the standard no-new-dependency way to get a real, correctly formatted
 * PDF out of rich-text HTML content.
 */
function downloadBook(book: AzwBook, chapters: AzwBookChapter[]) {
  const chaptersHtml = chapters
    .map((c) => `<h2>${escapeHtml(c.title)}</h2>\n${c.content || ""}`)
    .join("\n");
  const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(book.title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.6; padding: 2rem; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.3rem; margin-top: 2rem; page-break-before: always; }
  h2:first-of-type { page-break-before: avoid; }
  img { max-width: 100%; }
</style>
</head>
<body>
<h1>${escapeHtml(book.title)}</h1>
${book.summary ? `<div>${book.summary}</div>` : ""}
${chaptersHtml}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.focus();
    win.print();
    setTimeout(cleanup, 1000);
  };

  iframe.srcdoc = doc;
  document.body.appendChild(iframe);
}

const COPY_ICON = (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
    <rect x="8" y="8" width="12" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type Props = {
  book: AzwBook | null;
  open: boolean;
  onClose: () => void;
  /** When set, auto-opens the add-chapter sub-drawer as soon as this drawer opens. */
  initialAction?: "add" | null;
  onChaptersChanged?: () => void;
};

export function ChaptersDrawer({ book, open, onClose, initialAction, onChaptersChanged }: Props) {
  const { token } = useAuth();

  const [chapters, setChapters] = useState<AzwBookChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<AzwBookChapter | null>(null);
  const [chapterContent, setChapterContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadChapters = useCallback(() => {
    if (!token || !book) return;
    setLoading(true);
    setError(null);
    getAzwBookChapters(token, book.id)
      .then(setChapters)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load chapters"))
      .finally(() => setLoading(false));
  }, [token, book]);

  useEffect(() => {
    if (open && book) {
      setSearch("");
      loadChapters();
    }
  }, [open, book, loadChapters]);

  useEffect(() => {
    if (open && initialAction === "add") {
      openAddForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAction]);

  const visibleChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(q) || stripHtml(chapter.content).toLowerCase().includes(q)
    );
  }, [chapters, search]);

  const nextChapterNumber = useMemo(() => {
    if (chapters.length === 0) return 1;
    return Math.max(...chapters.map((c) => c.order_index)) + 1;
  }, [chapters]);

  const openAddForm = () => {
    setEditingChapter(null);
    setChapterContent("");
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (chapter: AzwBookChapter) => {
    setEditingChapter(chapter);
    setChapterContent(chapter.content);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingChapter(null);
  };

  const handleSaveChapter = async () => {
    if (!token || !book) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingChapter) {
        await updateAzwBookChapter(token, editingChapter.id, { content: chapterContent });
      } else {
        await createAzwBookChapter(token, book.id, { content: chapterContent });
      }
      closeForm();
      loadChapters();
      onChaptersChanged?.();
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
      onChaptersChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete chapter");
    }
  };

  const handleToggleCopied = async (chapter: AzwBookChapter) => {
    if (!token) return;
    const nextCopied = !chapter.is_copied;
    setChapters((prev) => prev.map((c) => (c.id === chapter.id ? { ...c, is_copied: nextCopied } : c)));
    try {
      await updateAzwBookChapter(token, chapter.id, { is_copied: nextCopied });
    } catch (e) {
      setChapters((prev) => prev.map((c) => (c.id === chapter.id ? { ...c, is_copied: !nextCopied } : c)));
      setError(e instanceof Error ? e.message : "Could not update chapter");
    }
  };

  return (
    <>
      <RightDrawer
        open={open}
        onClose={onClose}
        title={book ? `Chapters — ${book.title}` : "Chapters"}
        width="3xl"
        actions={
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chapters by name or text…"
              className="w-full min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => book && downloadBook(book, chapters)}
              disabled={!book || chapters.length === 0}
              title="Opens the print dialog — choose &quot;Save as PDF&quot;"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              + Add chapter
            </button>
          </>
        }
      >
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading chapters…</p>
        ) : visibleChapters.length === 0 ? (
          <p className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
            {chapters.length === 0
              ? "No chapters yet."
              : `No chapters match "${search.trim()}".`}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleChapters.map((chapter) => (
              <li
                key={chapter.id}
                className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <button
                  type="button"
                  onClick={() => openEditForm(chapter)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={`truncate font-medium ${
                      chapter.is_copied
                        ? "text-zinc-400 line-through dark:text-zinc-500"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {chapter.title}
                  </p>
                  {getPreview(chapter.content) && (
                    <p
                      className={`mt-0.5 truncate text-xs ${
                        chapter.is_copied
                          ? "text-zinc-400 line-through dark:text-zinc-600"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {getPreview(chapter.content)}
                    </p>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleCopied(chapter)}
                  aria-pressed={chapter.is_copied}
                  aria-label={chapter.is_copied ? "Reset copied" : "Mark as copied"}
                  title={chapter.is_copied ? "Reset copied" : "Mark as copied"}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    chapter.is_copied
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {COPY_ICON}
                </button>
                <RowActionsMenu
                  ariaLabel={`Actions for ${chapter.title}`}
                  items={[
                    { label: "Edit", onClick: () => openEditForm(chapter) },
                    { label: "Delete", onClick: () => void handleDeleteChapter(chapter), danger: true },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </RightDrawer>

      <RightDrawer
        open={formOpen}
        onClose={closeForm}
        title={editingChapter ? editingChapter.title : `Add Chapter ${nextChapterNumber}`}
        width="3xl"
        stackLevel={1}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Content
            </label>
            <TiptapRichTextEditor
              value={chapterContent}
              onChange={setChapterContent}
              minHeight="28rem"
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
              onClick={closeForm}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveChapter()}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {saving ? "Saving…" : editingChapter ? "Save changes" : "Add chapter"}
            </button>
          </div>
        </div>
      </RightDrawer>
    </>
  );
}
