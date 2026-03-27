const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

import { handleApiResponse } from "../api-utils";
import type { NamedResumeDocument } from "@/lib/resume-builder-storage";

export async function listResumeDocuments(
  token: string
): Promise<NamedResumeDocument[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resumes/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error("Failed to load resumes");
  }

  const data = (await response.json()) as { documents: NamedResumeDocument[] };
  return Array.isArray(data.documents) ? data.documents : [];
}

export async function getResumeDocument(
  token: string,
  externalId: string
): Promise<NamedResumeDocument> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/resumes/${encodeURIComponent(externalId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error("Failed to load resume");
  }

  return response.json() as Promise<NamedResumeDocument>;
}

export async function putResumeDocument(
  token: string,
  doc: NamedResumeDocument
): Promise<NamedResumeDocument> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/resumes/${encodeURIComponent(doc.id)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(doc),
    }
  );

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Failed to save resume"
    );
  }

  return response.json() as Promise<NamedResumeDocument>;
}

export async function deleteResumeDocument(
  token: string,
  externalId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/resumes/${encodeURIComponent(externalId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok && response.status !== 204) {
    throw new Error("Failed to delete resume");
  }
}
