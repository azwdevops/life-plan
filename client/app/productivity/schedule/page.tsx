"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { AiSchedulePanel } from "@/components/productivity/AiSchedulePanel";

function ProductivitySchedulePageInner() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || isLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [hasMounted, isAuthenticated, isLoading, router]);

  if (!hasMounted) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isLoggedIn={isAuthenticated}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden">
        <main
          className={`min-h-0 min-w-0 max-w-full flex-1 transition-all duration-300 ${
            isSidebarOpen && isAuthenticated ? "lg:pl-60" : ""
          }`}
        >
          <div
            className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-4"
          >
            <AiSchedulePanel />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ProductivitySchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <ProductivitySchedulePageInner />
    </Suspense>
  );
}
