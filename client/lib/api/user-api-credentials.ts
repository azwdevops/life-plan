import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface ApiKeyMasked {
  id: number;
  provider_id: number;
  name: string;
  value_masked: string;
  expires_on: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ApiProviderModelOut {
  id: number;
  provider_id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string | null;
}

export interface ApiProviderOut {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string | null;
  keys: ApiKeyMasked[];
  models: ApiProviderModelOut[];
}

export async function listApiProviders(token: string): Promise<ApiProviderOut[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/settings/api-providers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to load API providers");
  const rows = (await response.json()) as ApiProviderOut[];
  return rows.map((r) => ({ ...r, models: r.models ?? [], keys: r.keys ?? [] }));
}

export async function createApiProvider(token: string, name: string): Promise<ApiProviderOut> {
  const response = await fetch(`${API_BASE_URL}/api/v1/settings/api-providers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to create provider");
  }
  return response.json();
}

export async function updateApiProvider(
  token: string,
  providerId: number,
  name: string
): Promise<ApiProviderOut> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to update provider");
  }
  return response.json();
}

export async function deleteApiProvider(token: string, providerId: number): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to delete provider");
  }
}

export async function createApiKey(
  token: string,
  providerId: number,
  body: { name: string; value: string; expires_on?: string | null }
): Promise<ApiKeyMasked> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}/keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to create key");
  }
  return response.json();
}

export async function updateApiKey(
  token: string,
  providerId: number,
  keyId: number,
  body: { name?: string; value?: string; expires_on?: string | null }
): Promise<ApiKeyMasked> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}/keys/${encodeURIComponent(String(keyId))}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to update key");
  }
  return response.json();
}

export async function deleteApiKey(
  token: string,
  providerId: number,
  keyId: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}/keys/${encodeURIComponent(String(keyId))}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to delete key");
  }
}

export async function createApiProviderModel(
  token: string,
  providerId: number,
  body: { name: string; slug: string }
): Promise<ApiProviderModelOut> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}/models`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to create model");
  }
  return response.json();
}

export async function updateApiProviderModel(
  token: string,
  providerId: number,
  modelId: number,
  body: { name?: string; slug?: string }
): Promise<ApiProviderModelOut> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}/models/${encodeURIComponent(String(modelId))}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to update model");
  }
  return response.json();
}

export async function deleteApiProviderModel(
  token: string,
  providerId: number,
  modelId: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/api-providers/${encodeURIComponent(String(providerId))}/models/${encodeURIComponent(String(modelId))}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to delete model");
  }
}
