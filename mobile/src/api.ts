export interface CurrentUser {
  id: number;
  email: string;
  /** Which AzwBook holds this user's book ideas (shared with the web app). */
  book_ideas_book_id: number | null;
}

export interface AzwBookChapter {
  id: number;
  book_id: number;
  title: string;
  content: string;
  order_index: number;
}

async function throwOnError(response: Response, fallback: string): Promise<void> {
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: fallback }));
    throw new Error(err.detail || fallback);
  }
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function login(backendUrl: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${backendUrl}/api/v1/auth/login-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await throwOnError(response, 'Login failed');
  const data = await response.json();
  return data.access_token as string;
}

export async function getCurrentUser(backendUrl: string, token: string): Promise<CurrentUser> {
  const response = await fetch(`${backendUrl}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, 'Failed to load profile');
  return response.json();
}

export async function getAzwBookChapters(
  backendUrl: string,
  token: string,
  bookId: number
): Promise<AzwBookChapter[]> {
  const response = await fetch(`${backendUrl}/api/v1/azw-books/${bookId}/chapters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, 'Failed to fetch ideas');
  return response.json();
}

export async function createAzwBookChapter(
  backendUrl: string,
  token: string,
  bookId: number,
  content: string
): Promise<AzwBookChapter> {
  const response = await fetch(`${backendUrl}/api/v1/azw-books/${bookId}/chapters`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ content }),
  });
  await throwOnError(response, 'Failed to save idea');
  return response.json();
}

export async function updateAzwBookChapter(
  backendUrl: string,
  token: string,
  chapterId: number,
  content: string
): Promise<AzwBookChapter> {
  const response = await fetch(`${backendUrl}/api/v1/azw-books/chapters/${chapterId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ content }),
  });
  await throwOnError(response, 'Failed to save idea');
  return response.json();
}

export async function deleteAzwBookChapter(backendUrl: string, token: string, chapterId: number): Promise<void> {
  const response = await fetch(`${backendUrl}/api/v1/azw-books/chapters/${chapterId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnError(response, 'Failed to delete idea');
}
