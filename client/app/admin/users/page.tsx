"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  getAdminUsers,
  setUserGroups,
  getGroups,
  type UserResponse,
  type GroupResponse,
} from "@/lib/api/auth";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftGroups, setDraftGroups] = useState<Record<number, string[]>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const isAdmin = user?.groups?.includes("admin");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!isLoading && isAuthenticated && !isAdmin) {
      router.push("/dashboard");
      return;
    }
  }, [isAuthenticated, isLoading, isAdmin, router]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getAdminUsers(token), getGroups()])
      .then(([userList, groupList]) => {
        if (cancelled) return;
        setUsers(userList);
        setGroups(groupList);
        setDraftGroups(
          Object.fromEntries(userList.map((u) => [u.id, [...u.groups]]))
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin]);

  const handleToggleGroup = (userId: number, groupName: string) => {
    setDraftGroups((prev) => {
      const current = prev[userId] ?? [];
      const next = current.includes(groupName)
        ? current.filter((g) => g !== groupName)
        : [...current, groupName];
      return { ...prev, [userId]: next };
    });
  };

  const handleSave = (u: UserResponse) => {
    if (!token) return;
    const next = draftGroups[u.id] ?? u.groups;
    if (JSON.stringify([...next].sort()) === JSON.stringify([...u.groups].sort())) {
      setEditingId(null);
      return;
    }
    setSavingId(u.id);
    setUserGroups(token, u.id, next)
      .then((updated) => {
        setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        setDraftGroups((prev) => ({ ...prev, [updated.id]: [...updated.groups] }));
        setEditingId(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to save"))
      .finally(() => setSavingId(null));
  };

  const startEdit = (u: UserResponse) => {
    setDraftGroups((prev) => ({ ...prev, [u.id]: [...u.groups] }));
    setEditingId(u.id);
  };

  if (!isAuthenticated && !isLoading) return null;
  if (isAuthenticated && !isLoading && !isAdmin) return null;

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
          <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Manage users
          </h1>
          <p className="mb-6 text-zinc-600 dark:text-zinc-400">
            View and change which groups each user belongs to.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-600 dark:text-zinc-400">Loading users…</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <th className="px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        User
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Groups
                      </th>
                      <th className="w-28 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isEditing = editingId === u.id;
                      const current = isEditing ? (draftGroups[u.id] ?? u.groups) : u.groups;
                      return (
                        <tr
                          key={u.id}
                          className="border-b border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {u.first_name}
                            </div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                              {u.email}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex flex-wrap gap-2">
                                {groups.map((g) => (
                                  <label
                                    key={g.id}
                                    className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={(draftGroups[u.id] ?? u.groups).includes(g.name)}
                                      onChange={() => handleToggleGroup(u.id, g.name)}
                                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700"
                                    />
                                    <span>{g.name}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {current.length === 0 ? (
                                  <span className="text-sm text-zinc-400 dark:text-zinc-500">
                                    No groups
                                  </span>
                                ) : (
                                  current.map((name) => (
                                    <span
                                      key={name}
                                      className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                    >
                                      {name}
                                    </span>
                                  ))
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSave(u)}
                                  disabled={savingId === u.id}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                                >
                                  {savingId === u.id ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(null);
                                    setDraftGroups((prev) => ({ ...prev, [u.id]: [...u.groups] }));
                                  }}
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(u)}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
