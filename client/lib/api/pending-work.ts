import { handleApiResponse } from "../api-utils";
import { resolveVisibleCategoryIds, type PendingWorkStore } from "../pending-work-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface PendingWorkDataApi {
  v: number;
  categories: Array<{ id: string; name: string }>;
  items: Array<{ id: string; category_id: string; title: string }>;
}

export function mapPendingWorkApiToStore(data: PendingWorkDataApi): PendingWorkStore {
  const categories = data.categories.map((c) => ({ id: c.id, name: c.name }));
  const items = data.items.map((it) => ({
    id: it.id,
    categoryId: it.category_id,
    title: it.title,
    note: "",
  }));
  const categoryIds = categories.map((c) => c.id);
  return {
    v: data.v,
    categories,
    items,
    visibleCategoryIds: resolveVisibleCategoryIds(categoryIds),
  };
}

function authJsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function pendingWorkErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchPendingWorkStore(token: string): Promise<PendingWorkStore> {
  const response = await fetch(`${API_BASE_URL}/api/v1/pending-work/`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to load pending work");
  }
  const data = (await response.json()) as PendingWorkDataApi;
  return mapPendingWorkApiToStore(data);
}

export async function postPendingCategory(
  token: string,
  name: string
): Promise<{ category: { id: string; name: string } }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/pending-work/categories`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await pendingWorkErrorMessage(response, "Failed to create category"));
  }
  return (await response.json()) as { category: { id: string; name: string } };
}

export async function patchPendingCategory(
  token: string,
  clientId: string,
  name: string
): Promise<{ id: string; name: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/pending-work/categories/${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers: authJsonHeaders(token),
      body: JSON.stringify({ name }),
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await pendingWorkErrorMessage(response, "Failed to rename category"));
  }
  return (await response.json()) as { id: string; name: string };
}

export async function deletePendingCategory(token: string, categoryClientId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/pending-work/categories/${encodeURIComponent(categoryClientId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to remove category");
  }
}

export async function postPendingItem(
  token: string,
  categoryId: string,
  title: string
): Promise<{ id: string; category_id: string; title: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/pending-work/items`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ category_id: categoryId, title }),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await pendingWorkErrorMessage(response, "Failed to create item"));
  }
  return (await response.json()) as { id: string; category_id: string; title: string };
}

export async function patchPendingItem(
  token: string,
  itemClientId: string,
  title: string
): Promise<{ id: string; category_id: string; title: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/pending-work/items/${encodeURIComponent(itemClientId)}`,
    {
      method: "PATCH",
      headers: authJsonHeaders(token),
      body: JSON.stringify({ title }),
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await pendingWorkErrorMessage(response, "Failed to rename item"));
  }
  return (await response.json()) as { id: string; category_id: string; title: string };
}

export async function deletePendingItem(token: string, itemClientId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/pending-work/items/${encodeURIComponent(itemClientId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to remove item");
  }
}
