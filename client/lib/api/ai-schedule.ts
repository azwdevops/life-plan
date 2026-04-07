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

export interface StartAiScheduleJobResponse {
  job_id: string;
  status: "processing";
  message: string;
}

export type AiScheduleJobStatusResponse =
  | {
      status: "processing";
      message?: string | null;
    }
  | {
      status: "completed";
      blocks: ScheduleBlockApi[];
      tips?: string | null;
    }
  | {
      status: "failed";
      error: string;
    };

async function parseErrorResponse(response: Response): Promise<string> {
  const raw = await response.text();
  let message = response.statusText || "Request failed";
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    if (typeof parsed.detail === "string") message = parsed.detail;
  } catch {
    if (
      response.status === 504 ||
      /\b504\b|Gateway time-out|cf-error-details|cloudflare/i.test(raw)
    ) {
      message =
        "Gateway timed out. If this was a quick request, check your network; long-running work uses Check status instead.";
    }
  }
  return message;
}

export async function startAiScheduleJob(
  token: string,
  body: {
    activities: AiDayScheduleActivityIn[];
    now_iso: string;
    end_of_day_iso: string;
    timezone_name: string;
    model?: string;
  }
): Promise<StartAiScheduleJobResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ai-schedule/plan/start`, {
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
    throw new Error(await parseErrorResponse(response));
  }
  return response.json() as Promise<StartAiScheduleJobResponse>;
}

export async function getAiScheduleJobStatus(
  token: string,
  jobId: string
): Promise<AiScheduleJobStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ai-schedule/plan/jobs/${encodeURIComponent(jobId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json() as Promise<AiScheduleJobStatusResponse>;
}
