import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

// Author/Category are NOT defined here - they reuse the shared
// LibraryAuthor/LibraryCategory model + endpoints from "./reading-library".
// See CLAUDE.md "Reuse shared lookup models".

export interface AzwBook {
  id: number;
  title: string;
  author_id: string;
  author_name: string;
  summary: string | null;
  category_names: string[];
  chapter_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface AzwBookCreate {
  title: string;
  author_id: string;
  summary?: string | null;
  category_names: string[];
}

export interface AzwBookUpdate {
  title?: string;
  author_id?: string;
  summary?: string | null;
  category_names?: string[];
}

export interface AzwBookChapter {
  id: number;
  book_id: number;
  title: string;
  content: string;
  order_index: number;
  is_copied: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface AzwBookChapterCreate {
  content: string;
}

export interface AzwBookChapterUpdate {
  content?: string;
  is_copied?: boolean;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function throwOnError(response: Response, fallback: string): Promise<void> {
  if (handleApiResponse(response)) throw new Error("Unauthorized");
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: fallback }));
    throw new Error(err.detail || fallback);
  }
}

// --- Books ---

export async function getAzwBooks(token: string): Promise<AzwBook[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch books");
  return response.json();
}

export async function getAzwBook(token: string, bookId: number): Promise<AzwBook> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/${bookId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch book");
  return response.json();
}

export async function createAzwBook(token: string, data: AzwBookCreate): Promise<AzwBook> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  await throwOnError(response, "Failed to create book");
  return response.json();
}

export async function updateAzwBook(token: string, bookId: number, data: AzwBookUpdate): Promise<AzwBook> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/${bookId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  await throwOnError(response, "Failed to update book");
  return response.json();
}

export async function deleteAzwBook(token: string, bookId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/${bookId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to delete book");
}

// --- Chapters ---

export async function getAzwBookChapters(token: string, bookId: number): Promise<AzwBookChapter[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/${bookId}/chapters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to fetch chapters");
  return response.json();
}

export async function createAzwBookChapter(
  token: string,
  bookId: number,
  data: AzwBookChapterCreate
): Promise<AzwBookChapter> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/${bookId}/chapters`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  await throwOnError(response, "Failed to create chapter");
  return response.json();
}

export async function updateAzwBookChapter(
  token: string,
  chapterId: number,
  data: AzwBookChapterUpdate
): Promise<AzwBookChapter> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/chapters/${chapterId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  await throwOnError(response, "Failed to update chapter");
  return response.json();
}

export async function deleteAzwBookChapter(token: string, chapterId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/azw-books/chapters/${chapterId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, "Failed to delete chapter");
}
