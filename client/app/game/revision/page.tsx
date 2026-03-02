"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import type { RevisionApiProvider } from "@/lib/api/revision";
import { generateRevisionQuestions } from "@/lib/api/revision";
import {
  REVISION_CATEGORIES,
  PROGRAMMING_LANGUAGES,
  API_OPTIONS,
  MODELS_BY_PROVIDER,
  getCurrentRevisionSession,
  saveRevisionSession,
  saveRevisionSettings,
  loadRevisionSettings,
  createSessionId,
} from "./constants";

export default function RevisionListPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, toggleSidebar, setIsSidebarOpen } = useSidebar();
  const isAdmin = user?.groups?.includes("admin");
  const [api, setApi] = useState<RevisionApiProvider>("openrouter");
  const [model, setModel] = useState<string>(() => MODELS_BY_PROVIDER.openrouter[0].value);
  const [category, setCategory] = useState<string>(REVISION_CATEGORIES[0].value);
  const [programmingLanguage, setProgrammingLanguage] = useState<string>(PROGRAMMING_LANGUAGES[0].value);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ReturnType<typeof getCurrentRevisionSession>>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) router.push("/dashboard");
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    setCurrentSession(getCurrentRevisionSession());
  }, []);

  useEffect(() => {
    const settings = loadRevisionSettings();
    if (settings) {
      setApi(settings.api);
      setModel(settings.model);
    }
  }, []);

  const handleGenerate = async () => {
    setGenerateError(null);
    setGenerating(true);
    try {
      saveRevisionSettings({ api, model });
      const res = await generateRevisionQuestions(category, programmingLanguage, api, model);
      const id = createSessionId();
      const session = {
        id,
        category,
        programmingLanguage,
        api,
        model,
        createdAt: Date.now(),
        questions: res.questions,
        answers: [],
      };
      saveRevisionSession(session);
      setCurrentSession(session);
      router.push(`/game/revision/${id}`);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isAuthenticated && !isLoading) return null;
  if (isAuthenticated && !isLoading && !isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      {isAuthenticated && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isLoggedIn={isAuthenticated}
        />
      )}
      <main
        className={`flex-1 transition-all duration-300 ${isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"}`}
      >
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:flex-nowrap lg:items-center lg:justify-between">
            <div className="min-w-0 shrink-0">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                Developer Revision
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Add revision kits by category and language. Answer 10 questions and get a summary of areas to work on.
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-end gap-3 sm:gap-4">
              <div className="flex min-w-0 shrink-0 flex-col gap-1.5 sm:w-36">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">API</span>
                <SearchableSelect
                  options={API_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    searchText: `${opt.value} ${opt.label}`,
                  }))}
                  value={api}
                  onChange={(v) => {
                    const next = v as RevisionApiProvider;
                    setApi(next);
                    const models = MODELS_BY_PROVIDER[next];
                    if (models?.length && !models.some((m) => m.value === model)) {
                      setModel(models[0].value);
                    }
                  }}
                  placeholder="Select API"
                  searchPlaceholder="Type to search..."
                  className="w-full"
                />
              </div>
              <div className="flex min-w-0 shrink-0 flex-col gap-1.5 sm:w-56">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</span>
                <SearchableSelect
                  options={MODELS_BY_PROVIDER[api].map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    searchText: `${opt.value} ${opt.label}`,
                  }))}
                  value={model}
                  onChange={(v) => setModel(String(v))}
                  placeholder="Select model"
                  searchPlaceholder="Type to search..."
                  className="w-full"
                />
              </div>
              <div className="flex min-w-0 shrink-0 flex-col gap-1.5 sm:w-32">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</span>
                <SearchableSelect
                  options={REVISION_CATEGORIES.map((c) => ({
                    value: c.value,
                    label: c.label,
                    searchText: `${c.value} ${c.label}`,
                  }))}
                  value={category}
                  onChange={(v) => setCategory(String(v))}
                  placeholder="Category"
                  searchPlaceholder="Type to search..."
                  className="w-full"
                />
              </div>
              <div className="flex min-w-0 shrink-0 flex-col gap-1.5 sm:w-36">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Language</span>
                <SearchableSelect
                  options={PROGRAMMING_LANGUAGES.map((l) => ({
                    value: l.value,
                    label: l.label,
                    searchText: `${l.value} ${l.label}`,
                  }))}
                  value={programmingLanguage}
                  onChange={(v) => setProgrammingLanguage(String(v))}
                  placeholder="Language"
                  searchPlaceholder="Type to search..."
                  className="w-full"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
              >
                {generating ? "Generating…" : "Generate 10 questions"}
              </button>
            </div>
          </div>

          {generateError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              {generateError}
            </div>
          )}

          {currentSession && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Current revision
              </h2>
              <p className="mb-1 font-medium capitalize text-zinc-900 dark:text-zinc-100">
                {currentSession.category} · {currentSession.programmingLanguage}
              </p>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(currentSession.createdAt)} · {currentSession.answers.length}/{currentSession.questions.length} answered
              </p>
              <Link
                href={`/game/revision/${currentSession.id}`}
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
              >
                {currentSession.answers.length >= currentSession.questions.length
                  ? "View summary"
                  : "Continue questions"}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
