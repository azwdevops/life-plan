import { handleApiResponse } from "../api-utils";
import type { TimeTrackerEntry, TimeTrackerSession } from "@/lib/time-tracker-storage";
import { apiRowToClientEntry, type TimeEntryApiRow } from "./time-entries";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

interface ActiveSessionApiRow {
  kind: "goal" | "project";
  goal_id: number | null;
  project_id: number | null;
  category_id: number | null;
  category_name: string | null;
  subject_name: string;
  parent_goal_id: string | null;
  parent_goal_name: string | null;
  description: string;
  started_at: string;
  accumulated_pause_ms: number;
  pause_started_at: string | null;
}

function apiRowToSession(row: ActiveSessionApiRow): TimeTrackerSession {
  return {
    kind: row.kind,
    subjectId: String(row.kind === "goal" ? row.goal_id : row.project_id),
    subjectName: row.subject_name,
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? null,
    parentGoalId: row.parent_goal_id,
    parentGoalName: row.parent_goal_name,
    description: row.description ?? "",
    startedAt: row.started_at,
    accumulatedPauseMs: row.accumulated_pause_ms,
    pauseStartedAt: row.pause_started_at,
  };
}

async function errorDetail(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.detail === "string" ? body.detail : fallback;
}

export async function getActiveSession(token: string): Promise<TimeTrackerSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker/active-session`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to load active session");
  const data = (await response.json()) as ActiveSessionApiRow | null;
  return data ? apiRowToSession(data) : null;
}

export interface StartActiveSessionBody {
  kind: "goal" | "project";
  goal_id?: number | null;
  project_id?: number | null;
  subject_name: string;
  parent_goal_id?: string | null;
  parent_goal_name?: string | null;
  description?: string;
}

export interface StartActiveSessionResult {
  session: TimeTrackerSession;
  autoClosedEntry: TimeTrackerEntry | null;
}

export async function startActiveSession(
  token: string,
  body: StartActiveSessionBody
): Promise<StartActiveSessionResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker/active-session/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to start timer"));
  const data = (await response.json()) as {
    active_session: ActiveSessionApiRow;
    auto_closed_entry: TimeEntryApiRow | null;
  };
  return {
    session: apiRowToSession(data.active_session),
    autoClosedEntry: data.auto_closed_entry ? apiRowToClientEntry(data.auto_closed_entry) : null,
  };
}

export async function stopActiveSession(token: string): Promise<TimeTrackerEntry> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker/active-session/stop`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to stop timer"));
  return apiRowToClientEntry((await response.json()) as TimeEntryApiRow);
}

export async function patchActiveSession(
  token: string,
  body: Partial<{ action: "pause" | "resume"; description: string }>
): Promise<TimeTrackerSession> {
  const response = await fetch(`${API_BASE_URL}/api/v1/time-tracker/active-session`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error(await errorDetail(response, "Failed to update timer"));
  return apiRowToSession((await response.json()) as ActiveSessionApiRow);
}
