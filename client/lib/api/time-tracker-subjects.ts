import { handleApiResponse } from "../api-utils";
import type {
  TimeTrackerGoal,
  TimeTrackerProject,
  TimeTrackerCategory,
} from "@/lib/time-tracker-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
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
  category_id: number | null;
}

export interface TimeTrackerCategoryApiRow {
  id: number;
  name: string;
}

function goalRowToClient(row: TimeTrackerGoalApiRow): TimeTrackerGoal {
  return {
    id: String(row.id),
    name: row.name,
    endDate: row.end_date ? row.end_date.slice(0, 10) : null,
  };
}

function projectRowToClient(row: TimeTrackerProjectApiRow): TimeTrackerProject {
  return {
    id: String(row.id),
    name: row.name,
    goalId: row.goal_id != null ? String(row.goal_id) : null,
    categoryId: row.category_id != null ? String(row.category_id) : null,
  };
}

function categoryRowToClient(row: TimeTrackerCategoryApiRow): TimeTrackerCategory {
  return { id: String(row.id), name: row.name };
}

async function errorDetail(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.detail === "string" ? body.detail : fallback;
}

// --- Goals ---

export async function listTimeTrackerGoals(token: string): Promise<TimeTrackerGoal[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker-subjects/goals`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to load goals");
  const rows = (await response.json()) as TimeTrackerGoalApiRow[];
  return rows.map(goalRowToClient);
}

export async function createTimeTrackerGoal(
  token: string,
  body: { name: string; end_date?: string | null }
): Promise<TimeTrackerGoal> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker-subjects/goals`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to create goal"));
  return goalRowToClient((await response.json()) as TimeTrackerGoalApiRow);
}

export async function updateTimeTrackerGoal(
  token: string,
  goalId: string,
  body: Partial<{ name: string; end_date: string | null }>
): Promise<TimeTrackerGoal> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/goals/${encodeURIComponent(goalId)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to update goal"));
  return goalRowToClient((await response.json()) as TimeTrackerGoalApiRow);
}

export async function deleteTimeTrackerGoal(token: string, goalId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/goals/${encodeURIComponent(goalId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok && response.status !== 204) {
    throw new Error(await errorDetail(response, "Failed to delete goal"));
  }
}

// --- Projects ---

export async function listTimeTrackerProjects(token: string): Promise<TimeTrackerProject[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker-subjects/projects`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to load projects");
  const rows = (await response.json()) as TimeTrackerProjectApiRow[];
  return rows.map(projectRowToClient);
}

export async function createTimeTrackerProject(
  token: string,
  body: { name: string; goal_id?: number | null; category_id?: number | null }
): Promise<TimeTrackerProject> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker-subjects/projects`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to create project"));
  return projectRowToClient((await response.json()) as TimeTrackerProjectApiRow);
}

export async function updateTimeTrackerProject(
  token: string,
  projectId: string,
  body: Partial<{ name: string; goal_id: number | null; category_id: number | null }>
): Promise<TimeTrackerProject> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to update project"));
  return projectRowToClient((await response.json()) as TimeTrackerProjectApiRow);
}

export async function deleteTimeTrackerProject(token: string, projectId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/projects/${encodeURIComponent(projectId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok && response.status !== 204) {
    throw new Error(await errorDetail(response, "Failed to delete project"));
  }
}

// --- Categories ---

export async function listTimeTrackerCategories(token: string): Promise<TimeTrackerCategory[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker-subjects/categories`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to load categories");
  const rows = (await response.json()) as TimeTrackerCategoryApiRow[];
  return rows.map(categoryRowToClient);
}

export async function createTimeTrackerCategory(
  token: string,
  body: { name: string }
): Promise<TimeTrackerCategory> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker-subjects/categories`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to create category"));
  return categoryRowToClient((await response.json()) as TimeTrackerCategoryApiRow);
}

export async function updateTimeTrackerCategory(
  token: string,
  categoryId: string,
  body: Partial<{ name: string }>
): Promise<TimeTrackerCategory> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to update category"));
  return categoryRowToClient((await response.json()) as TimeTrackerCategoryApiRow);
}

export async function deleteTimeTrackerCategory(
  token: string,
  categoryId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-tracker-subjects/categories/${encodeURIComponent(categoryId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok && response.status !== 204) {
    throw new Error(await errorDetail(response, "Failed to delete category"));
  }
}
