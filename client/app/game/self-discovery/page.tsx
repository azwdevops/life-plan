"use client";

import { Suspense, useState, useEffect, useRef, useCallback, memo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { SearchableSelect } from "@/components/SearchableSelect";
import { SelfDiscoveryAssessmentsEditor } from "@/components/self-discovery/SelfDiscoveryAssessmentsEditor";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import type { GameApiProvider } from "@/lib/api/game";
import { generateQuestions } from "@/lib/api/game";
import { listApiProviders, type ApiProviderOut } from "@/lib/api/user-api-credentials";
import {
  listSelfDiscoveryAssessments,
  type SelfDiscoveryAssessmentCard,
} from "@/lib/api/self-discovery-assessments";
import { SELF_DISCOVERY_TEST_IDS, saveSettings, saveSession, loadSession, loadSettings } from "./constants";

function SelfDiscoveryListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, token } = useAuth();
  const { isSidebarOpen, toggleSidebar, setIsSidebarOpen } = useSidebar();
  const isEmbedded = searchParams.get("embedded") === "1" || pathname === "/personal-growth";
  const isAdmin = user?.groups?.includes("admin");
  const api: GameApiProvider = "openrouter";
  const [providers, setProviders] = useState<ApiProviderOut[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [keyId, setKeyId] = useState<number | null>(null);
  const [modelSlug, setModelSlug] = useState("");
  const selectionSeeded = useRef(false);
  const [hasSavedByTestId, setHasSavedByTestId] = useState<Record<string, boolean>>({});
  const [generatingTestId, setGeneratingTestId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<SelfDiscoveryAssessmentCard[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null);

  const loadAssessments = useCallback(() => {
    if (!token || !isAuthenticated) return;
    setAssessmentsLoading(true);
    setAssessmentsError(null);
    listSelfDiscoveryAssessments(token)
      .then((rows) => {
        setAssessments([...rows].sort((a, b) => a.sort_order - b.sort_order || a.test_id.localeCompare(b.test_id)));
      })
      .catch((e) => {
        setAssessmentsError(e instanceof Error ? e.message : "Could not load assessments");
        setAssessments([]);
      })
      .finally(() => setAssessmentsLoading(false));
  }, [token, isAuthenticated]);

  const selectedProvider =
    providerId != null ? providers.find((p) => p.id === providerId) ?? null : null;

  const credentialsReady =
    !!token &&
    providerId != null &&
    keyId != null &&
    modelSlug.trim() !== "" &&
    !!selectedProvider?.keys.some((k) => k.id === keyId) &&
    !!selectedProvider?.models.some((m) => m.slug === modelSlug);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) router.push("/dashboard");
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    SELF_DISCOVERY_TEST_IDS.forEach((id) => {
      const session = loadSession(id);
      next[id] = !!(session?.questions?.length);
    });
    setHasSavedByTestId(next);
  }, []);

  useEffect(() => {
    if (!token || !isAuthenticated || !isAdmin) return;
    loadAssessments();
  }, [token, isAuthenticated, isAdmin, loadAssessments]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setProviders([]);
      return;
    }
    let cancelled = false;
    setProvidersLoading(true);
    setProvidersError(null);
    listApiProviders(token)
      .then((rows) => {
        if (!cancelled) setProviders(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setProvidersError(e instanceof Error ? e.message : "Could not load API providers");
          setProviders([]);
        }
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (!token || providers.length === 0 || selectionSeeded.current) return;
    selectionSeeded.current = true;
    const saved = loadSettings();
    if (
      saved?.providerId != null &&
      saved.keyId != null &&
      saved.model?.trim() &&
      providers.some((p) => p.id === saved.providerId)
    ) {
      const p = providers.find((x) => x.id === saved.providerId)!;
      if (p.keys.some((k) => k.id === saved.keyId) && p.models.some((m) => m.slug === saved.model)) {
        setProviderId(saved.providerId);
        setKeyId(saved.keyId);
        setModelSlug(saved.model);
        return;
      }
    }
    const p0 = providers[0];
    setProviderId(p0.id);
    setKeyId(p0.keys[0]?.id ?? null);
    setModelSlug(p0.models[0]?.slug ?? "");
  }, [providers, token]);

  const applyProviderChange = (nextProviderId: number) => {
    setProviderId(nextProviderId);
    const p = providers.find((x) => x.id === nextProviderId);
    if (!p) return;
    setKeyId(p.keys[0]?.id ?? null);
    setModelSlug(p.models[0]?.slug ?? "");
  };

  const persistSelection = () => {
    if (providerId == null || keyId == null || !modelSlug.trim()) return;
    saveSettings({ api, providerId, keyId, model: modelSlug.trim() });
  };

  const handleContinue = (testId: string) => {
    persistSelection();
    router.push(`/game/self-discovery/${testId}`);
  };

  const handleGenerateQuestions = (testId: string) => {
    if (!token || providerId == null || keyId == null || !modelSlug.trim()) return;
    persistSelection();
    setGenerateError(null);
    setGeneratingTestId(testId);
    generateQuestions(testId, api, modelSlug.trim(), {
      token,
      credentials: { providerId, keyId },
    })
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
      {!isEmbedded && <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />}
      {!isEmbedded && (
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isLoggedIn={isAuthenticated} />
      )}
      <main
        className={
          isEmbedded
            ? "flex-1"
            : `flex-1 transition-all duration-300 ${isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"}`
        }
      >
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                Self Discovery
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Understand myself through short assessments and get a personalized analysis.
              </p>
            </div>
            <div className="flex w-full max-w-3xl flex-col gap-3 sm:items-end">
              {providersLoading ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading providers…</p>
              ) : providersError ? (
                <p className="text-sm text-red-700 dark:text-red-300">{providersError}</p>
              ) : providers.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No API providers yet. Add a provider, at least one model, and one API key in{" "}
                  <a href="/settings" className="font-medium text-blue-600 underline dark:text-blue-400">
                    Settings
                  </a>
                  , then refresh this page.
                </p>
              ) : (
                <div className="grid w-full gap-3 sm:grid-cols-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Provider</span>
                    <SearchableSelect
                      options={providers.map((p) => ({
                        value: String(p.id),
                        label: p.name,
                        searchText: `${p.id} ${p.name}`,
                      }))}
                      value={providerId != null ? String(providerId) : ""}
                      onChange={(v) => applyProviderChange(Number(v))}
                      placeholder="Select provider"
                      searchPlaceholder="Search provider…"
                      className="w-full"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</span>
                    <SearchableSelect
                      options={(selectedProvider?.models ?? []).map((m) => ({
                        value: m.slug,
                        label: `${m.name} (${m.slug})`,
                        searchText: `${m.name} ${m.slug}`,
                      }))}
                      value={modelSlug}
                      onChange={(v) => setModelSlug(String(v))}
                      placeholder={
                        selectedProvider?.models?.length
                          ? "Select model"
                          : "Add models for this provider in Settings"
                      }
                      searchPlaceholder="Search model…"
                      className="w-full"
                      disabled={!selectedProvider?.models?.length}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">API key</span>
                    <SearchableSelect
                      options={(selectedProvider?.keys ?? []).map((k) => ({
                        value: String(k.id),
                        label: k.name,
                        searchText: `${k.id} ${k.name} ${k.value_masked}`,
                      }))}
                      value={keyId != null ? String(keyId) : ""}
                      onChange={(v) => setKeyId(Number(v))}
                      placeholder={
                        selectedProvider?.keys?.length
                          ? "Select key"
                          : "Add an API key for this provider in Settings"
                      }
                      searchPlaceholder="Search key…"
                      className="w-full"
                      disabled={!selectedProvider?.keys?.length}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {generateError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              {generateError}
            </div>
          )}

          {assessmentsLoading ? (
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">Loading assessments…</p>
          ) : assessmentsError ? (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {assessmentsError}
            </div>
          ) : null}

          {token && assessments.length > 0 ? (
            <SelfDiscoveryAssessmentsEditor
              token={token}
              assessments={assessments}
              onSaved={() => loadAssessments()}
              hasSavedByTestId={hasSavedByTestId}
              generatingTestId={generatingTestId}
              credentialsReady={credentialsReady}
              onContinue={handleContinue}
              onGenerateQuestions={handleGenerateQuestions}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

const selfDiscoverySuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default memo(function SelfDiscoveryListPage() {
  return (
    <Suspense fallback={selfDiscoverySuspenseFallback}>
      <SelfDiscoveryListContent />
    </Suspense>
  );
});
