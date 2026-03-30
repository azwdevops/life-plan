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
