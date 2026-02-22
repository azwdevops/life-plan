import type { GameApiProvider } from "@/lib/api/game";
import type { GameQuestion } from "@/lib/api/game";

export const STORAGE_KEY_PREFIX = "self_discovery_";
export const SETTINGS_KEY = "self_discovery_settings";

export const API_OPTIONS: { value: GameApiProvider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
];

export const MODELS_BY_PROVIDER: Record<GameApiProvider, { value: string; label: string }[]> = {
  openrouter: [
    { value: "arcee-ai/trinity-large-preview:free", label: "Arcee Trinity Large (free)" },
  ],
};

export const TESTS = [
  { id: "self_esteem", name: "Self Esteem Test", description: "Understand my self-worth and areas to grow." },
  { id: "kind_of_wife", name: "Kind of Wife I'm Looking For", description: "Discover the kind of wife that fits me, traits, values, and how she'd complement my life." },
  { id: "attachment_style", name: "My Attachment Style", description: "Understand my attachment style in relationships (secure, anxious, avoidant, or mixed) and what it means for me." },
  { id: "what_drives_me", name: "What Drives Me to Pursue Something", description: "Discover what really drives me to pursue goals, projects, and endeavours and what it means for how I show up." },
] as const;

export type TestId = (typeof TESTS)[number]["id"];

export interface SessionData {
  questions: GameQuestion[];
  answers: string[];
  analysis?: string;
}

export interface SettingsData {
  api: GameApiProvider;
  model: string;
}

export function loadSession(testId: string): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${testId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function saveSession(testId: string, data: SessionData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${testId}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadSettings(): SettingsData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SettingsData;
  } catch {
    return null;
  }
}

export function saveSettings(data: SettingsData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function isValidTestId(testId: string): testId is TestId {
  return TESTS.some((t) => t.id === testId);
}
