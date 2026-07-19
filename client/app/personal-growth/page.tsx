"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import ExercisePage from "@/app/exercise/page";
import SelfDiscoveryListPage from "@/app/game/self-discovery/page";
import { ReadingTrackingTab } from "@/components/reading-tracking/ReadingTrackingTab";

type PersonalGrowthTab = "exercise" | "self-discovery" | "reading";

const TAB_CONFIG: Array<{ id: PersonalGrowthTab; label: string; path: string }> = [
  { id: "exercise", label: "Exercise", path: "/exercise" },
  { id: "self-discovery", label: "Self Discovery", path: "/game/self-discovery" },
  { id: "reading", label: "Reading", path: "/personal-growth?tab=reading" },
];

function PersonalGrowthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const isAdmin = user?.groups?.includes("admin");

  useEffect(() => {
    if (searchParams.get("tab") === "revision") {
      router.replace("/developer-growth?tab=revision");
    }
  }, [searchParams, router]);

  const activeTab = useMemo<PersonalGrowthTab>(() => {
    const requested = searchParams.get("tab");
    if (requested === "exercise" || requested === "self-discovery" || requested === "reading") {
      return requested;
    }
    return "exercise";
  }, [searchParams]);

  if (!isAuthenticated && !isLoading) {
    router.push("/login");
    return null;
  }

  if (isAuthenticated && !isLoading && !isAdmin) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isLoggedIn={isAuthenticated} />
      <main
        className={`flex min-h-0 flex-1 flex-col transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
        }`}
      >
        <div className="border-b border-zinc-200/80 bg-white py-3 dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="px-4 md:hidden">
            <label className="sr-only" htmlFor="personal-growth-tab-select">
              Personal growth section
            </label>
            <select
              id="personal-growth-tab-select"
              value={activeTab}
              onChange={(e) => {
                const next = e.target.value as PersonalGrowthTab;
                router.replace(`/personal-growth?tab=${next}`);
              }}
              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {TAB_CONFIG.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden w-full md:flex">
            {TAB_CONFIG.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => router.replace(`/personal-growth?tab=${tab.id}`)}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        {activeTab === "exercise" && <ExercisePage />}
        {activeTab === "self-discovery" && <SelfDiscoveryListPage />}
        {activeTab === "reading" && <ReadingTrackingTab embedded />}
      </main>
    </div>
  );
}

const personalGrowthSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default function PersonalGrowthPage() {
  return (
    <Suspense fallback={personalGrowthSuspenseFallback}>
      <PersonalGrowthContent />
    </Suspense>
  );
}
