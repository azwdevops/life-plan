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

/** Stored credentials for OpenRouter (self-discovery). */
export type GameSavedCredentials = {
  providerId: number;
  keyId: number;
};

export async function generateQuestions(
  testId: string,
  api: GameApiProvider = "openrouter",
  model?: string,
  opts?: { token?: string; credentials?: GameSavedCredentials }
): Promise<GenerateQuestionsResponse> {
  const body: Record<string, unknown> = {
    test_id: testId,
    api,
    model: model || undefined,
  };
  if (opts?.credentials) {
    body.provider_id = opts.credentials.providerId;
    body.key_id = opts.credentials.keyId;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_BASE_URL}/api/v1/game/generate-questions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const d = err.detail;
    const msg =
      typeof d === "string" ? d : Array.isArray(d) ? d.map((x: { msg?: string }) => x?.msg).join(", ") : res.statusText;
    throw new Error(msg || "Failed to generate questions");
  }
  return res.json();
}

export interface AnalyzeResponse {
  analysis: string;
}

export interface PostingLedger {
  id: number;
  name: string;
}

export interface PostingSuggestionEntry {
  ledger_id: number;
  entry_type: "DEBIT" | "CREDIT";
  amount: number;
  note?: string | null;
}

export interface PostingSuggestionResponse {
  transaction_type: "MONEY_RECEIVED" | "MONEY_PAID" | "JOURNAL";
  transaction_date?: string | null;
  reference?: string | null;
  entries: PostingSuggestionEntry[];
}

export async function analyze(
  testId: string,
  questions: { question: string; options: { key: string; text: string }[] }[],
  answers: string[],
  api: GameApiProvider = "openrouter",
  model?: string,
  opts?: { token?: string; credentials?: GameSavedCredentials }
): Promise<AnalyzeResponse> {
  const payload: Record<string, unknown> = {
    test_id: testId,
    questions: questions.map((q) => ({ question: q.question, options: q.options })),
    answers,
    api,
    model: model || undefined,
  };
  if (opts?.credentials) {
    payload.provider_id = opts.credentials.providerId;
    payload.key_id = opts.credentials.keyId;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_BASE_URL}/api/v1/game/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const d = err.detail;
    const msg =
      typeof d === "string" ? d : Array.isArray(d) ? d.map((x: { msg?: string }) => x?.msg).join(", ") : res.statusText;
    throw new Error(msg || "Failed to get analysis");
  }
  return res.json();
}

export async function suggestPosting(
  description: string,
  ledgers: PostingLedger[],
  api: GameApiProvider = "openrouter",
  model?: string
): Promise<PostingSuggestionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/game/suggest-posting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description,
      ledgers,
      api,
      model: model || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to generate posting suggestion");
  }
  return res.json();
}
