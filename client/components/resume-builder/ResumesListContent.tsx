"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  resumeListDisplayName,
  resumeListSecondaryLine,
} from "@/lib/resume-builder-display";
import { deleteResumeDocument, listResumeDocuments } from "@/lib/api/resumes";
import { useAuth } from "@/lib/hooks/use-auth";
import { mergeRemoteAndLocal } from "@/lib/resume-remote-merge";
import {
  NEW_RESUME_SESSION_KEY,
  defaultNamedDocument,
  duplicateNamedDocument,
  loadResumeBuilderState,
  saveResumeBuilderState,
  type NamedResumeDocument,
} from "@/lib/resume-builder-storage";

function formatListDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(t);
}

function closeDetailsMenu(el: EventTarget | null) {
  if (el instanceof HTMLElement) {
    el.closest("details")?.removeAttribute("open");
  }
}

export function ResumesListContent() {
  const router = useRouter();
  const { token, user } = useAuth();
  const isAdmin = user?.groups?.includes("admin") ?? false;
  const [documents, setDocuments] = useState(() => loadResumeBuilderState().documents);

  const refreshFromStorage = useCallback(() => {
    setDocuments(loadResumeBuilderState().documents);
  }, []);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(NEW_RESUME_SESSION_KEY);
    }
    refreshFromStorage();
  }, [refreshFromStorage]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await listResumeDocuments(token);
        if (cancelled) return;
        const local = loadResumeBuilderState();
        const next = mergeRemoteAndLocal(remote, local);
        saveResumeBuilderState(next);
        setDocuments(next.documents);
      } catch {
        if (!cancelled) refreshFromStorage();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin, refreshFromStorage]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      document.querySelectorAll("details[data-resume-row-menu]").forEach((node) => {
        if (!(node instanceof HTMLDetailsElement)) return;
        if (!node.open) return;
        if (node.contains(target)) return;
        node.open = false;
      });
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const duplicateDocument = useCallback(
    (doc: NamedResumeDocument) => {
      const s = loadResumeBuilderState();
      const copy = duplicateNamedDocument(doc);
      const next = {
        ...s,
        documents: [...s.documents, copy],
        activeDocumentId: copy.id,
      };
      saveResumeBuilderState(next);
      refreshFromStorage();
      router.push(`/developer-growth/resumes/${copy.id}/edit`);
    },
    [refreshFromStorage, router]
  );

  const deleteDocument = useCallback(
    async (id: string, el: EventTarget | null) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Delete this resume (and its cover letter) from your list? This cannot be undone."
        )
      ) {
        return;
      }
      closeDetailsMenu(el);
      if (token && isAdmin) {
        try {
          await deleteResumeDocument(token, id);
        } catch {
          /* still remove locally */
        }
      }
      const s = loadResumeBuilderState();
      const remaining = s.documents.filter((d) => d.id !== id);
      const nextDocs =
        remaining.length > 0 ? remaining : [defaultNamedDocument()];
      let activeId = s.activeDocumentId;
      if (!nextDocs.some((d) => d.id === activeId)) {
        activeId = nextDocs[0].id;
      }
      const next = { ...s, documents: nextDocs, activeDocumentId: activeId };
      saveResumeBuilderState(next);
      refreshFromStorage();
    },
    [refreshFromStorage, token, isAdmin]
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Stored in this browser. Admins signed in also sync resumes to the server.
          </p>
        </div>
        <Link
          href="/developer-growth/resumes/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          New resume
        </Link>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No resumes yet.</p>
      ) : (
        <ul
          className="flex flex-wrap gap-x-10 gap-y-8"
          role="list"
        >
          {documents.map((d) => {
            const title = resumeListDisplayName(d);
            const sub = resumeListSecondaryLine(d);
            const editHref = `/developer-growth/resumes/${d.id}/edit`;
            return (
              <li key={d.id} className="w-[min(100%,20rem)] shrink-0">
                <div className="flex items-stretch gap-2 rounded-lg border border-zinc-200 bg-white py-1 pl-3 pr-1 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 py-0">
                    <span className="truncate text-sm font-medium leading-[1.2] text-zinc-900 dark:text-zinc-100">
                      {title}
                    </span>
                    {sub ? (
                      <span className="line-clamp-1 text-xs leading-[1.2] text-zinc-500 dark:text-zinc-400">
                        {sub}
                      </span>
                    ) : null}
                    <span className="mt-px flex flex-wrap gap-x-3 gap-y-0 text-[11px] leading-[1.15] text-zinc-400 dark:text-zinc-500">
                      <span>Created {formatListDate(d.createdAt)}</span>
                      <span>Updated {formatListDate(d.updatedAt)}</span>
                    </span>
                  </div>

                  <details className="relative shrink-0 self-center" data-resume-row-menu>
                    <summary
                      className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden"
                      aria-label={`Actions for ${title}`}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        ⋮
                      </span>
                    </summary>
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-30 mt-1 min-w-38 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <Link
                        role="menuitem"
                        href={editHref}
                        className="block px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        onClick={(e) => closeDetailsMenu(e.currentTarget)}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full px-3 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        onClick={(e) => {
                          duplicateDocument(d);
                          closeDetailsMenu(e.currentTarget);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full px-3 py-1.5 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={(e) => void deleteDocument(d.id, e.currentTarget)}
                      >
                        Delete
                      </button>
                    </div>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm">
        <Link
          href="/developer-growth"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to Developer Growth
        </Link>
      </p>
    </div>
  );
}
