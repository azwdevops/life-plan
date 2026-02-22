const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export type GameApiProvider = "openrouter";

export interface QuestionOption {
  key: string;
  text: string;
}

export interface GameQuestion {
  question: string;
  options: QuestionOption[];
}

export interface GenerateQuestionsResponse {
  questions: GameQuestion[];
}

export async function generateQuestions(
  testId: string,
  api: GameApiProvider = "openrouter",
  model?: string
): Promise<GenerateQuestionsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/game/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_id: testId, api, model: model || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to generate questions");
  }
  return res.json();
}

export interface AnalyzeResponse {
  analysis: string;
}

export async function analyze(
  testId: string,
  questions: { question: string; options: { key: string; text: string }[] }[],
  answers: string[],
  api: GameApiProvider = "openrouter",
  model?: string
): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/game/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      test_id: testId,
      questions: questions.map((q) => ({ question: q.question, options: q.options })),
      answers,
      api,
      model: model || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to get analysis");
  }
  return res.json();
}
