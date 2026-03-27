"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import RevisionListPage from "@/app/game/revision/page";

type DeveloperGrowthTab = "revision" | "resume";

const TAB_CONFIG: Array<{ id: DeveloperGrowthTab; label: string }> = [
  { id: "revision", label: "Developer Revision" },
  { id: "resume", label: "Resume & Cover Letter" },
];

function DeveloperGrowthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const isAdmin = user?.groups?.includes("admin");

  const activeTab = useMemo<DeveloperGrowthTab>(() => {
    const requested = searchParams.get("tab");
    for (const tab of TAB_CONFIG) {
      if (tab.id === requested) return tab.id;
    }
    return TAB_CONFIG[0].id;
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, isAdmin, router]);

  useEffect(() => {
    if (searchParams.get("tab") === "resume") {
      router.replace("/developer-growth/resumes");
    }
  }, [searchParams, router]);

  if (!isAuthenticated && !isLoading) return null;
  if (isAuthenticated && !isLoading && !isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header
        onMenuClick={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        centerContent={
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:flex-row md:items-center md:justify-center md:gap-3 md:overflow-x-auto md:whitespace-nowrap">
            <h1 className="hidden shrink-0 text-base font-bold text-zinc-900 dark:text-zinc-100 md:block">
              Developer Growth
            </h1>
            <label className="sr-only" htmlFor="developer-growth-tab-select">
              Developer growth section
            </label>
            <select
              id="developer-growth-tab-select"
              value={activeTab}
              onChange={(e) => {
                const next = e.target.value as DeveloperGrowthTab;
                if (next === "resume") {
                  router.push("/developer-growth/resumes");
                } else {
                  router.replace(`/developer-growth?tab=${next}`);
                }
              }}
              className="md:hidden w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {TAB_CONFIG.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <div className="hidden gap-2 md:flex">
              {TAB_CONFIG.map((tab) => {
                const selected = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.id === "resume") {
                        router.push("/developer-growth/resumes");
                      } else {
                        router.replace(`/developer-growth?tab=${tab.id}`);
                      }
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "bg-blue-600 text-white dark:bg-blue-500"
                        : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        }
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isLoggedIn={isAuthenticated}
      />
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
        }`}
      >
        {activeTab === "revision" && <RevisionListPage />}
      </main>
    </div>
  );
}

const developerGrowthSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default function DeveloperGrowthPage() {
  return (
    <Suspense fallback={developerGrowthSuspenseFallback}>
      <DeveloperGrowthContent />
    </Suspense>
  );
}
