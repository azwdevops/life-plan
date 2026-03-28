"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { DropdownMenu } from "@/components/DropdownMenu";
import { RichTextEditor } from "./RichTextEditor";
import "./print-preview.css";
import {
  CoverLetterPreview,
  FieldLabel,
  ResumePreview,
  SectionTitle,
} from "./resume-builder-ui-parts";
import {
  deleteResumeDocument,
  getResumeDocument,
  putResumeDocument,
} from "@/lib/api/resumes";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  type CoverLetterData,
  type EducationEntry,
  type ResumeBuilderState,
  type ResumeData,
  type WorkExperienceEntry,
  defaultEducationEntry,
  defaultNamedDocument,
  defaultResumeBuilderState,
  defaultWorkEntry,
  duplicateNamedDocument,
  loadResumeBuilderState,
  saveResumeBuilderState,
} from "@/lib/resume-builder-storage";

export function ResumeCoverLetterEditor({
  documentId,
  resumeNameHeaderContainer = null,
}: {
  documentId: string;
  /** When set, the list-only resume name field is rendered here (e.g. next to “Edit resume” in the app header). */
  resumeNameHeaderContainer?: HTMLElement | null;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const isAdmin = user?.groups?.includes("admin") ?? false;
  const [state, setState] = useState<ResumeBuilderState>(() =>
    defaultResumeBuilderState()
  );
  const [hydrated, setHydrated] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const s = loadResumeBuilderState();
    if (!s.documents.some((d) => d.id === documentId)) {
      router.replace("/developer-growth/resumes");
      return;
    }
    setState({ ...s, activeDocumentId: documentId });
    setHydrated(true);
  }, [documentId, router]);

  useEffect(() => {
    if (!hydrated || !token || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await getResumeDocument(token, documentId);
        if (cancelled) return;
        setState((prev) => {
          const local = prev.documents.find((d) => d.id === documentId);
          if (
            local?.updatedAt &&
            doc.updatedAt &&
            doc.updatedAt <= local.updatedAt
          ) {
            return prev;
          }
          const next: ResumeBuilderState = {
            ...prev,
            documents: prev.documents.map((d) =>
              d.id === documentId ? doc : d
            ),
          };
          saveResumeBuilderState(next);
          return next;
        });
      } catch {
        /* keep local copy */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, documentId, token, isAdmin]);

  useEffect(() => {
    const savedTitleRef = { current: "" };
    const onBeforePrint = () => {
      savedTitleRef.current = document.title;
      document.title = "\u200B";
    };
    const onAfterPrint = () => {
      document.title = savedTitleRef.current || document.title;
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      if (document.title === "\u200B" && savedTitleRef.current !== "") {
        document.title = savedTitleRef.current;
      }
    };
  }, []);

  const activeNamed = state.documents.find((d) => d.id === documentId);
  const resume = activeNamed?.resume ?? state.documents[0].resume;
  const coverLetter = activeNamed?.coverLetter ?? state.documents[0].coverLetter;
  const { activeDoc } = state;

  const updateResume = useCallback((patch: Partial<ResumeData>) => {
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) =>
        d.id === documentId
          ? { ...d, resume: { ...d.resume, ...patch } }
          : d
      ),
    }));
  }, [documentId]);

  const updateLetter = useCallback((patch: Partial<CoverLetterData>) => {
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) =>
        d.id === documentId
          ? { ...d, coverLetter: { ...d.coverLetter, ...patch } }
          : d
      ),
    }));
  }, [documentId]);

  const setEducation = useCallback((list: EducationEntry[]) => {
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) =>
        d.id === documentId ? { ...d, resume: { ...d.resume, education: list } } : d
      ),
    }));
  }, [documentId]);

  const setWork = useCallback((list: WorkExperienceEntry[]) => {
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) =>
        d.id === documentId
          ? { ...d, resume: { ...d.resume, workExperience: list } }
          : d
      ),
    }));
  }, [documentId]);

  const handleSaveClick = useCallback(async () => {
    const now = new Date().toISOString();
    const next: ResumeBuilderState = {
      ...state,
      documents: state.documents.map((d) =>
        d.id === documentId
          ? {
              ...d,
              updatedAt: now,
              createdAt: d.createdAt || now,
            }
          : d
      ),
    };
    saveResumeBuilderState(next);
    setState(next);
    const doc = next.documents.find((d) => d.id === documentId);
    let message = "Saved to this browser";
    if (doc && token && isAdmin) {
      try {
        await putResumeDocument(token, doc);
        message = "Saved to this browser and server";
      } catch {
        message = "Saved locally; could not sync to server";
      }
    }
    setSaveMessage(message);
    window.setTimeout(() => setSaveMessage(null), 2500);
  }, [state, documentId, token, isAdmin]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "resume-documents-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [state]);

  const duplicateActive = useCallback(() => {
    const cur = state.documents.find((d) => d.id === documentId);
    if (!cur) return;
    const copy = duplicateNamedDocument(cur);
    const next: ResumeBuilderState = {
      ...state,
      documents: [...state.documents, copy],
      activeDocumentId: copy.id,
    };
    setState(next);
    saveResumeBuilderState(next);
    router.push(`/developer-growth/resumes/${copy.id}/edit`);
  }, [state, documentId, router]);

  const deleteActive = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Delete this resume (and its cover letter) from your list? Unsaved changes are included; click Save first if you want them stored."
      )
    ) {
      return;
    }
    if (token && isAdmin) {
      try {
        await deleteResumeDocument(token, documentId);
      } catch {
        /* still remove locally */
      }
    }
    const remaining = state.documents.filter((d) => d.id !== documentId);
    const nextDocs =
      remaining.length > 0 ? remaining : [defaultNamedDocument()];
    const next: ResumeBuilderState = {
      ...state,
      documents: nextDocs,
      activeDocumentId: nextDocs[0].id,
    };
    saveResumeBuilderState(next);
    router.push("/developer-growth/resumes");
  }, [state, documentId, router, token, isAdmin]);

  const setActiveDocumentName = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) =>
        d.id === documentId ? { ...d, name } : d
      ),
    }));
  }, [documentId]);

  const editorMenuItems = useMemo(
    () => [
      { label: "Duplicate", onClick: () => duplicateActive() },
      {
        label: "Delete",
        onClick: () => void deleteActive(),
        danger: true,
      },
      { label: "Save", onClick: () => void handleSaveClick() },
      {
        label: "Print / PDF",
        onClick: () => window.print(),
        title:
          "In the print dialog, disable Headers and footers to remove the URL, date, and page title from the margins.",
      },
      { label: "Export JSON", onClick: () => exportJson() },
    ],
    [duplicateActive, deleteActive, handleSaveClick, exportJson]
  );

  const docToggle = (
    <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-600">
      <button
        type="button"
        onClick={() => setState((s) => ({ ...s, activeDoc: "resume" as const }))}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          state.activeDoc === "resume"
            ? "bg-blue-600 text-white dark:bg-blue-500"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        Resume
      </button>
      <button
        type="button"
        onClick={() =>
          setState((s) => ({ ...s, activeDoc: "coverLetter" as const }))
        }
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          state.activeDoc === "coverLetter"
            ? "bg-blue-600 text-white dark:bg-blue-500"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        Cover letter
      </button>
    </div>
  );

  const onResumeNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setActiveDocumentName(e.target.value),
    [setActiveDocumentName]
  );

  const resumeNameInputHeaderClass =
    "min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold text-zinc-900 shadow-sm outline-none placeholder:font-normal placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-500 dark:focus:ring-blue-500";

  const resumeNameInputToolbarClass =
    "min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-base font-semibold text-zinc-900 outline-none transition-colors placeholder:font-normal placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 sm:text-lg";

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        Loading editor…
      </div>
    );
  }

  const resumeHeaderToolbarPortal =
    resumeNameHeaderContainer != null ? (
      createPortal(
        <div className="inline-flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2">
          <input
            type="text"
            value={activeNamed?.name ?? ""}
            onChange={onResumeNameChange}
            className={`${resumeNameInputHeaderClass} w-44 shrink-0 sm:w-56`}
            placeholder="List name"
            aria-label="Resume name shown in your resume list"
          />
          <DropdownMenu
            menuButtonAriaLabel="Resume actions"
            className="shrink-0"
            overlayOnBody
            items={editorMenuItems}
          />
          {saveMessage ? (
            <span
              className="hidden max-w-[7rem] truncate text-xs font-medium text-emerald-600 sm:inline md:max-w-[12rem] dark:text-emerald-400"
              title={saveMessage}
            >
              {saveMessage}
            </span>
          ) : null}
        </div>,
        resumeNameHeaderContainer
      )
    ) : null;

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 md:py-8 print:max-w-none print:px-0 print:py-0">
      {resumeHeaderToolbarPortal}
      <div className="mb-6 space-y-4" data-resume-no-print>
        <div>
          <Link
            href="/developer-growth/resumes"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            ← All resumes
          </Link>
          {resumeNameHeaderContainer != null && saveMessage ? (
            <p className="mt-2 text-sm font-medium text-emerald-600 sm:hidden dark:text-emerald-400">
              {saveMessage}
            </p>
          ) : null}
        </div>

        {resumeNameHeaderContainer == null ? (
          <header className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:gap-4">
            <input
              type="text"
              value={activeNamed?.name ?? ""}
              onChange={onResumeNameChange}
              className={resumeNameInputToolbarClass}
              placeholder="Resume name (list only)"
              aria-label="Resume name shown in your resume list"
            />
            <div className="flex shrink-0 items-center justify-end gap-3 sm:ml-auto sm:justify-start">
              {saveMessage ? (
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {saveMessage}
                </span>
              ) : null}
              <DropdownMenu
                menuButtonAriaLabel="Resume actions"
                items={editorMenuItems}
              />
            </div>
          </header>
        ) : null}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          This name appears on the resumes list only; it is not printed on the PDF unless
          you add it in the body.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Edits stay in this page until you use Save in the menu (localStorage in this
            browser).
          </p>
          <div className="flex flex-wrap items-center gap-2">{docToggle}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[1.05fr_0.95fr] print:grid-cols-1 print:gap-0">
        <div
          key={`${documentId}-${activeDoc}`}
          className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          data-resume-no-print
        >
          {activeDoc === "resume" ? (
            <>
              <div>
                <SectionTitle>Introduction</SectionTitle>
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Full name</FieldLabel>
                    <input
                      type="text"
                      value={resume.fullName}
                      onChange={(e) => updateResume({ fullName: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <FieldLabel>Professional headline</FieldLabel>
                    <input
                      type="text"
                      value={resume.headline}
                      onChange={(e) => updateResume({ headline: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="Senior Software Engineer"
                    />
                  </div>
                  <div>
                    <FieldLabel>Contact (email, phone, links)</FieldLabel>
                    <RichTextEditor
                      value={resume.contactHtml}
                      onChange={(html) => updateResume({ contactHtml: html })}
                      placeholder="you@email.com · +1 … · linkedin.com/in/…"
                      aria-label="Contact details"
                    />
                  </div>
                  <div>
                    <FieldLabel>Professional summary</FieldLabel>
                    <RichTextEditor
                      value={resume.summaryHtml}
                      onChange={(html) => updateResume({ summaryHtml: html })}
                      placeholder="Brief overview of your strengths and focus areas."
                      minHeight="8rem"
                      aria-label="Professional summary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <SectionTitle>Work experience</SectionTitle>
                <div className="space-y-4">
                  {resume.workExperience.map((job, index) => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/40"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500">
                          Role {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setWork(
                              resume.workExperience.filter((w) => w.id !== job.id)
                            )
                          }
                          disabled={resume.workExperience.length <= 1}
                          className="text-xs font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <FieldLabel>Job title</FieldLabel>
                          <input
                            type="text"
                            value={job.title}
                            onChange={(e) =>
                              setWork(
                                resume.workExperience.map((x) =>
                                  x.id === job.id
                                    ? { ...x, title: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <FieldLabel>Company</FieldLabel>
                          <input
                            type="text"
                            value={job.company}
                            onChange={(e) =>
                              setWork(
                                resume.workExperience.map((x) =>
                                  x.id === job.id
                                    ? { ...x, company: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <FieldLabel>Location</FieldLabel>
                          <input
                            type="text"
                            value={job.location}
                            onChange={(e) =>
                              setWork(
                                resume.workExperience.map((x) =>
                                  x.id === job.id
                                    ? { ...x, location: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <FieldLabel>Start</FieldLabel>
                          <input
                            type="text"
                            value={job.startDate}
                            onChange={(e) =>
                              setWork(
                                resume.workExperience.map((x) =>
                                  x.id === job.id
                                    ? { ...x, startDate: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="Jan 2021"
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <FieldLabel>End</FieldLabel>
                          <input
                            type="text"
                            value={job.endDate}
                            onChange={(e) =>
                              setWork(
                                resume.workExperience.map((x) =>
                                  x.id === job.id
                                    ? { ...x, endDate: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="Present"
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <FieldLabel>Impact & responsibilities (rich text)</FieldLabel>
                          <RichTextEditor
                            value={job.descriptionHtml}
                            onChange={(html) =>
                              setWork(
                                resume.workExperience.map((x) =>
                                  x.id === job.id
                                    ? { ...x, descriptionHtml: html }
                                    : x
                                )
                              )
                            }
                            placeholder="Use bullets for achievements with metrics where possible."
                            minHeight="8rem"
                            aria-label={`Job description ${index + 1}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setWork([...resume.workExperience, defaultWorkEntry()])
                    }
                    className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-sm font-medium text-zinc-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
                  >
                    + Add work experience
                  </button>
                </div>
              </div>

              <div>
                <SectionTitle>Education</SectionTitle>
                <div className="space-y-4">
                  {resume.education.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/40"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500">
                          Entry {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEducation(
                              resume.education.filter((e) => e.id !== entry.id)
                            )
                          }
                          disabled={resume.education.length <= 1}
                          className="text-xs font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <FieldLabel>Institution</FieldLabel>
                          <input
                            type="text"
                            value={entry.institution}
                            onChange={(e) =>
                              setEducation(
                                resume.education.map((x) =>
                                  x.id === entry.id
                                    ? { ...x, institution: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <FieldLabel>Degree / qualification</FieldLabel>
                          <input
                            type="text"
                            value={entry.degree}
                            onChange={(e) =>
                              setEducation(
                                resume.education.map((x) =>
                                  x.id === entry.id
                                    ? { ...x, degree: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <FieldLabel>Field of study</FieldLabel>
                          <input
                            type="text"
                            value={entry.field}
                            onChange={(e) =>
                              setEducation(
                                resume.education.map((x) =>
                                  x.id === entry.id
                                    ? { ...x, field: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <FieldLabel>Start</FieldLabel>
                          <input
                            type="text"
                            value={entry.startDate}
                            onChange={(e) =>
                              setEducation(
                                resume.education.map((x) =>
                                  x.id === entry.id
                                    ? { ...x, startDate: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="2018"
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <FieldLabel>End</FieldLabel>
                          <input
                            type="text"
                            value={entry.endDate}
                            onChange={(e) =>
                              setEducation(
                                resume.education.map((x) =>
                                  x.id === entry.id
                                    ? { ...x, endDate: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="2022"
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <FieldLabel>Honors, coursework, GPA (rich text)</FieldLabel>
                          <RichTextEditor
                            value={entry.detailsHtml}
                            onChange={(html) =>
                              setEducation(
                                resume.education.map((x) =>
                                  x.id === entry.id ? { ...x, detailsHtml: html } : x
                                )
                              )
                            }
                            placeholder="Dean's list, relevant courses…"
                            minHeight="5rem"
                            aria-label={`Education details ${index + 1}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setEducation([...resume.education, defaultEducationEntry()])
                    }
                    className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-sm font-medium text-zinc-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
                  >
                    + Add education
                  </button>
                </div>
              </div>

              <div>
                <SectionTitle>Skills</SectionTitle>
                <RichTextEditor
                  value={resume.skillsHtml}
                  onChange={(html) => updateResume({ skillsHtml: html })}
                  placeholder="Group by category or list technical and soft skills."
                  minHeight="6rem"
                  aria-label="Skills"
                />
              </div>

              <div>
                <SectionTitle>Projects</SectionTitle>
                <RichTextEditor
                  value={resume.projectsHtml}
                  onChange={(html) => updateResume({ projectsHtml: html })}
                  placeholder="Notable projects, links, stack…"
                  minHeight="6rem"
                  aria-label="Projects"
                />
              </div>

              <div>
                <SectionTitle>Certifications</SectionTitle>
                <RichTextEditor
                  value={resume.certificationsHtml}
                  onChange={(html) => updateResume({ certificationsHtml: html })}
                  placeholder="Credentials, issuer, year…"
                  minHeight="5rem"
                  aria-label="Certifications"
                />
              </div>

              <div>
                <SectionTitle>Additional</SectionTitle>
                <RichTextEditor
                  value={resume.additionalHtml}
                  onChange={(html) => updateResume({ additionalHtml: html })}
                  placeholder="Languages, volunteering, publications…"
                  minHeight="5rem"
                  aria-label="Additional information"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <SectionTitle>Cover letter</SectionTitle>
                <div className="space-y-4">
                  <div>
                    <FieldLabel>Date line</FieldLabel>
                    <input
                      type="text"
                      value={coverLetter.dateLine}
                      onChange={(e) =>
                        updateLetter({ dateLine: e.target.value })
                      }
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="27 March 2026"
                    />
                  </div>
                  <div>
                    <FieldLabel>Recipient (name, title, company, address)</FieldLabel>
                    <RichTextEditor
                      value={coverLetter.recipientHtml}
                      onChange={(html) => updateLetter({ recipientHtml: html })}
                      placeholder={"Hiring Manager\nCompany Ltd\nCity"}
                      minHeight="6rem"
                      aria-label="Recipient"
                    />
                  </div>
                  <div>
                    <FieldLabel>Subject / reference</FieldLabel>
                    <input
                      type="text"
                      value={coverLetter.subject}
                      onChange={(e) =>
                        updateLetter({ subject: e.target.value })
                      }
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="Application for …"
                    />
                  </div>
                  <div>
                    <FieldLabel>Body</FieldLabel>
                    <RichTextEditor
                      value={coverLetter.bodyHtml}
                      onChange={(html) => updateLetter({ bodyHtml: html })}
                      placeholder="Opening, motivation, fit, closing paragraphs…"
                      minHeight="14rem"
                      aria-label="Cover letter body"
                    />
                  </div>
                  <div>
                    <FieldLabel>Sign-off</FieldLabel>
                    <RichTextEditor
                      value={coverLetter.closingHtml}
                      onChange={(html) => updateLetter({ closingHtml: html })}
                      placeholder={"Best regards,\nYour name"}
                      minHeight="5rem"
                      aria-label="Sign-off"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start print:col-span-full print:static print:w-full">
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950 print:max-h-none print:overflow-visible print:rounded-none print:border-0 print:bg-white print:p-0">
            {activeDoc === "resume" ? (
              <ResumePreview resume={resume} />
            ) : (
              <CoverLetterPreview letter={coverLetter} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
