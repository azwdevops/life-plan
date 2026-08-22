import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface YoutubeChannelStat {
  id: number;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  watch_time_hours: number | null;
  month_to_date_views: number | null;
  synced_at: string;
}

export interface YoutubeChannel {
  id: number;
  account_id: number;
  youtube_channel_id: string;
  title: string;
  thumbnail_url: string | null;
  is_monetized: boolean;
  estimated_rpm: number | null;
  studio_url: string;
  latest_stat: YoutubeChannelStat | null;
  created_at: string;
  updated_at: string | null;
}

export interface YoutubeAccount {
  id: number;
  google_email: string;
  group_label: string | null;
  channels: YoutubeChannel[];
  created_at: string;
}

export interface YoutubeChannelUpdate {
  is_monetized?: boolean;
  estimated_rpm?: number | null;
}

export interface YoutubeAccountUpdate {
  group_label?: string | null;
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

export async function getYoutubeOAuthUrl(token: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/youtube/oauth/authorize`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to start Google connection");
  const data = await response.json();
  return data.url;
}

export async function getYoutubeAccounts(token: string): Promise<YoutubeAccount[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/youtube/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch connected accounts");
  return response.json();
}

export async function updateYoutubeAccount(
  token: string,
  accountId: number,
  data: YoutubeAccountUpdate
): Promise<YoutubeAccount> {
  const response = await fetch(`${API_BASE_URL}/api/v1/youtube/accounts/${accountId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  await throwOnError(response, "Failed to update account");
  return response.json();
}

export async function disconnectYoutubeAccount(token: string, accountId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/youtube/accounts/${accountId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to disconnect account");
}

export async function syncYoutubeChannel(token: string, channelId: number): Promise<YoutubeChannel> {
  const response = await fetch(`${API_BASE_URL}/api/v1/youtube/channels/${channelId}/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to sync channel");
  return response.json();
}

export async function getYoutubeChannelStats(token: string, channelId: number): Promise<YoutubeChannelStat[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/youtube/channels/${channelId}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch channel history");
  return response.json();
}

export async function updateYoutubeChannel(
  token: string,
  channelId: number,
  data: YoutubeChannelUpdate
): Promise<YoutubeChannel> {
  const response = await fetch(`${API_BASE_URL}/api/v1/youtube/channels/${channelId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  await throwOnError(response, "Failed to update channel");
  return response.json();
}
