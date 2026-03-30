"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { TiptapRichTextEditor } from "@/components/editor/TiptapRichTextEditor";
import "@/components/resume-builder/rich-text-editor.css";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createProductivityCategory,
  getProductivityBlogData,
} from "@/lib/api/productivity-blog";

export type BlogPostDraft = {
  id: string;
  title: string;
  bodyHtml: string;
  categoryNames: string[];
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `post-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isPostBodyEmpty(html: string): boolean {
  const t = html.trim();
  if (!t) return true;
  return /^<p>(\s|<br\s*\/?\s*>)*<\/p>$/i.test(t);
}

function IconDotsVertical() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function PostTitleMenu({
  primaryLabel,
  onPrimary,
  onDelete,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Post actions"
        onClick={() => setOpen((o) => !o)}
      >
        <IconDotsVertical />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPrimary();
              setOpen(false);
            }}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CategoryPicker({
  allCategories,
  selected,
  onChange,
  inputId,
  onCreateCategory,
}: {
  allCategories: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  inputId: string;
  onCreateCategory: (name: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const trimmed = filter.trim();
  const normalized = trimmed.toLowerCase();
  const filtered = allCategories
    .filter((c) => !selected.includes(c))
    .filter((c) => (normalized ? c.toLowerCase().includes(normalized) : true))
    .slice(0, 16);

  const exactExists = allCategories.some(
    (c) => c.toLowerCase() === normalized
  );
  const alreadySelected =
    normalized.length > 0 &&
    selected.some((c) => c.toLowerCase() === normalized);
  const canCreateNew =
    trimmed.length > 0 && !exactExists && !alreadySelected;

  const add = (name: string) => {
    if (!selected.includes(name)) onChange([...selected, name]);
    setFilter("");
    setIsOpen(true);
  };

  const createAndAdd = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    onCreateCategory(name);
    if (!selected.some((s) => s.toLowerCase() === name.toLowerCase())) {
      onChange([...selected, name]);
    }
    setFilter("");
    setIsOpen(true);
  };

  const remove = (name: string) => {
    onChange(selected.filter((x) => x !== name));
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
            >
              {c}
              <button
                type="button"
                onClick={() => remove(c)}
                className="rounded px-0.5 text-emerald-700 hover:bg-emerald-200/80 dark:text-emerald-200 dark:hover:bg-emerald-900/80"
                aria-label={`Remove ${c}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Filter and add categories
        </label>
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered.length === 1) {
                add(filtered[0]!);
              } else if (canCreateNew) {
                createAndAdd(trimmed);
              }
            }
          }}
          placeholder="Type to filter or add a category"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {isOpen && (filtered.length > 0 || canCreateNew) ? (
          <ul
            className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
            role="listbox"
          >
            {filtered.map((c) => (
              <li key={c} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(c)}
                >
                  {c}
                </button>
              </li>
            ))}
            {canCreateNew ? (
              <li role="option">
                <button
                  type="button"
                  className="w-full border-t border-zinc-200 px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-zinc-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => createAndAdd(trimmed)}
                >
                  Create &quot;{trimmed}&quot;
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

    </div>
  );
}

export function ProductivityBlogPanel() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);

  const handleCreateCategory = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setCategories((prev) =>
      prev.some((c) => c.toLowerCase() === n.toLowerCase())
        ? prev
        : [...prev, n].sort((a, b) => a.localeCompare(b))
    );
    if (!token) return;
    void createProductivityCategory(token, n)
      .then((created) => {
        setCategories((prev) =>
          prev.some((c) => c.toLowerCase() === created.name.toLowerCase())
            ? prev
            : [...prev, created.name].sort((a, b) => a.localeCompare(b))
        );
      })
      .catch(() => {});
  }, [token]);
  const [posts, setPosts] = useState<BlogPostDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostCategories, setNewPostCategories] = useState<string[]>([]);
  const [newPostBodyHtml, setNewPostBodyHtml] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void getProductivityBlogData(token)
      .then((data) => {
        if (cancelled) return;
        setCategories(data.categories.map((c) => c.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!newPostOpen) {
      setNewPostTitle("");
      setNewPostCategories([]);
      setNewPostBodyHtml("");
    }
  }, [newPostOpen]);

  const syncFormFromPost = useCallback((p: BlogPostDraft | null) => {
    if (!p) {
      setTitle("");
      setBodyHtml("");
      setSelectedCategories([]);
      return;
    }
    setTitle(p.title);
    setBodyHtml(p.bodyHtml);
    setSelectedCategories([...p.categoryNames]);
  }, []);

  const openNewPostDialog = () => {
    setNewPostTitle("");
    setNewPostCategories([]);
    setNewPostBodyHtml("");
    setNewPostOpen(true);
  };

  const confirmNewPost = () => {
    const id = newId();
    const body = newPostBodyHtml;
    const post: BlogPostDraft = {
      id,
      title: newPostTitle.trim() || "Untitled",
      bodyHtml: body,
      categoryNames: [...newPostCategories],
    };
    setPosts((prev) => [post, ...prev]);
    setSelectedId(id);
    setIsEditingPost(false);
    syncFormFromPost(post);
    setNewPostOpen(false);
  };

  const saveCurrentToState = () => {
    if (!selectedId) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? {
              ...p,
              title: title.trim() || "Untitled",
              bodyHtml,
              categoryNames: [...selectedCategories],
            }
          : p
      )
    );
  };

  const selectPost = (id: string) => {
    saveCurrentToState();
    const p = posts.find((x) => x.id === id);
    setSelectedId(id);
    setIsEditingPost(false);
    syncFormFromPost(p ?? null);
  };

  const deletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setIsEditingPost(false);
      syncFormFromPost(null);
    }
  };

  const exitEditToPreview = () => {
    saveCurrentToState();
    setIsEditingPost(false);
  };

  const confirmDeletePost = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this post?")) {
      return;
    }
    deletePost(id);
  };

  return (
    <div className="flex min-h-0 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="w-full shrink-0 lg:max-w-xs">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Posts
          </h2>
          <button
            type="button"
            onClick={openNewPostDialog}
            className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white dark:bg-emerald-600"
          >
            New post
          </button>
          <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
            {posts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectPost(p.id)}
                  className={`w-full truncate rounded-lg px-2 py-2 text-left text-sm font-medium ${
                    selectedId === p.id
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {p.title || "Untitled"}
                </button>
              </li>
            ))}
          </ul>
          {posts.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              No posts yet. Create one locally; backend sync comes later.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        {selectedId ? (
          isEditingPost ? (
            <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Edit post
                </h2>
                <PostTitleMenu
                  primaryLabel="Preview"
                  onPrimary={exitEditToPreview}
                  onDelete={() => {
                    if (selectedId) confirmDeletePost(selectedId);
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="blog-post-title"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Title
                </label>
                <input
                  id="blog-post-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveCurrentToState}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Categories for this post
                </span>
                <div className="mt-2">
                  <CategoryPicker
                    allCategories={categories}
                    selected={selectedCategories}
                    onChange={(next) => {
                      setSelectedCategories(next);
                      if (selectedId) {
                        setPosts((prev) =>
                          prev.map((p) =>
                            p.id === selectedId
                              ? { ...p, categoryNames: [...next] }
                              : p
                          )
                        );
                      }
                    }}
                    inputId="blog-post-category-filter"
                    onCreateCategory={handleCreateCategory}
                  />
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Body
                </span>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Rich text is stored as HTML in the browser for now.
                </p>
                <div className="mt-2">
                  <TiptapRichTextEditor
                    value={bodyHtml}
                    onChange={(html) => {
                      setBodyHtml(html);
                      if (selectedId) {
                        setPosts((prev) =>
                          prev.map((p) =>
                            p.id === selectedId ? { ...p, bodyHtml: html } : p
                          )
                        );
                      }
                    }}
                    placeholder="Write your post…"
                    minHeight="16rem"
                    aria-label="Post body"
                  />
                </div>
              </div>
            </section>
          ) : (
            <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <header className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {title.trim() || "Untitled"}
                </h1>
                <PostTitleMenu
                  primaryLabel="Edit"
                  onPrimary={() => setIsEditingPost(true)}
                  onDelete={() => {
                    if (selectedId) confirmDeletePost(selectedId);
                  }}
                />
              </header>

              {isPostBodyEmpty(bodyHtml) ? (
                <p className="mt-6 text-sm italic text-zinc-400 dark:text-zinc-500">
                  No content yet.
                </p>
              ) : (
                <div
                  className="resume-rich-editor blog-post-preview prose prose-zinc mt-6 max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-emerald-700 dark:prose-a:text-emerald-400"
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              )}

              <footer className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Labels
                </p>
                {selectedCategories.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCategories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                    No labels
                  </p>
                )}
              </footer>
            </article>
          )
        ) : null}
      </div>

      <Dialog
        isOpen={newPostOpen}
        onClose={() => setNewPostOpen(false)}
        title="New post"
        size="xl"
      >
        <div className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="dialog-new-post-title"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Title
            </label>
            <input
              id="dialog-new-post-title"
              type="text"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Untitled"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Categories
            </span>
            <div className="mt-2">
              <CategoryPicker
                allCategories={categories}
                selected={newPostCategories}
                onChange={setNewPostCategories}
                inputId="dialog-new-post-category-filter"
                onCreateCategory={handleCreateCategory}
              />
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Body
            </span>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Rich text is stored as HTML in the browser for now.
            </p>
            <div className="mt-2">
              <TiptapRichTextEditor
                value={newPostBodyHtml}
                onChange={setNewPostBodyHtml}
                placeholder="Write your post…"
                minHeight="min(22rem, 45vh)"
                aria-label="New post body"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setNewPostOpen(false)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmNewPost}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white dark:bg-emerald-600"
            >
              Create post
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
