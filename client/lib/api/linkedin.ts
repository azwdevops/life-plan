import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface LinkedinPage {
  id: number;
  name: string;
  is_paused: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface LinkedinPageUpdate {
  name?: string;
  is_paused?: boolean;
}

export type LinkedinDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface LinkedinPostingTime {
  id: number;
  page_id: number;
  day_of_week: LinkedinDayOfWeek;
  start_time: string | null;
  end_time: string | null;
  is_posting_day: boolean;
  updated_at: string | null;
}

export interface LinkedinPostingTimePatch {
  start_time?: string;
  end_time?: string;
  is_posting_day?: boolean;
}

export interface LinkedinPostLog {
  id: number;
  page_id: number;
  post_date: string;
  posts_count: number;
  updated_at: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function throwOnError(response: Response, fallback: string): Promise<void> {
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: fallback }));
    throw new Error(err.detail || fallback);
  }
}

export async function getLinkedinPages(token: string): Promise<LinkedinPage[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/linkedin/pages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch LinkedIn pages");
  return response.json();
}

export async function createLinkedinPage(token: string, name: string): Promise<LinkedinPage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/linkedin/pages`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  await throwOnError(response, "Failed to add page");
  return response.json();
}

export async function renameLinkedinPage(token: string, pageId: number, name: string): Promise<LinkedinPage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/linkedin/pages/${pageId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  await throwOnError(response, "Failed to rename page");
  return response.json();
}

export async function updateLinkedinPage(
  token: string,
  pageId: number,
  data: LinkedinPageUpdate
): Promise<LinkedinPage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/linkedin/pages/${pageId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  await throwOnError(response, "Failed to update page");
  return response.json();
}

export async function deleteLinkedinPage(token: string, pageId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/linkedin/pages/${pageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to remove page");
}

// Returns every day's rows for every page in one call - small (at most 7
// rows per page) and needed in full for the posting-day toggle grid
// regardless of which single day is currently selected in the UI.
export async function getLinkedinPostingTimes(token: string): Promise<LinkedinPostingTime[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/linkedin/posting-times`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch posting times");
  return response.json();
}

export async function upsertLinkedinPostingTime(
  token: string,
  pageId: number,
  day: LinkedinDayOfWeek,
  patch: LinkedinPostingTimePatch
): Promise<LinkedinPostingTime> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/linkedin/pages/${pageId}/posting-times/${day}`,
    {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    }
  );
  await throwOnError(response, "Failed to save posting time");
  return response.json();
}

export async function getLinkedinPostLogs(token: string, date: string): Promise<LinkedinPostLog[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/linkedin/post-logs?post_date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch post logs");
  return response.json();
}

export async function upsertLinkedinPostLog(
  token: string,
  pageId: number,
  date: string,
  postsCount: number
): Promise<LinkedinPostLog> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/linkedin/pages/${pageId}/post-logs/${date}`,
    {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ posts_count: postsCount }),
    }
  );
  await throwOnError(response, "Failed to save post count");
  return response.json();
}
