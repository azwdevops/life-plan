import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export type ScheduleBlockKind = "task" | "break" | "buffer" | "lunch";

export interface ScheduleBlockApi {
  start_iso: string;
  end_iso: string;
  title: string;
  kind: ScheduleBlockKind;
}

export interface AiDayScheduleActivityIn {
  title: string;
  /** null = unlimited separate blocks */
  max_repetitions: number | null;
  /** Max length of any single block for this activity (minutes). Default 40 on API if omitted. */
  max_duration_minutes: number;
}

export interface AiDayScheduleResponseApi {
  blocks: ScheduleBlockApi[];
  tips?: string | null;
}

export async function requestAiDaySchedule(
  token: string,
  body: {
    activities: AiDayScheduleActivityIn[];
    now_iso: string;
    end_of_day_iso: string;
    timezone_name: string;
    model?: string;
  }
): Promise<AiDayScheduleResponseApi> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ai-schedule/plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      activities: body.activities.map((a) => ({
        title: a.title,
        max_repetitions: a.max_repetitions,
        max_duration_minutes: a.max_duration_minutes,
      })),
      now_iso: body.now_iso,
      end_of_day_iso: body.end_of_day_iso,
      timezone_name: body.timezone_name,
      api: "openrouter",
      model: body.model || undefined,
    }),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to build schedule");
  }
  return response.json();
}
