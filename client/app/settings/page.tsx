"use client";

import { Suspense, useEffect, memo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ApiCredentialsSection } from "@/components/settings/ApiCredentialsSection";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";

function SettingsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, token } = useAuth();
  const isEmbedded = searchParams.get("embedded") === "1" || pathname === "/support-settings";
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
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
      {!isEmbedded && (
        <Header
          onMenuClick={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
      )}
      {!isEmbedded && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isLoggedIn={isAuthenticated}
        />
      )}
      <main
        className={
          isEmbedded
            ? "flex-1"
            : `flex-1 transition-all duration-300 ${
                isSidebarOpen && isAuthenticated ? "lg:ml-60" : "lg:ml-0"
              }`
        }
      >
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <h1 className="min-w-0 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Settings
              <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                {" "}
                — LLM API keys
              </span>
            </h1>
          </div>

          <div className="space-y-6">
            {token ? <ApiCredentialsSection token={token} /> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

const settingsSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default memo(function SettingsPage() {
  return (
    <Suspense fallback={settingsSuspenseFallback}>
      <SettingsContent />
    </Suspense>
  );
});
