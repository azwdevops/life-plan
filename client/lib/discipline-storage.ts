/** Decision / habit counters on the Productivity Discipline tab; browser-only until backend exists. */

export const DISCIPLINE_STORAGE_KEY = "life_plan_discipline";
const STORE_VERSION = 1;

export interface DisciplineCategory {
  id: string;
  /** Display label e.g. "Resisted temptation", "Right financial decision". */
  label: string;
  /** Integer; negative values are allowed (e.g. failures / setbacks). */
  count: number;
}

export interface DisciplineStore {
  v: number;
  categories: DisciplineCategory[];
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyDisciplineStore(): DisciplineStore {
  return { v: STORE_VERSION, categories: [] };
}

export function loadDisciplineStore(): DisciplineStore {
  if (typeof window === "undefined") return createEmptyDisciplineStore();
  try {
    const raw = localStorage.getItem(DISCIPLINE_STORAGE_KEY);
    if (!raw?.trim()) return createEmptyDisciplineStore();
    const o = JSON.parse(raw) as Partial<DisciplineStore>;
    if (o.v !== STORE_VERSION || !Array.isArray(o.categories)) {
      return createEmptyDisciplineStore();
    }
    const categories: DisciplineCategory[] = o.categories
      .filter((c) => c && typeof c === "object" && typeof (c as DisciplineCategory).id === "string")
      .map((c) => {
        const label = String((c as DisciplineCategory).label ?? "").trim() || "Untitled";
        let count = Number((c as DisciplineCategory).count);
        if (!Number.isFinite(count)) count = 0;
        count = Math.trunc(count);
        return {
          id: String((c as DisciplineCategory).id),
          label,
          count,
        };
      });
    return { v: STORE_VERSION, categories };
  } catch {
    return createEmptyDisciplineStore();
  }
}

export function saveDisciplineStore(store: DisciplineStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISCIPLINE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function isDisciplineLabelTaken(
  store: DisciplineStore,
  label: string,
  excludeCategoryId?: string
): boolean {
  const key = label.trim().toLowerCase();
  if (!key) return false;
  return store.categories.some(
    (c) => c.id !== excludeCategoryId && c.label.trim().toLowerCase() === key
  );
}

export function addDisciplineCategory(store: DisciplineStore, label: string): DisciplineStore {
  const trimmed = label.trim();
  if (!trimmed) return store;
  return {
    ...store,
    categories: [...store.categories, { id: newId(), label: trimmed, count: 0 }],
  };
}

export function removeDisciplineCategory(store: DisciplineStore, categoryId: string): DisciplineStore {
  return {
    ...store,
    categories: store.categories.filter((c) => c.id !== categoryId),
  };
}

export function renameDisciplineCategory(store: DisciplineStore, categoryId: string, label: string): DisciplineStore {
  const trimmed = label.trim();
  if (!trimmed) return store;
  if (!store.categories.some((c) => c.id === categoryId)) return store;
  return {
    ...store,
    categories: store.categories.map((c) => (c.id === categoryId ? { ...c, label: trimmed } : c)),
  };
}

/** Display order: alphabetical by label (case-insensitive). */
export function sortDisciplineCategoriesByLabel(categories: DisciplineCategory[]): DisciplineCategory[] {
  return [...categories].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function adjustDisciplineCount(store: DisciplineStore, categoryId: string, delta: number): DisciplineStore {
  if (delta === 0) return store;
  return {
    ...store,
    categories: store.categories.map((c) => {
      if (c.id !== categoryId) return c;
      return { ...c, count: c.count + delta };
    }),
  };
}
