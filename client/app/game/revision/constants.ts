import type { RevisionApiProvider } from "@/lib/api/revision";
import type { RevisionQuestion } from "@/lib/api/revision";

/** Single key for the current revision session. Generating new questions replaces this. */
export const REVISION_SESSION_KEY = "revision_session";
export const REVISION_SETTINGS_KEY = "revision_settings";

export const REVISION_CATEGORIES = [
  { value: "theory", label: "Theory" },
  { value: "code", label: "Code" },
] as const;

export const PROGRAMMING_LANGUAGES = [
  { value: "C", label: "C" },
  { value: "C#", label: "C#" },
  { value: "C++", label: "C++" },
  { value: "Go", label: "Go" },
  { value: "Java", label: "Java" },
  { value: "JavaScript", label: "JavaScript" },
  { value: "Python", label: "Python" },
  { value: "Rust", label: "Rust" },
  { value: "TypeScript", label: "TypeScript" },
] as const;

export const API_OPTIONS: { value: RevisionApiProvider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
];

export const MODELS_BY_PROVIDER: Record<RevisionApiProvider, { value: string; label: string }[]> = {
  openrouter: [
    { value: "arcee-ai/trinity-large-preview:free", label: "Arcee Trinity Large (free)" },
  ],
};

export interface RevisionSessionData {
  id: string;
  category: string;
  programmingLanguage: string;
  api: RevisionApiProvider;
  model: string;
  createdAt: number;
  questions: RevisionQuestion[];
  answers: string[];
  analysis?: string;
}

/** Returns the current revision session (single key). Used on list page to show "Continue questions". */
export function getCurrentRevisionSession(): RevisionSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REVISION_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RevisionSessionData;
  } catch {
    return null;
  }
}

/** Saves the revision session. Replaces any existing session (one key for all). */
export function saveRevisionSession(data: RevisionSessionData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REVISION_SESSION_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** Loads the session only if the stored session id matches. Used on session page to validate URL. */
export function loadRevisionSession(sessionId: string): RevisionSessionData | null {
  const data = getCurrentRevisionSession();
  if (!data || data.id !== sessionId) return null;
  return data;
}

export interface RevisionSettingsData {
  api: RevisionApiProvider;
  model: string;
}

export function loadRevisionSettings(): RevisionSettingsData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REVISION_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RevisionSettingsData;
  } catch {
    return null;
  }
}

export function saveRevisionSettings(data: RevisionSettingsData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REVISION_SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function createSessionId(): string {
  return `rev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
