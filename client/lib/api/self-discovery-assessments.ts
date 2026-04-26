import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export type SelfDiscoveryAssessmentCard = {
  test_id: string;
  title: string;
  tagline: string;
  sort_order: number;
};

export type SelfDiscoveryAssessmentDetail = {
  test_id: string;
  title: string;
  tagline: string;
  questions_instruction_html: string;
  analysis_instruction_html: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
  /** OpenRouter request JSON with {{name}}; AI schedule; null/omit = server default. */
  llm_request_body_template?: string | null;
};

export type SelfDiscoveryAssessmentListKind = "self_discovery" | "ai_schedule";

export async function listSelfDiscoveryAssessments(
  token: string,
  kind: SelfDiscoveryAssessmentListKind = "self_discovery"
): Promise<SelfDiscoveryAssessmentCard[]> {
  const q = kind === "self_discovery" ? "" : `?kind=${encodeURIComponent(kind)}`;
  const response = await fetch(`${API_BASE_URL}/api/v1/game/self-discovery/assessments${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to load assessments");
  return response.json();
}

export async function getSelfDiscoveryAssessment(
  token: string,
  testId: string
): Promise<SelfDiscoveryAssessmentDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/game/self-discovery/assessments/${encodeURIComponent(testId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) throw new Error("Failed to load assessment");
  return response.json();
}

export async function updateSelfDiscoveryAssessment(
  token: string,
  testId: string,
  body: {
    title: string;
    tagline: string;
    questions_instruction_html: string;
    analysis_instruction_html: string;
    sort_order: number;
    llm_request_body_template?: string;
  }
): Promise<SelfDiscoveryAssessmentDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/game/self-discovery/assessments/${encodeURIComponent(testId)}`,
    {
      method: "PUT",
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
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save assessment";
    throw new Error(msg);
  }
  return response.json();
}
