"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { TimeTrackingPanel } from "@/components/productivity/TimeTrackingPanel";
import { ProductivityBlogPanel } from "@/components/productivity/ProductivityBlogPanel";

type ProductivityTab = "tracking" | "blog";

const TAB_CONFIG: Array<{ id: ProductivityTab; label: string }> = [
  { id: "tracking", label: "Time tracking" },
  { id: "blog", label: "Blog" },
];

function ProductivityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();

  const tab = useMemo((): ProductivityTab => {
    const t = searchParams.get("tab");
    if (t === "blog") return "blog";
    return "tracking";
  }, [searchParams]);

  const setTab = (next: ProductivityTab) => {
    router.replace(`/productivity?tab=${next}`);
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950"
      suppressHydrationWarning
    >
      <Header
        onMenuClick={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        centerContent={
          <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3 md:overflow-x-auto md:whitespace-nowrap">
            <h1 className="hidden shrink-0 text-base font-bold text-zinc-900 dark:text-zinc-100 md:block">
              Productivity
            </h1>
            <label className="sr-only" htmlFor="productivity-tab-select">
              Productivity section
            </label>
            <select
              id="productivity-tab-select"
              value={tab}
              onChange={(e) => {
                setTab(e.target.value as ProductivityTab);
              }}
              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm md:hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {TAB_CONFIG.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="hidden gap-2 md:flex" role="tablist" aria-label="Productivity sections">
              {TAB_CONFIG.map((t) => {
                const selected = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(t.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "bg-blue-600 text-white dark:bg-blue-500"
                        : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {t.label}
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
        className={`min-h-0 min-w-0 w-full flex-1 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
        }`}
      >
        <div className="min-h-0 w-full min-w-0 flex-1 px-4 py-6" role="tabpanel">
          {tab === "tracking" ? <TimeTrackingPanel /> : <ProductivityBlogPanel />}
        </div>
      </main>
    </div>
  );
}

export default function ProductivityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <ProductivityPageInner />
    </Suspense>
  );
}
