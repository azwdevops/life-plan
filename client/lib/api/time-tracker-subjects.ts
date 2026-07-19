import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface TimeTrackerSubjectBackfillResult {
  goals_created: number;
  projects_created: number;
  projects_linked_to_goal: number;
  entries_linked: number;
}

export interface TimeTrackerGoalApiRow {
  id: number;
  name: string;
  end_date: string | null;
}

export interface TimeTrackerProjectApiRow {
  id: number;
  name: string;
  goal_id: number | null;
}

/** Derives Goal/Project rows from existing time entries and links entries to them. Safe to re-run. */
export async function backfillTimeTrackerSubjects(
  token: string
): Promise<TimeTrackerSubjectBackfillResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/backfill`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to backfill goals/projects");
  }
  return (await response.json()) as TimeTrackerSubjectBackfillResult;
}

export async function listServerTimeTrackerGoals(
  token: string
): Promise<TimeTrackerGoalApiRow[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/goals`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to load goals");
  }
  return (await response.json()) as TimeTrackerGoalApiRow[];
}

export async function listServerTimeTrackerProjects(
  token: string
): Promise<TimeTrackerProjectApiRow[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/projects`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to load projects");
  }
  return (await response.json()) as TimeTrackerProjectApiRow[];
}
