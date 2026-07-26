import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface GameSaveApi {
  state: Record<string, unknown>;
}

export async function getGameSave(token: string): Promise<GameSaveApi> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/game-save`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to load game" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to load game");
  }
  return response.json();
}

export async function putGameSave(
  token: string,
  state: object
): Promise<GameSaveApi> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investments/game-save`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to save game" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to save game");
  }
  return response.json();
}
