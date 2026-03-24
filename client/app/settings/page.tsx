"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { FitnessProfileModal } from "@/components/FitnessProfileModal";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, token, applyUser } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const [metricsOpen, setMetricsOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Don't show loading screen if we're just checking auth - only show if actually loading
  if (!isAuthenticated && !isLoading) {
    return null; // Will redirect, don't render anything
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header
        onMenuClick={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
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
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Settings
          </h1>

          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Exercise metrics
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Configure saved weight, height, age, sex, MET, and live-run refresh
                timing used for exercise estimates.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setMetricsOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  Edit exercise metrics…
                </button>
              </div>
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                Values stay saved to your account until you change them.
              </p>
            </div>
          </div>
        </div>
      </main>

      {token && (
        <FitnessProfileModal
          isOpen={metricsOpen}
          onClose={() => setMetricsOpen(false)}
          token={token}
          user={user}
          onSaved={applyUser}
        />
      )}
    </div>
  );
}

