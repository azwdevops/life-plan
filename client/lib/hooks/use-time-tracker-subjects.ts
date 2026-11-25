"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  type TimeTrackerGoal,
  type TimeTrackerProject,
  type TimeTrackerCategory,
  loadGoals,
  loadProjects,
  loadCategories,
} from "@/lib/time-tracker-storage";
import {
  listTimeTrackerGoals,
  createTimeTrackerGoal,
  updateTimeTrackerGoal,
  deleteTimeTrackerGoal,
  listTimeTrackerProjects,
  createTimeTrackerProject,
  updateTimeTrackerProject,
  deleteTimeTrackerProject,
  listTimeTrackerCategories,
  createTimeTrackerCategory,
  updateTimeTrackerCategory,
  deleteTimeTrackerCategory,
} from "@/lib/api/time-tracker-subjects";

export const TIME_TRACKER_GOALS_QUERY_KEY = ["time-tracker-goals"] as const;
export const TIME_TRACKER_PROJECTS_QUERY_KEY = ["time-tracker-projects"] as const;
export const TIME_TRACKER_CATEGORIES_QUERY_KEY = ["time-tracker-categories"] as const;

/** Case/whitespace-insensitive key so 'Test', 'test', ' teSt ' collide — mirrors the backend's `normalize_name_key`. */
export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).join(" ");
}

export function useTimeTrackerGoals() {
  const { token } = useAuth();
  return useQuery({
    queryKey: TIME_TRACKER_GOALS_QUERY_KEY,
    queryFn: () => listTimeTrackerGoals(token!),
    enabled: !!token,
  });
}

export function useTimeTrackerProjects() {
  const { token } = useAuth();
  return useQuery({
    queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY,
    queryFn: () => listTimeTrackerProjects(token!),
    enabled: !!token,
  });
}

export function useTimeTrackerCategories() {
  const { token } = useAuth();
  return useQuery({
    queryKey: TIME_TRACKER_CATEGORIES_QUERY_KEY,
    queryFn: () => listTimeTrackerCategories(token!),
    enabled: !!token,
  });
}

export function useCreateTimeTrackerGoal() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; end_date?: string | null }) =>
      createTimeTrackerGoal(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_GOALS_QUERY_KEY });
    },
  });
}

export function useUpdateTimeTrackerGoal() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      body: Partial<{ name: string; end_date: string | null }>;
    }) => updateTimeTrackerGoal(token!, args.id, args.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_GOALS_QUERY_KEY });
    },
  });
}

export function useDeleteTimeTrackerGoal() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTimeTrackerGoal(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_GOALS_QUERY_KEY });
      // The FK's ON DELETE SET NULL clears goal_id on any project that pointed here.
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY });
    },
  });
}

export function useCreateTimeTrackerProject() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; goal_id?: number | null; category_id?: number | null }) =>
      createTimeTrackerProject(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY });
    },
  });
}

export function useUpdateTimeTrackerProject() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      body: Partial<{ name: string; goal_id: number | null; category_id: number | null }>;
    }) => updateTimeTrackerProject(token!, args.id, args.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY });
    },
  });
}

export function useDeleteTimeTrackerProject() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTimeTrackerProject(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY });
    },
  });
}

export function useCreateTimeTrackerCategory() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => createTimeTrackerCategory(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_CATEGORIES_QUERY_KEY });
    },
  });
}

export function useUpdateTimeTrackerCategory() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; body: Partial<{ name: string }> }) =>
      updateTimeTrackerCategory(token!, args.id, args.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_CATEGORIES_QUERY_KEY });
    },
  });
}

export function useDeleteTimeTrackerCategory() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTimeTrackerCategory(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_CATEGORIES_QUERY_KEY });
      // The FK's ON DELETE SET NULL clears category_id on any project that pointed here.
      queryClient.invalidateQueries({ queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY });
    },
  });
}

/**
 * One-time manual migration: pushes whatever Goals/Projects/Categories are
 * sitting in this browser's localStorage (from before the backend became the
 * source of truth) up to the server, skipping any whose name already matches
 * one server-side (case/whitespace-insensitive).
 */
export function useUploadLocalTimeTrackerData() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return async () => {
    if (!token) throw new Error("Not signed in");

    const localGoals = loadGoals();
    const localCategories = loadCategories();
    const localProjects = loadProjects();

    const serverGoals = await listTimeTrackerGoals(token);
    const goalIdMap = new Map<string, string>();
    let goalsAdded = 0;
    for (const g of localGoals) {
      const key = normalizeNameKey(g.name);
      const existing = serverGoals.find((sg) => normalizeNameKey(sg.name) === key);
      if (existing) {
        goalIdMap.set(g.id, existing.id);
        continue;
      }
      const created = await createTimeTrackerGoal(token, {
        name: g.name,
        end_date: g.endDate,
      });
      goalIdMap.set(g.id, created.id);
      goalsAdded += 1;
    }

    const serverCategories = await listTimeTrackerCategories(token);
    const categoryIdMap = new Map<string, string>();
    let categoriesAdded = 0;
    for (const c of localCategories) {
      const key = normalizeNameKey(c.name);
      const existing = serverCategories.find((sc) => normalizeNameKey(sc.name) === key);
      if (existing) {
        categoryIdMap.set(c.id, existing.id);
        continue;
      }
      const created = await createTimeTrackerCategory(token, { name: c.name });
      categoryIdMap.set(c.id, created.id);
      categoriesAdded += 1;
    }

    const serverProjects = await listTimeTrackerProjects(token);
    let projectsAdded = 0;
    for (const p of localProjects) {
      const key = normalizeNameKey(p.name);
      const existing = serverProjects.find((sp) => normalizeNameKey(sp.name) === key);
      if (existing) continue;
      const goalId = p.goalId ? goalIdMap.get(p.goalId) ?? null : null;
      const categoryId = p.categoryId ? categoryIdMap.get(p.categoryId) ?? null : null;
      await createTimeTrackerProject(token, {
        name: p.name,
        goal_id: goalId ? Number(goalId) : null,
        category_id: categoryId ? Number(categoryId) : null,
      });
      projectsAdded += 1;
    }

    queryClient.invalidateQueries({ queryKey: TIME_TRACKER_GOALS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: TIME_TRACKER_CATEGORIES_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY });

    return { goalsAdded, categoriesAdded, projectsAdded };
  };
}

export type { TimeTrackerGoal, TimeTrackerProject, TimeTrackerCategory };
