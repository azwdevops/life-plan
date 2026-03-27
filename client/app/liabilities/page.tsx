"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import LoansPage from "@/app/loans/page";
import ShortTermLiabilitiesPage from "@/app/liabilities/short-term/page";

type LiabilitiesTab = "long-term" | "short-term";

const TAB_CONFIG: Array<{ id: LiabilitiesTab; label: string }> = [
  { id: "long-term", label: "Long Term" },
  { id: "short-term", label: "Short Term" },
];

function LiabilitiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();

  const activeTab = useMemo<LiabilitiesTab>(() => {
    const requested = searchParams.get("tab");
    return requested === "short-term" ? "short-term" : "long-term";
  }, [searchParams]);

  if (!isAuthenticated && !isLoading) {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header
        onMenuClick={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        centerContent={
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:flex-row md:items-center md:justify-center md:gap-3 md:overflow-x-auto md:whitespace-nowrap">
            <h1 className="hidden shrink-0 text-base font-bold text-zinc-900 dark:text-zinc-100 md:block">
              Liabilities
            </h1>
            <label className="sr-only" htmlFor="liabilities-tab-select">
              Liabilities section
            </label>
            <select
              id="liabilities-tab-select"
              value={activeTab}
              onChange={(e) => {
                const next = e.target.value as LiabilitiesTab;
                router.replace(`/liabilities?tab=${next}`);
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
                    onClick={() => router.replace(`/liabilities?tab=${tab.id}`)}
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
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isLoggedIn={isAuthenticated} />
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
        }`}
      >
        {activeTab === "long-term" ? <LoansPage /> : <ShortTermLiabilitiesPage />}
      </main>
    </div>
  );
}

const liabilitiesSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default function LiabilitiesPage() {
  return (
    <Suspense fallback={liabilitiesSuspenseFallback}>
      <LiabilitiesContent />
    </Suspense>
  );
}
