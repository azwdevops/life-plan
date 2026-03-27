"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import FeedbackPage from "@/app/feedback/page";
import SettingsPage from "@/app/settings/page";
import AdminUsersPage from "@/app/admin/users/page";

type SupportSettingsTab = "users" | "feedback" | "settings";

export default function SupportSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const isAdmin = user?.groups?.includes("admin");

  const availableTabs = useMemo<Array<{ id: SupportSettingsTab; label: string }>>(() => {
    const base: Array<{ id: SupportSettingsTab; label: string }> = [
      { id: "feedback", label: "Feedback" },
      { id: "settings", label: "Settings" },
    ];
    if (isAdmin) {
      base.unshift({ id: "users", label: "Users" });
    }
    return base;
  }, [isAdmin]);

  const activeTab = useMemo<SupportSettingsTab>(() => {
    const requested = searchParams.get("tab");
    if (requested === "users" && isAdmin) return "users";
    if (requested === "settings") return "settings";
    return "feedback";
  }, [searchParams, isAdmin]);

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
              Support & Settings
            </h1>
            <label className="sr-only" htmlFor="support-settings-tab-select">
              Support and settings section
            </label>
            <select
              id="support-settings-tab-select"
              value={activeTab}
              onChange={(e) => {
                const next = e.target.value as SupportSettingsTab;
                router.replace(`/support-settings?tab=${next}`);
              }}
              className="md:hidden w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {availableTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <div className="hidden gap-2 md:flex">
              {availableTabs.map((tab) => {
                const selected = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => router.replace(`/support-settings?tab=${tab.id}`)}
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
        {activeTab === "users" && isAdmin && <AdminUsersPage />}
        {activeTab === "feedback" && <FeedbackPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
