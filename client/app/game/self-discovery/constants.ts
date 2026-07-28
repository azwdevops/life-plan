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

/** Stable assessment ids (must match server `self_discovery_builtin`). */
export const SELF_DISCOVERY_TEST_IDS = [
  "self_esteem",
  "kind_of_wife",
  "attachment_style",
  "what_drives_me",
  "eq_test",
  "emotional_triggers",
  "locus_of_control",
  "self_compassion",
  "inner_critic",
  "core_wounds",
  "cognitive_distortions",
  "defense_mechanisms",
  "stoic_mindset",
  "shame_resilience",
  "boundaries",
  "values_clarification",
] as const;

export type TestId = (typeof SELF_DISCOVERY_TEST_IDS)[number];

export interface SessionData {
  questions: GameQuestion[];
  answers: string[];
  analysis?: string;
}

export interface SettingsData {
  api: GameApiProvider;
  /** Saved API provider (from Settings → API providers). */
  providerId: number;
  /** Which stored key to use for OpenRouter. */
  keyId: number;
  /** Model slug stored for that provider (exact OpenRouter model id). */
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
  return (SELF_DISCOVERY_TEST_IDS as readonly string[]).includes(testId);
}
