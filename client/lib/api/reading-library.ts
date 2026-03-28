import { handleApiResponse } from "../api-utils";
import type {
  ReadingBook,
  ReadingLibrary,
  ReadingShelf,
} from "@/lib/reading-books-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

interface ApiAuthor {
  id: string;
  name: string;
}

interface ApiCategory {
  id: string;
  name: string;
}

interface ApiBook {
  id: string;
  title: string;
  author_id: string;
  shelf: ReadingShelf;
  progress_percent: number;
  category_ids: string[];
  rating: number | null;
  started_at: string | null;
  finished_at: string | null;
}

interface ApiLibrary {
  authors: ApiAuthor[];
  categories: ApiCategory[];
  books: ApiBook[];
}

function apiToLibrary(data: ApiLibrary): ReadingLibrary {
  return {
    authors: data.authors.map((a) => ({ id: a.id, name: a.name })),
    categories: data.categories.map((c) => ({ id: c.id, name: c.name })),
    books: data.books.map(
      (b): ReadingBook => ({
        id: b.id,
        title: b.title,
        authorId: b.author_id,
        shelf: b.shelf,
        progressPercent: b.progress_percent,
        categoryIds: [...b.category_ids],
        ...(b.rating != null && b.rating > 0 ? { rating: b.rating } : {}),
        ...(b.started_at ? { startedAt: b.started_at } : {}),
        ...(b.finished_at ? { finishedAt: b.finished_at } : {}),
      })
    ),
  };
}

function libraryToApiBody(lib: ReadingLibrary): ApiLibrary {
  return {
    authors: lib.authors.map((a) => ({ id: a.id, name: a.name })),
    categories: lib.categories.map((c) => ({ id: c.id, name: c.name })),
    books: lib.books.map((b) => ({
      id: b.id,
      title: b.title,
      author_id: b.authorId,
      shelf: b.shelf,
      progress_percent: b.progressPercent,
      category_ids: b.categoryIds,
      rating: b.rating != null && b.rating > 0 ? b.rating : null,
      started_at: b.startedAt ?? null,
      finished_at: b.finishedAt ?? null,
    })),
  };
}

export async function getReadingLibrary(token: string): Promise<ReadingLibrary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/reading-library/`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to load reading library");
  }
  const data = (await response.json()) as ApiLibrary;
  return apiToLibrary(data);
}

export async function putReadingLibrary(
  token: string,
  lib: ReadingLibrary
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/reading-library/`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(libraryToApiBody(lib)),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const detail =
      typeof err?.detail === "string"
        ? err.detail
        : Array.isArray(err?.detail)
          ? err.detail.map((x: { msg?: string }) => x.msg).join(", ")
          : "Failed to save reading library";
    throw new Error(detail);
  }
}
