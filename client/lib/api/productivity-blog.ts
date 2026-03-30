import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface ProductivityBlogCategoryApi {
  id: number;
  name: string;
}

export interface ProductivityBlogPostApi {
  id: string;
  title: string;
  body_html: string;
  category_names: string[];
}

export interface ProductivityBlogDataApi {
  categories: ProductivityBlogCategoryApi[];
  posts: ProductivityBlogPostApi[];
}

export async function getProductivityBlogData(
  token: string
): Promise<ProductivityBlogDataApi> {
  const response = await fetch(`${API_BASE_URL}/api/v1/productivity-blog/`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to load productivity blog data");
  }
  return (await response.json()) as ProductivityBlogDataApi;
}

export async function createProductivityCategory(
  token: string,
  name: string
): Promise<ProductivityBlogCategoryApi> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/productivity-blog/categories`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error("Failed to create category");
  }
  return (await response.json()) as ProductivityBlogCategoryApi;
}

export type ProductivityBlogPostCreateBody = {
  id: string;
  title: string;
  body_html: string;
  category_names: string[];
};

export type ProductivityBlogPostUpdateBody = Partial<{
  title: string;
  body_html: string;
  category_names: string[];
}>;

async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const err = await response.json().catch(() => ({}));
  if (typeof err?.detail === "string") return err.detail;
  if (Array.isArray(err?.detail)) {
    return err.detail.map((x: { msg?: string }) => x.msg).join(", ") || fallback;
  }
  return fallback;
}

export async function createProductivityPost(
  token: string,
  body: ProductivityBlogPostCreateBody
): Promise<ProductivityBlogPostApi> {
  const response = await fetch(`${API_BASE_URL}/api/v1/productivity-blog/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "Failed to create post"));
  }
  return (await response.json()) as ProductivityBlogPostApi;
}

export async function updateProductivityPost(
  token: string,
  postId: string,
  patch: ProductivityBlogPostUpdateBody
): Promise<ProductivityBlogPostApi> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/productivity-blog/posts/${encodeURIComponent(postId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "Failed to update post"));
  }
  return (await response.json()) as ProductivityBlogPostApi;
}

export async function deleteProductivityPost(
  token: string,
  postId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/productivity-blog/posts/${encodeURIComponent(postId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }
  if (!response.ok && response.status !== 204) {
    throw new Error(await readApiErrorMessage(response, "Failed to delete post"));
  }
}
