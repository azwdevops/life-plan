"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import ExpensesPage from "@/app/expenses/page";
import IncomePage from "@/app/income/page";
import TransfersPage from "@/app/transfers/page";
import JournalPage from "@/app/journal/page";
import { AIPostingTab } from "./AIPostingTab";

type MoneyFlowTab = "expenses" | "income" | "transfers" | "journal" | "ai-posting";

const TAB_CONFIG: Array<{ id: MoneyFlowTab; label: string }> = [
  { id: "expenses", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "transfers", label: "Transfers" },
  { id: "journal", label: "Journal" },
  { id: "ai-posting", label: "AI Posting" },
];

function MoneyFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();

  const activeTab = useMemo<MoneyFlowTab>(() => {
    const requested = searchParams.get("tab");
    if (
      requested === "expenses" ||
      requested === "income" ||
      requested === "transfers" ||
      requested === "journal" ||
      requested === "ai-posting"
    ) {
      return requested;
    }
    return "expenses";
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
          <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3 md:overflow-x-auto md:whitespace-nowrap">
            <h1 className="hidden shrink-0 text-base font-bold text-zinc-900 dark:text-zinc-100 md:block">
              Money Flow
            </h1>
            <label className="sr-only" htmlFor="money-flow-tab-select">
              Money flow section
            </label>
            <select
              id="money-flow-tab-select"
              value={activeTab}
              onChange={(e) => {
                const next = e.target.value as MoneyFlowTab;
                router.replace(`/money-flow?tab=${next}`);
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
                    onClick={() => router.replace(`/money-flow?tab=${tab.id}`)}
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
        {activeTab === "expenses" && <ExpensesPage />}
        {activeTab === "income" && <IncomePage />}
        {activeTab === "transfers" && <TransfersPage />}
        {activeTab === "journal" && <JournalPage />}
        {activeTab === "ai-posting" && <AIPostingTab />}
      </main>
    </div>
  );
}

const moneyFlowSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default function MoneyFlowPage() {
  return (
    <Suspense fallback={moneyFlowSuspenseFallback}>
      <MoneyFlowContent />
    </Suspense>
  );
}
