import { handleApiResponse } from "../api-utils";
import type { TimeTrackerEntry } from "@/lib/time-tracker-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface TimeEntryApiRow {
  id: string;
  kind: "goal" | "project";
  subject_id: string;
  subject_name: string;
  parent_goal_id: string | null;
  parent_goal_name: string | null;
  description: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
}

export function apiRowToClientEntry(row: TimeEntryApiRow): TimeTrackerEntry {
  return {
    id: row.id,
    kind: row.kind,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    parentGoalId: row.parent_goal_id,
    parentGoalName: row.parent_goal_name,
    description: row.description ?? "",
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
  };
}

async function getTimeEntriesQuery(
  token: string,
  search: string
): Promise<TimeTrackerEntry[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/time-entries/?${search}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to load time entries");
  }
  const rows = (await response.json()) as TimeEntryApiRow[];
  return rows.map(apiRowToClientEntry);
}

export async function listTimeEntries(
  token: string,
  fromStartedAtIso: string,
  toStartedAtExclusiveIso: string
): Promise<TimeTrackerEntry[]> {
  const params = new URLSearchParams();
  params.set("from", fromStartedAtIso);
  params.set("to_exclusive", toStartedAtExclusiveIso);
  return getTimeEntriesQuery(token, params.toString());
}

/** Most recent rows (no date filter). */
export async function listRecentTimeEntries(
  token: string,
  limit = 2000
): Promise<TimeTrackerEntry[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  return getTimeEntriesQuery(token, params.toString());
}

export async function createTimeEntry(
  token: string,
  entry: TimeTrackerEntry
): Promise<void> {
  const body = {
    id: entry.id,
    kind: entry.kind,
    subject_id: entry.subjectId,
    subject_name: entry.subjectName,
    parent_goal_id: entry.parentGoalId,
    parent_goal_name: entry.parentGoalName,
    description: entry.description,
    started_at: entry.startedAt,
    ended_at: entry.endedAt,
    duration_ms: entry.durationMs,
  };
  const response = await fetch(`${API_BASE_URL}/api/v1/time-entries/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to save time entry");
  }
}
