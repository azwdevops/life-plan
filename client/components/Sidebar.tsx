"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn?: boolean;
}

// Every page mounts its own <Sidebar>, so navigation destroys and recreates this
// component. Module-level (not component-level) state survives that remount,
// letting us restore the nav's scroll position instead of snapping back to top.
let lastScrollTop = 0;

export function Sidebar({ isOpen, onClose, isLoggedIn = false }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.groups?.includes("admin");
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = lastScrollTop;
    }
  }, []);

  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    // Auto-expand menus if we're on their pages
    const initial: string[] = [];
    if (pathname.startsWith("/investments")) initial.push("investments");
    if (pathname.startsWith("/liabilities")) initial.push("liabilities");
    if (
      pathname.startsWith("/money-flow") ||
      pathname.startsWith("/expenses") ||
      pathname.startsWith("/income") ||
      pathname.startsWith("/transfers") ||
      pathname.startsWith("/journal")
    ) {
      initial.push("moneyFlow");
    }
    if (pathname.startsWith("/assets")) initial.push("assets");
    if (
      pathname.startsWith("/personal-growth") ||
      pathname.startsWith("/exercise") ||
      pathname.startsWith("/game/self-discovery")
    ) {
      initial.push("personalGrowth");
    }
    if (pathname.startsWith("/productivity")) initial.push("productivity");
    if (pathname.startsWith("/music-business")) initial.push("musicBusiness");
    if (
      pathname.startsWith("/support-settings") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/terms")
    ) {
      initial.push("supportSettings");
    }
    return initial;
  });

  type NavItem =
    | { icon: string; label: string; href: string; type: "link" }
    | { icon: string; label: string; href: null; type: "expandable"; subMenuKey: string; matchPrefixes: string[] };

  const navItems: NavItem[] = [
    { icon: "📊", label: "Dashboard", href: "/dashboard", type: "link" as const },
    { icon: "🏦", label: "Accounts", href: "/accounts", type: "link" as const },
    { icon: "💱", label: "Money Flow", href: null, type: "expandable" as const, subMenuKey: "moneyFlow", matchPrefixes: ["/money-flow", "/expenses", "/income", "/transfers", "/journal"] },
    { icon: "🏢", label: "Assets", href: null, type: "expandable" as const, subMenuKey: "assets", matchPrefixes: ["/assets"] },
    { icon: "📋", label: "Liabilities", href: null, type: "expandable" as const, subMenuKey: "liabilities", matchPrefixes: ["/liabilities"] },
    { icon: "📈", label: "Reports", href: "/reports", type: "link" as const },
    { icon: "💼", label: "Investments", href: null, type: "expandable" as const, subMenuKey: "investments", matchPrefixes: ["/investments"] },
    ...(isLoggedIn
      ? [
          { icon: "✨", label: "Productivity", href: null, type: "expandable" as const, subMenuKey: "productivity", matchPrefixes: ["/productivity"] },
          { icon: "🎵", label: "Music Business", href: null, type: "expandable" as const, subMenuKey: "musicBusiness", matchPrefixes: ["/music-business"] },
        ]
      : []),
    ...(isAdmin
      ? [
          { icon: "🌱", label: "Personal Growth", href: null, type: "expandable" as const, subMenuKey: "personalGrowth", matchPrefixes: ["/personal-growth", "/exercise", "/game/self-discovery"] },
          { icon: "📚", label: "Developer Growth", href: "/developer-growth", type: "link" as const },
        ]
      : []),
    { icon: "🛠️", label: "Support & Settings", href: null, type: "expandable" as const, subMenuKey: "supportSettings", matchPrefixes: ["/support-settings", "/settings", "/admin/users", "/privacy", "/terms"] },
  ].sort((a, b) => a.label.localeCompare(b.label));

  const subMenuItems = {
    investments: [
      { icon: "🎮", label: "Investment Game", href: "/investments" },
      { icon: "📍", label: "Plot Prospects", href: "/investments/plots" },
      { icon: "📐", label: "Feasibility Analysis", href: "/investments/feasibility" },
      { icon: "📑", label: "Shares Feasibility", href: "/investments/shares-feasibility" },
    ] as Array<{ icon: string; label: string; href: string }>,
    assets: [
      { icon: "💵", label: "Current Assets", href: "/assets" },
      { icon: "🏛️", label: "Fixed Assets", href: "/assets/fixed" },
    ] as Array<{ icon: string; label: string; href: string }>,
    liabilities: [
      { icon: "📆", label: "Long Term", href: "/liabilities" },
      { icon: "🗓️", label: "Short Term", href: "/liabilities/short-term" },
    ] as Array<{ icon: string; label: string; href: string }>,
    moneyFlow: [
      { icon: "💸", label: "Expenses", href: "/money-flow" },
      { icon: "💰", label: "Income", href: "/income" },
      { icon: "🔁", label: "Transfers", href: "/transfers" },
      { icon: "📓", label: "Journal", href: "/journal" },
      { icon: "🤖", label: "AI Posting", href: "/money-flow/ai-posting" },
    ] as Array<{ icon: string; label: string; href: string }>,
    personalGrowth: [
      { icon: "🏃", label: "Exercise", href: "/personal-growth" },
      { icon: "🧭", label: "Self Discovery", href: "/game/self-discovery" },
      { icon: "📖", label: "Reading", href: "/personal-growth/reading" },
      { icon: "✍️", label: "AZW Books", href: "/personal-growth/books" },
    ] as Array<{ icon: string; label: string; href: string }>,
    productivity: [
      { icon: "⏱️", label: "Time tracking", href: "/productivity" },
      { icon: "📝", label: "Blog", href: "/productivity/blog" },
      { icon: "🗓️", label: "AI schedule", href: "/productivity/schedule" },
      { icon: "📌", label: "Pending work", href: "/productivity/pending" },
      { icon: "🎯", label: "Discipline", href: "/productivity/discipline" },
    ] as Array<{ icon: string; label: string; href: string }>,
    musicBusiness: [
      { icon: "📺", label: "YouTube", href: "/music-business/youtube" },
    ] as Array<{ icon: string; label: string; href: string }>,
    supportSettings: [
      { icon: "💬", label: "Feedback", href: "/support-settings" },
      { icon: "⚙️", label: "Settings", href: "/settings" },
      { icon: "🔒", label: "Privacy Policy", href: "/privacy" },
      { icon: "📜", label: "Terms of Service", href: "/terms" },
      ...(isAdmin
        ? [{ icon: "👥", label: "Users", href: "/admin/users" }]
        : []),
    ] as Array<{ icon: string; label: string; href: string }>,
  };

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuKey)
        ? prev.filter((key) => key !== menuKey)
        : [...prev, menuKey]
    );
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          data-app-sidebar-backdrop
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-site-sidebar"
        className={`fixed left-0 top-16 bottom-0 z-40 flex w-60 flex-col transform border-r border-zinc-200 bg-white transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav
          ref={navRef}
          onScroll={(e) => {
            lastScrollTop = e.currentTarget.scrollTop;
          }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pr-4 pl-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700"
        >
          <div className="pb-6">
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                if (item.type === "expandable" && item.subMenuKey) {
                  const isActive = item.matchPrefixes.some((prefix) => pathname.startsWith(prefix));
                  return (
                    <li key={item.label}>
                      <button
                        onClick={() => toggleMenu(item.subMenuKey)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                          isActive
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{item.icon}</span>
                          <span className="text-base font-medium">{item.label}</span>
                        </div>
                        <span
                          className={`transition-transform ${expandedMenus.includes(item.subMenuKey) ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                      </button>
                      {expandedMenus.includes(item.subMenuKey) && (
                        <ul className="mt-1 ml-4 space-y-0.5">
                          {subMenuItems[item.subMenuKey as keyof typeof subMenuItems].map((subItem) => {
                            const isSubActive = pathname === subItem.href;
                            return (
                              <li key={subItem.label}>
                                <Link
                                  href={subItem.href}
                                  className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                                    isSubActive
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                  }`}
                                  onClick={() => {
                                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                                      onClose();
                                    }
                                  }}
                                >
                                  <span className="text-sm">{subItem.icon}</span>
                                  <span className="text-sm font-medium">{subItem.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                } else if (item.type === "link") {
                  const href = item.href;
                  const isActive =
                    pathname === href ||
                    (href === "/developer-growth" &&
                      (pathname.startsWith("/game/revision") ||
                        pathname.startsWith("/developer-growth/")));
                  return (
                    <li key={item.label}>
                      <Link
                        href={href}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                          isActive
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                        onClick={() => {
                          if (typeof window !== "undefined" && window.innerWidth < 1024) {
                            onClose();
                          }
                        }}
                      >
                        <span className="text-base">{item.icon}</span>
                        <span className="text-base font-medium">{item.label}</span>
                      </Link>
                    </li>
                  );
                }
              })}
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
}

