"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import type { GameApiProvider } from "@/lib/api/game";
import { generateQuestions } from "@/lib/api/game";
import {
  TESTS,
  API_OPTIONS,
  MODELS_BY_PROVIDER,
  saveSettings,
  saveSession,
  loadSession,
} from "./constants";

export default function SelfDiscoveryListPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, toggleSidebar, setIsSidebarOpen } = useSidebar();
  const isAdmin = user?.groups?.includes("admin");
  const [api, setApi] = useState<GameApiProvider>("openrouter");
  const [model, setModel] = useState<string>(() => MODELS_BY_PROVIDER.openrouter[0].value);
  const [hasSavedByTestId, setHasSavedByTestId] = useState<Record<string, boolean>>({});
  const [generatingTestId, setGeneratingTestId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) router.push("/dashboard");
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    TESTS.forEach((test) => {
      const session = loadSession(test.id);
      next[test.id] = !!(session?.questions?.length);
    });
    setHasSavedByTestId(next);
  }, []);

  const handleContinue = (testId: string) => {
    saveSettings({ api, model });
    router.push(`/game/self-discovery/${testId}`);
  };

  const handleGenerateQuestions = (testId: string) => {
    saveSettings({ api, model });
    setGenerateError(null);
    setGeneratingTestId(testId);
    generateQuestions(testId, api, model)
      .then((res) => {
        saveSession(testId, { questions: res.questions, answers: [] });
        setHasSavedByTestId((prev) => ({ ...prev, [testId]: true }));
        setGeneratingTestId(null);
        router.push(`/game/self-discovery/${testId}`);
      })
      .catch((e) => {
        setGenerateError(e instanceof Error ? e.message : "Failed to generate questions");
        setGeneratingTestId(null);
      });
  };

  if (!isAuthenticated && !isLoading) return null;
  if (isAuthenticated && !isLoading && !isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isLoggedIn={isAuthenticated} />
      <main
        className={`flex-1 transition-all duration-300 ${isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"}`}
      >
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                Self Discovery
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Understand myself through short assessments and get a personalized analysis.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex min-w-0 flex-col gap-1.5 sm:w-52">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">API</span>
                <SearchableSelect
                  options={API_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    searchText: `${opt.value} ${opt.label}`,
                  }))}
                  value={api}
                  onChange={(v) => {
                    const next = v as GameApiProvider;
                    setApi(next);
                    const models = MODELS_BY_PROVIDER[next];
                    if (models?.length && !models.some((m) => m.value === model)) {
                      setModel(models[0].value);
                    }
                  }}
                  placeholder="Select API"
                  searchPlaceholder="Type to search API..."
                  className="w-full"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 sm:w-72">
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
                  searchPlaceholder="Type to search or filter model..."
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {generateError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              {generateError}
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TESTS.map((test) => {
              const hasSaved = hasSavedByTestId[test.id];
              const isGenerating = generatingTestId === test.id;
              return (
                <div
                  key={test.id}
                  className="flex min-h-[180px] flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{test.name}</h2>
                    <p className="mt-2 text-justify text-sm text-zinc-600 dark:text-zinc-400">{test.description}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 justify-end">
                    {hasSaved && (
                      <button
                        onClick={() => handleContinue(test.id)}
                        disabled={isGenerating}
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
                      >
                        Continue
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerateQuestions(test.id)}
                      disabled={isGenerating}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                    >
                      {isGenerating ? "Generating…" : hasSaved ? "Generate new questions" : "Generate questions"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
