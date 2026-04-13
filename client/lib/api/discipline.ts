import { handleApiResponse } from "../api-utils";
import type { DisciplineStore } from "../discipline-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface DisciplineStoreApi {
  v: number;
  categories: Array<{ id: string; label: string; count: number }>;
}

export function mapDisciplineApiToStore(data: DisciplineStoreApi): DisciplineStore {
  return {
    v: data.v,
    categories: data.categories.map((c) => ({
      id: c.id,
      label: c.label,
      count: Number.isFinite(c.count) ? Math.trunc(c.count) : 0,
    })),
  };
}

function authJsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function disciplineErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchDisciplineStore(token: string): Promise<DisciplineStore> {
  const response = await fetch(`${API_BASE_URL}/api/v1/discipline/`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to load discipline data");
  }
  const data = (await response.json()) as DisciplineStoreApi;
  return mapDisciplineApiToStore(data);
}

export async function postDisciplineTrack(
  token: string,
  label: string
): Promise<{ id: string; label: string; count: number }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/discipline/tracks`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ label }),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await disciplineErrorMessage(response, "Failed to create track"));
  }
  return (await response.json()) as { id: string; label: string; count: number };
}

export async function patchDisciplineTrack(
  token: string,
  clientId: string,
  body: { label?: string; count?: number }
): Promise<{ id: string; label: string; count: number }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/discipline/tracks/${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers: authJsonHeaders(token),
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await disciplineErrorMessage(response, "Failed to update track"));
  }
  return (await response.json()) as { id: string; label: string; count: number };
}

export async function deleteDisciplineTrack(token: string, clientId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/discipline/tracks/${encodeURIComponent(clientId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await disciplineErrorMessage(response, "Failed to remove track"));
  }
}
