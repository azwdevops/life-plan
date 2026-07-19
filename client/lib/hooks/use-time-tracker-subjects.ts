"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadGoals,
  loadProjects,
  newId,
  saveGoals,
  saveProjects,
  type TimeTrackerGoal,
  type TimeTrackerProject,
} from "@/lib/time-tracker-storage";
import {
  listServerTimeTrackerGoals,
  listServerTimeTrackerProjects,
} from "@/lib/api/time-tracker-subjects";

export const TIME_TRACKER_GOALS_QUERY_KEY = ["time-tracker-goals"] as const;
export const TIME_TRACKER_PROJECTS_QUERY_KEY = ["time-tracker-projects"] as const;

/** Case/whitespace-insensitive key so 'Test', 'test', ' teSt ' collide — mirrors the backend's `normalize_name_key`. */
export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * `loadGoals`/`loadProjects` read localStorage, which doesn't exist during
 * Next.js's server render. Without this gate, `queryFn` would run during SSR,
 * return `[]` (no `window`), and — with `staleTime: Infinity` +
 * `refetchOnMount: false` — that `[]` would be treated as valid, permanently
 * fetched data, so the real localStorage contents would never load. Gating
 * on a post-hydration "mounted" flag ensures `queryFn` only ever runs in the
 * browser, matching the `hydrated` pattern used elsewhere (e.g.
 * HeaderTimeTracker) for the same class of localStorage-vs-SSR mismatch.
 */
function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

export function useTimeTrackerGoals() {
  const mounted = useHasMounted();
  return useQuery({
    queryKey: TIME_TRACKER_GOALS_QUERY_KEY,
    queryFn: () => loadGoals(),
    enabled: mounted,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useTimeTrackerProjects() {
  const mounted = useHasMounted();
  return useQuery({
    queryKey: TIME_TRACKER_PROJECTS_QUERY_KEY,
    queryFn: () => loadProjects(),
    enabled: mounted,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/** Persists a new goal and appends it straight into the query cache — no invalidate/refetch. */
export function useAddTimeTrackerGoalToCache() {
  const queryClient = useQueryClient();
  return (goal: TimeTrackerGoal) => {
    const current =
      queryClient.getQueryData<TimeTrackerGoal[]>(TIME_TRACKER_GOALS_QUERY_KEY) ??
      loadGoals();
    const next = [...current, goal];
    saveGoals(next);
    queryClient.setQueryData(TIME_TRACKER_GOALS_QUERY_KEY, next);
  };
}

/** Persists a new project and appends it straight into the query cache — no invalidate/refetch. */
export function useAddTimeTrackerProjectToCache() {
  const queryClient = useQueryClient();
  return (project: TimeTrackerProject) => {
    const current =
      queryClient.getQueryData<TimeTrackerProject[]>(
        TIME_TRACKER_PROJECTS_QUERY_KEY
      ) ?? loadProjects();
    const next = [...current, project];
    saveProjects(next);
    queryClient.setQueryData(TIME_TRACKER_PROJECTS_QUERY_KEY, next);
  };
}

/** Persists an edited goal and replaces it in the query cache — no invalidate/refetch. */
export function useUpdateTimeTrackerGoalInCache() {
  const queryClient = useQueryClient();
  return (goal: TimeTrackerGoal) => {
    const current =
      queryClient.getQueryData<TimeTrackerGoal[]>(TIME_TRACKER_GOALS_QUERY_KEY) ??
      loadGoals();
    const next = current.map((g) => (g.id === goal.id ? goal : g));
    saveGoals(next);
    queryClient.setQueryData(TIME_TRACKER_GOALS_QUERY_KEY, next);
  };
}

/** Persists an edited project and replaces it in the query cache — no invalidate/refetch. */
export function useUpdateTimeTrackerProjectInCache() {
  const queryClient = useQueryClient();
  return (project: TimeTrackerProject) => {
    const current =
      queryClient.getQueryData<TimeTrackerProject[]>(
        TIME_TRACKER_PROJECTS_QUERY_KEY
      ) ?? loadProjects();
    const next = current.map((p) => (p.id === project.id ? project : p));
    saveProjects(next);
    queryClient.setQueryData(TIME_TRACKER_PROJECTS_QUERY_KEY, next);
  };
}

/** Deletes a goal and clears it as the parent of any project that pointed to it. */
export function useDeleteTimeTrackerGoalFromCache() {
  const queryClient = useQueryClient();
  return (goalId: string) => {
    const currentGoals =
      queryClient.getQueryData<TimeTrackerGoal[]>(TIME_TRACKER_GOALS_QUERY_KEY) ??
      loadGoals();
    const nextGoals = currentGoals.filter((g) => g.id !== goalId);
    saveGoals(nextGoals);
    queryClient.setQueryData(TIME_TRACKER_GOALS_QUERY_KEY, nextGoals);

    const currentProjects =
      queryClient.getQueryData<TimeTrackerProject[]>(
        TIME_TRACKER_PROJECTS_QUERY_KEY
      ) ?? loadProjects();
    const nextProjects = currentProjects.map((p) =>
      p.goalId === goalId ? { ...p, goalId: null } : p
    );
    saveProjects(nextProjects);
    queryClient.setQueryData(TIME_TRACKER_PROJECTS_QUERY_KEY, nextProjects);
  };
}

/** Deletes a project. */
export function useDeleteTimeTrackerProjectFromCache() {
  const queryClient = useQueryClient();
  return (projectId: string) => {
    const current =
      queryClient.getQueryData<TimeTrackerProject[]>(
        TIME_TRACKER_PROJECTS_QUERY_KEY
      ) ?? loadProjects();
    const next = current.filter((p) => p.id !== projectId);
    saveProjects(next);
    queryClient.setQueryData(TIME_TRACKER_PROJECTS_QUERY_KEY, next);
  };
}

/**
 * Pulls goals/projects derived server-side (via the backfill endpoint) into
 * localStorage, so they become usable client-side too — not just visible in
 * the list, but selectable when starting a timer. Existing local
 * goals/projects are matched by name (case/whitespace-insensitive, same as
 * the backend's uniqueness rule) and left untouched; only names with no
 * local counterpart are imported, each getting a fresh client-side id.
 */
export function useSyncTimeTrackerSubjectsFromServer() {
  const queryClient = useQueryClient();
  return async (token: string) => {
    const [serverGoals, serverProjects] = await Promise.all([
      listServerTimeTrackerGoals(token),
      listServerTimeTrackerProjects(token),
    ]);

    const mergedGoals = [...loadGoals()];
    const goalIdByServerId = new Map<number, string>();
    let goalsAdded = 0;
    for (const serverGoal of serverGoals) {
      const key = normalizeNameKey(serverGoal.name);
      const existing = mergedGoals.find(
        (g) => normalizeNameKey(g.name) === key
      );
      if (existing) {
        goalIdByServerId.set(serverGoal.id, existing.id);
        continue;
      }
      const goal: TimeTrackerGoal = {
        id: newId(),
        name: serverGoal.name,
        endDate: serverGoal.end_date ? serverGoal.end_date.slice(0, 10) : null,
      };
      mergedGoals.push(goal);
      goalIdByServerId.set(serverGoal.id, goal.id);
      goalsAdded += 1;
    }
    if (goalsAdded > 0) {
      saveGoals(mergedGoals);
    }
    queryClient.setQueryData(TIME_TRACKER_GOALS_QUERY_KEY, mergedGoals);

    const mergedProjects = [...loadProjects()];
    let projectsAdded = 0;
    for (const serverProject of serverProjects) {
      const key = normalizeNameKey(serverProject.name);
      const existing = mergedProjects.find(
        (p) => normalizeNameKey(p.name) === key
      );
      if (existing) continue;
      const project: TimeTrackerProject = {
        id: newId(),
        name: serverProject.name,
        goalId:
          serverProject.goal_id != null
            ? goalIdByServerId.get(serverProject.goal_id) ?? null
            : null,
      };
      mergedProjects.push(project);
      projectsAdded += 1;
    }
    if (projectsAdded > 0) {
      saveProjects(mergedProjects);
    }
    queryClient.setQueryData(TIME_TRACKER_PROJECTS_QUERY_KEY, mergedProjects);

    return { goalsAdded, projectsAdded };
  };
}
