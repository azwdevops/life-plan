const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface RunSessionStartRequest {
  speed_kmh: number;
  tick_interval_seconds?: number;
}

export interface RunSessionCompleteRequest {
  duration_seconds: number;
  tick_interval_seconds: number;
}

export interface RunSessionResponse {
  id: number;
  user_id: number;
  speed_kmh: number;
  duration_seconds: number;
  tick_interval_seconds: number;
  distance_km: number;
  calories_kcal: number;
  fat_equiv_kg: number;
  is_completed: boolean;
  created_at: string;
}

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const err = (await response.json()) as { detail?: unknown };
    const d = err.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d))
      return d.map((x: { msg?: string }) => x.msg).filter(Boolean).join("; ");
  } catch {
    /* ignore */
  }
  return "Request failed";
}

export async function startRunSession(
  token: string,
  body: RunSessionStartRequest
): Promise<RunSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/run-sessions/start`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      speed_kmh: body.speed_kmh,
      tick_interval_seconds: body.tick_interval_seconds ?? 3,
    }),
  });
  if (!response.ok) {
    throw new Error(
      (await parseErrorDetail(response)) || "Failed to start run on server"
    );
  }
  return response.json();
}

export async function completeRunSession(
  token: string,
  sessionId: number,
  body: RunSessionCompleteRequest
): Promise<RunSessionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/run-sessions/${sessionId}/complete`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error((await parseErrorDetail(response)) || "Failed to save run");
  }
  return response.json();
}

export async function listRunSessions(
  token: string,
  limit = 50
): Promise<RunSessionResponse[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/run-sessions?limit=${limit}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load run history");
  }
  return response.json();
}

export async function deleteRunSession(
  token: string,
  sessionId: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/run-sessions/${sessionId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) {
    throw new Error((await parseErrorDetail(response)) || "Failed to delete run");
  }
}
