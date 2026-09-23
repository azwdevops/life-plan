import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface DailyProductiveItemApi {
  id: string;
  item_date: string;
  text: string;
  is_done: boolean;
}

export interface DailyProductiveItemListApi {
  item_date: string;
  editable: boolean;
  items: DailyProductiveItemApi[];
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getYesterdayIsoDate(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isEditableIsoDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return diffDays >= -7 && diffDays <= 7;
}

function authJsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function dailyProductiveItemsErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchDailyProductiveItems(
  token: string,
  itemDate: string
): Promise<DailyProductiveItemListApi> {
  const qs = new URLSearchParams({ item_date: itemDate });
  const response = await fetch(`${API_BASE_URL}/api/v1/daily-productive-items/?${qs.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await dailyProductiveItemsErrorMessage(response, "Failed to load list"));
  }
  return (await response.json()) as DailyProductiveItemListApi;
}

export async function createDailyProductiveItem(
  token: string,
  itemDate: string,
  text: string
): Promise<DailyProductiveItemApi> {
  const response = await fetch(`${API_BASE_URL}/api/v1/daily-productive-items/`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ item_date: itemDate, text }),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await dailyProductiveItemsErrorMessage(response, "Failed to add item"));
  }
  return (await response.json()) as DailyProductiveItemApi;
}

export async function reorderDailyProductiveItems(
  token: string,
  itemDate: string,
  orderedIds: string[]
): Promise<DailyProductiveItemListApi> {
  const response = await fetch(`${API_BASE_URL}/api/v1/daily-productive-items/reorder`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ item_date: itemDate, ordered_ids: orderedIds }),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await dailyProductiveItemsErrorMessage(response, "Failed to reorder items"));
  }
  return (await response.json()) as DailyProductiveItemListApi;
}

export async function patchDailyProductiveItem(
  token: string,
  clientId: string,
  patch: { text?: string; is_done?: boolean; item_date?: string }
): Promise<DailyProductiveItemApi> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/daily-productive-items/${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers: authJsonHeaders(token),
      body: JSON.stringify(patch),
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await dailyProductiveItemsErrorMessage(response, "Failed to update item"));
  }
  return (await response.json()) as DailyProductiveItemApi;
}

export async function deleteDailyProductiveItem(token: string, clientId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/daily-productive-items/${encodeURIComponent(clientId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await dailyProductiveItemsErrorMessage(response, "Failed to delete item"));
  }
}
