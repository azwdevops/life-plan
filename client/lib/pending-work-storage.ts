/** Local pending tasks grouped by category; kanban boards on the Productivity page. */

export const PENDING_WORK_STORAGE_KEY = "life_plan_pending_work";
/** Which category columns are shown; device-local when categories/items sync from the API. */
export const PENDING_WORK_VISIBILITY_KEY = "life_plan_pending_work_visible";
const STORE_VERSION = 1;

export interface PendingWorkCategory {
  id: string;
  name: string;
}

export interface PendingWorkItem {
  id: string;
  categoryId: string;
  title: string;
  note: string;
}

export interface PendingWorkStore {
  v: number;
  categories: PendingWorkCategory[];
  items: PendingWorkItem[];
  /** Category ids whose columns are shown; must reference existing categories. */
  visibleCategoryIds: string[];
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyPendingWorkStore(): PendingWorkStore {
  return { v: STORE_VERSION, categories: [], items: [], visibleCategoryIds: [] };
}

export function loadPendingWorkStore(): PendingWorkStore {
  if (typeof window === "undefined") return createEmptyPendingWorkStore();
  try {
    const raw = localStorage.getItem(PENDING_WORK_STORAGE_KEY);
    if (!raw?.trim()) return createEmptyPendingWorkStore();
    const o = JSON.parse(raw) as Partial<PendingWorkStore>;
    if (o.v !== STORE_VERSION || !Array.isArray(o.categories) || !Array.isArray(o.items)) {
      return createEmptyPendingWorkStore();
    }
    const categories: PendingWorkCategory[] = o.categories
      .filter((c) => c && typeof c === "object" && typeof (c as PendingWorkCategory).id === "string")
      .map((c) => ({
        id: String((c as PendingWorkCategory).id),
        name: String((c as PendingWorkCategory).name ?? "").trim() || "Untitled",
      }));
    const catIds = new Set(categories.map((c) => c.id));
    const items: PendingWorkItem[] = o.items
      .filter(
        (it) =>
          it &&
          typeof it === "object" &&
          typeof (it as PendingWorkItem).id === "string" &&
          catIds.has(String((it as PendingWorkItem).categoryId))
      )
      .map((it) => ({
        id: String((it as PendingWorkItem).id),
        categoryId: String((it as PendingWorkItem).categoryId),
        title: String((it as PendingWorkItem).title ?? "").trim() || "Untitled",
        note: String((it as PendingWorkItem).note ?? "").trim(),
      }));
    let visibleCategoryIds: string[];
    if (!Array.isArray(o.visibleCategoryIds)) {
      visibleCategoryIds = categories.length > 0 ? categories.map((c) => c.id) : [];
    } else {
      visibleCategoryIds = o.visibleCategoryIds.filter((id) => typeof id === "string" && catIds.has(id));
    }
    return { v: STORE_VERSION, categories, items, visibleCategoryIds };
  } catch {
    return createEmptyPendingWorkStore();
  }
}

export function savePendingWorkStore(store: PendingWorkStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_WORK_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

/** Persisted list of category ids with visible columns (API-backed mode). Missing key = treat as “all visible”. */
export function savePendingWorkVisibility(visibleCategoryIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_WORK_VISIBILITY_KEY, JSON.stringify(visibleCategoryIds));
  } catch {
    // ignore
  }
}

/**
 * Resolves visible column ids for the current category id set.
 * If nothing is stored yet, every category id is shown (same default as the full local store).
 */
export function resolveVisibleCategoryIds(categoryIds: string[]): string[] {
  if (typeof window === "undefined") {
    return categoryIds.length ? [...categoryIds] : [];
  }
  try {
    const raw = localStorage.getItem(PENDING_WORK_VISIBILITY_KEY);
    if (raw === null || !raw.trim()) {
      return categoryIds.length ? [...categoryIds] : [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return categoryIds.length ? [...categoryIds] : [];
    }
    const asStrings = parsed.filter((x): x is string => typeof x === "string");
    const valid = new Set(categoryIds);
    return asStrings.filter((id) => valid.has(id));
  } catch {
    return categoryIds.length ? [...categoryIds] : [];
  }
}

export function isPendingCategoryNameTaken(
  store: PendingWorkStore,
  name: string,
  excludeCategoryId?: string
): boolean {
  const key = name.trim().toLowerCase();
  if (!key) return false;
  return store.categories.some(
    (c) => c.id !== excludeCategoryId && c.name.trim().toLowerCase() === key
  );
}

export function isPendingItemTitleTakenInCategory(
  store: PendingWorkStore,
  categoryId: string,
  title: string,
  excludeItemId?: string
): boolean {
  const key = title.trim().toLowerCase();
  if (!key) return false;
  return store.items.some(
    (i) =>
      i.categoryId === categoryId &&
      i.id !== excludeItemId &&
      i.title.trim().toLowerCase() === key
  );
}

export function addPendingCategory(store: PendingWorkStore, name: string): PendingWorkStore {
  const trimmed = name.trim();
  if (!trimmed) return store;
  const id = newId();
  return {
    ...store,
    categories: [...store.categories, { id, name: trimmed }],
    visibleCategoryIds: store.visibleCategoryIds.includes(id)
      ? store.visibleCategoryIds
      : [...store.visibleCategoryIds, id],
  };
}

export function addPendingItem(store: PendingWorkStore, categoryId: string, title: string): PendingWorkStore {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return store;
  if (!store.categories.some((c) => c.id === categoryId)) return store;
  const id = newId();
  return {
    ...store,
    items: [
      ...store.items,
      {
        id,
        categoryId,
        title: trimmedTitle,
        note: "",
      },
    ],
  };
}

export function removePendingItem(store: PendingWorkStore, itemId: string): PendingWorkStore {
  return {
    ...store,
    items: store.items.filter((i) => i.id !== itemId),
  };
}

export function removePendingCategory(store: PendingWorkStore, categoryId: string): PendingWorkStore {
  if (!store.categories.some((c) => c.id === categoryId)) return store;
  return {
    ...store,
    categories: store.categories.filter((c) => c.id !== categoryId),
    items: store.items.filter((i) => i.categoryId !== categoryId),
    visibleCategoryIds: store.visibleCategoryIds.filter((id) => id !== categoryId),
  };
}

export function renamePendingCategory(store: PendingWorkStore, categoryId: string, name: string): PendingWorkStore {
  const trimmed = name.trim();
  if (!trimmed) return store;
  if (!store.categories.some((c) => c.id === categoryId)) return store;
  return {
    ...store,
    categories: store.categories.map((c) => (c.id === categoryId ? { ...c, name: trimmed } : c)),
  };
}

export function renamePendingItem(store: PendingWorkStore, itemId: string, title: string): PendingWorkStore {
  const trimmed = title.trim();
  if (!trimmed) return store;
  return {
    ...store,
    items: store.items.map((i) => (i.id === itemId ? { ...i, title: trimmed } : i)),
  };
}

export function toggleVisibleCategory(store: PendingWorkStore, categoryId: string): PendingWorkStore {
  const has = store.visibleCategoryIds.includes(categoryId);
  return {
    ...store,
    visibleCategoryIds: has
      ? store.visibleCategoryIds.filter((id) => id !== categoryId)
      : [...store.visibleCategoryIds, categoryId],
  };
}

export function setAllCategoriesVisible(store: PendingWorkStore, visible: boolean): PendingWorkStore {
  return {
    ...store,
    visibleCategoryIds: visible ? store.categories.map((c) => c.id) : [],
  };
}
