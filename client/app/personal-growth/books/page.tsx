"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { AzwBooksListContent } from "@/components/azw-books/AzwBooksListContent";

export default function AzwBooksPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const isAdmin = user?.groups?.includes("admin");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && isAuthenticated && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, isAdmin, router]);

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  if (isAuthenticated && !isLoading && !isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isLoggedIn={isAuthenticated} />
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-60" : "lg:ml-0"
        }`}
      >
        <AzwBooksListContent />
      </main>
    </div>
  );
}
