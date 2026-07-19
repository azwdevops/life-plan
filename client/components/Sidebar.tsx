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
    return [];
  });
  
  type NavItem =
    | { icon: string; label: string; href: string; type: "link" }
    | { icon: string; label: string; href: null; type: "expandable"; subMenuKey: string };

  const navItems: NavItem[] = [
    { icon: "📊", label: "Dashboard", href: "/dashboard", type: "link" as const },
    { icon: "🏦", label: "Accounts", href: "/accounts", type: "link" as const },
    { icon: "💱", label: "Money Flow", href: "/money-flow", type: "link" as const },
    { icon: "🏢", label: "Assets", href: "/assets", type: "link" as const },
    { icon: "📋", label: "Liabilities", href: "/liabilities", type: "link" as const },
    { icon: "📈", label: "Reports", href: "/reports", type: "link" as const },
    { icon: "💼", label: "Investments", href: "/investments", type: "link" as const },
    ...(isLoggedIn
      ? [{ icon: "✨", label: "Productivity", href: "/productivity", type: "link" as const }]
      : []),
    ...(isAdmin
      ? [
          { icon: "🌱", label: "Personal Growth", href: "/personal-growth", type: "link" as const },
          { icon: "📚", label: "Developer Growth", href: "/developer-growth", type: "link" as const },
        ]
      : []),
    { icon: "🛠️", label: "Support & Settings", href: "/support-settings", type: "link" as const },
  ].sort((a, b) => a.label.localeCompare(b.label));

  const subMenuItems = {
    liabilities: [] as Array<{ icon: string; label: string; href: string }>,
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
        className={`fixed left-0 top-16 bottom-0 z-40 w-64 transform border-r border-zinc-200 bg-white transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav
          ref={navRef}
          onScroll={(e) => {
            lastScrollTop = e.currentTarget.scrollTop;
          }}
          className="flex h-full flex-col overflow-y-auto overscroll-contain p-4"
        >
          <div className="pb-6">
            <ul className="space-y-1">
              {navItems.map((item) => {
                if (item.type === "expandable" && item.subMenuKey) {
                  const isActive = false;
                  return (
                    <li key={item.label}>
                      <button
                        onClick={() => toggleMenu(item.subMenuKey)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 transition-colors ${
                          isActive
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{item.icon}</span>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <span
                          className={`transition-transform ${expandedMenus.includes(item.subMenuKey) ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                      </button>
                      {expandedMenus.includes(item.subMenuKey) && (
                        <ul className="mt-1 ml-4 space-y-1">
                          {subMenuItems[item.subMenuKey as keyof typeof subMenuItems].map((subItem) => {
                            const isSubActive = pathname === subItem.href;
                            return (
                              <li key={subItem.label}>
                                <Link
                                  href={subItem.href}
                                  className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
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
                                  <span className="text-lg">{subItem.icon}</span>
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
                    (href === "/productivity" &&
                      pathname.startsWith("/productivity")) ||
                    (href === "/developer-growth" &&
                      (pathname.startsWith("/game/revision") ||
                        pathname.startsWith("/developer-growth/")));
                  return (
                    <li key={item.label}>
                      <Link
                        href={href}
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
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
                        <span className="text-xl">{item.icon}</span>
                        <span className="font-medium">{item.label}</span>
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

