export type ReadingShelf = "want" | "reading" | "read";

export type ReadingCategory = {
  id: string;
  name: string;
};

export type ReadingAuthor = {
  id: string;
  name: string;
};

export type ReadingBook = {
  id: string;
  title: string;
  authorId: string;
  shelf: ReadingShelf;
  /** 0–100 when currently reading */
  progressPercent: number;
  currentPage?: number;
  totalPages?: number;
  /** 1–5 when finished */
  rating?: number;
  startedAt?: string;
  finishedAt?: string;
  categoryIds: string[];
};

export type ReadingLibrary = {
  categories: ReadingCategory[];
  authors: ReadingAuthor[];
  books: ReadingBook[];
};

const STORAGE_KEY = "life-plan-reading-books-v1";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function normalizeCategoryKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Returns existing category id if name matches case-insensitively, else null. */
export function findCategoryIdByName(
  categories: ReadingCategory[],
  name: string
): string | null {
  const key = normalizeCategoryKey(name);
  if (!key) return null;
  const found = categories.find((c) => normalizeCategoryKey(c.name) === key);
  return found?.id ?? null;
}

export function findAuthorIdByName(authors: ReadingAuthor[], name: string): string | null {
  const key = normalizeCategoryKey(name);
  if (!key) return null;
  const found = authors.find((a) => normalizeCategoryKey(a.name) === key);
  return found?.id ?? null;
}

export function createCategory(name: string): ReadingCategory {
  return { id: newId(), name: name.trim() || "Untitled" };
}

export function createAuthor(name: string): ReadingAuthor {
  return { id: newId(), name: name.trim() || "Unknown" };
}

export function createBookDraft(partial: {
  title: string;
  authorId: string;
  shelf: ReadingShelf;
  categoryIds?: string[];
}): ReadingBook {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: newId(),
    title: partial.title.trim(),
    authorId: partial.authorId,
    shelf: partial.shelf,
    progressPercent: partial.shelf === "reading" ? 0 : partial.shelf === "read" ? 100 : 0,
    categoryIds: partial.categoryIds?.length ? [...new Set(partial.categoryIds)] : [],
    ...(partial.shelf === "reading" ? { startedAt: now } : {}),
    ...(partial.shelf === "read" ? { finishedAt: now } : {}),
  };
}

type ParsedBook = ReadingBook & { author?: string };

function isValidBookRaw(o: Record<string, unknown>): boolean {
  const hasAuthorId = typeof o.authorId === "string" && o.authorId.length > 0;
  const hasLegacyAuthor = typeof o.author === "string" && o.author.trim().length > 0;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    (o.shelf === "want" || o.shelf === "reading" || o.shelf === "read") &&
    typeof o.progressPercent === "number" &&
    (hasAuthorId || hasLegacyAuthor)
  );
}

function parseBookRaw(o: Record<string, unknown>): ParsedBook {
  const rawIds = o.categoryIds;
  const categoryIds =
    Array.isArray(rawIds) && rawIds.every((x) => typeof x === "string")
      ? [...new Set(rawIds as string[])]
      : [];
  const authorId = typeof o.authorId === "string" ? o.authorId : "";
  const author = typeof o.author === "string" ? o.author : undefined;
  return {
    id: o.id as string,
    title: o.title as string,
    authorId,
    shelf: o.shelf as ReadingShelf,
    progressPercent: o.progressPercent as number,
    ...(typeof o.currentPage === "number" ? { currentPage: o.currentPage } : {}),
    ...(typeof o.totalPages === "number" ? { totalPages: o.totalPages } : {}),
    ...(typeof o.rating === "number" ? { rating: o.rating } : {}),
    ...(typeof o.startedAt === "string" ? { startedAt: o.startedAt } : {}),
    ...(typeof o.finishedAt === "string" ? { finishedAt: o.finishedAt } : {}),
    categoryIds,
    ...(author ? { author } : {}),
  };
}

function isValidCategory(o: unknown): o is ReadingCategory {
  if (!o || typeof o !== "object") return false;
  const c = o as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.name === "string" && c.name.trim().length > 0;
}

function isValidAuthor(o: unknown): o is ReadingAuthor {
  if (!o || typeof o !== "object") return false;
  const a = o as Record<string, unknown>;
  return typeof a.id === "string" && typeof a.name === "string" && a.name.trim().length > 0;
}

function normalizeAuthorsOnBooks(lib: ReadingLibrary): ReadingLibrary {
  let authors = [...lib.authors];
  const resolveAuthorId = (book: ParsedBook): string => {
    if (book.authorId && authors.some((a) => a.id === book.authorId)) {
      return book.authorId;
    }
    const legacy = book.author?.trim() ?? "";
    const name = legacy || "Unknown author";
    let id = findAuthorIdByName(authors, name);
    if (!id) {
      const a = createAuthor(name);
      authors.push(a);
      id = a.id;
    }
    return id;
  };

  const books: ReadingBook[] = lib.books.map((b) => {
    const pb = b as ParsedBook;
    const authorId = resolveAuthorId(pb);
    return {
      id: pb.id,
      title: pb.title,
      authorId,
      shelf: pb.shelf,
      progressPercent: pb.progressPercent,
      ...(pb.currentPage !== undefined ? { currentPage: pb.currentPage } : {}),
      ...(pb.totalPages !== undefined ? { totalPages: pb.totalPages } : {}),
      ...(pb.rating !== undefined ? { rating: pb.rating } : {}),
      ...(pb.startedAt !== undefined ? { startedAt: pb.startedAt } : {}),
      ...(pb.finishedAt !== undefined ? { finishedAt: pb.finishedAt } : {}),
      categoryIds: pb.categoryIds,
    };
  });

  return { ...lib, authors, books };
}

function migrateFromUnknown(parsed: unknown): ReadingLibrary {
  if (parsed && typeof parsed === "object" && "books" in parsed) {
    const obj = parsed as Record<string, unknown>;
    const booksRaw = obj.books;
    const catsRaw = obj.categories;
    const authorsRaw = obj.authors;
    const books = Array.isArray(booksRaw)
      ? booksRaw
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .filter(isValidBookRaw)
          .map(parseBookRaw)
      : [];
    const categories = Array.isArray(catsRaw) ? catsRaw.filter(isValidCategory) : [];
    const authors = Array.isArray(authorsRaw) ? authorsRaw.filter(isValidAuthor) : [];
    return normalizeAuthorsOnBooks({ books, categories, authors });
  }
  if (Array.isArray(parsed)) {
    const books = parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .filter(isValidBookRaw)
      .map(parseBookRaw);
    return normalizeAuthorsOnBooks({ books, categories: [], authors: [] });
  }
  return { books: [], categories: [], authors: [] };
}

export function loadReadingLibrary(): ReadingLibrary {
  if (typeof window === "undefined") return { books: [], categories: [], authors: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { books: [], categories: [], authors: [] };
    return migrateFromUnknown(JSON.parse(raw) as unknown);
  } catch {
    return { books: [], categories: [], authors: [] };
  }
}

export function saveReadingLibrary(lib: ReadingLibrary): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        books: lib.books,
        categories: lib.categories,
        authors: lib.authors,
      })
    );
  } catch {
    /* ignore quota */
  }
}
