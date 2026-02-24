const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export type RevisionApiProvider = "openrouter";

export interface RevisionQuestionOption {
  key: string;
  text: string;
}

export interface RevisionQuestion {
  question: string;
  options: RevisionQuestionOption[];
}

export interface RevisionGenerateResponse {
  questions: RevisionQuestion[];
}

export async function generateRevisionQuestions(
  category: string,
  programmingLanguage: string,
  api: RevisionApiProvider = "openrouter",
  model?: string
): Promise<RevisionGenerateResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/game/revision/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category,
      programming_language: programmingLanguage,
      api,
      model: model || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to generate revision questions");
  }
  return res.json();
}

export interface RevisionAnalyzeResponse {
  analysis: string;
}

export async function analyzeRevision(
  category: string,
  programmingLanguage: string,
  questions: { question: string; options: { key: string; text: string }[] }[],
  answers: string[],
  api: RevisionApiProvider = "openrouter",
  model?: string
): Promise<RevisionAnalyzeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/game/revision/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category,
      programming_language: programmingLanguage,
      questions: questions.map((q) => ({ question: q.question, options: q.options })),
      answers,
      api,
      model: model || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to get revision analysis");
  }
  return res.json();
}
