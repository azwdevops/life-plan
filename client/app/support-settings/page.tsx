"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import FeedbackPage from "@/app/feedback/page";
import SettingsPage from "@/app/settings/page";
import AdminUsersPage from "@/app/admin/users/AdminUsersClient";

type SupportSettingsTab = "users" | "feedback" | "settings";

function SupportSettingsContent() {
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
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isLoggedIn={isAuthenticated} />
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
        }`}
      >
        <div className="border-b border-zinc-200/80 bg-white py-3 dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="px-4 md:hidden">
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
              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {availableTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden w-full md:flex">
            {availableTabs.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => router.replace(`/support-settings?tab=${tab.id}`)}
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
        {activeTab === "users" && isAdmin && <AdminUsersPage />}
        {activeTab === "feedback" && <FeedbackPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

const supportSettingsSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default function SupportSettingsPage() {
  return (
    <Suspense fallback={supportSettingsSuspenseFallback}>
      <SupportSettingsContent />
    </Suspense>
  );
}
