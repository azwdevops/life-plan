import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface UpcomingExpense {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  due_date: string;
  created_at: string;
  updated_at: string | null;
}

export interface UpcomingExpenseCreate {
  name: string;
  amount: number;
  due_date: string;
}

export interface UpcomingExpenseUpdate {
  name?: string;
  amount?: number;
  due_date?: string;
}

export async function createUpcomingExpense(
  token: string,
  data: UpcomingExpenseCreate
): Promise<UpcomingExpense> {
  const response = await fetch(`${API_BASE_URL}/api/v1/upcoming-expenses/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create upcoming expense");
  }

  return response.json();
}

export async function getUpcomingExpenses(
  token: string
): Promise<UpcomingExpense[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/upcoming-expenses/`, {
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
    throw new Error("Failed to fetch upcoming expenses");
  }

  return response.json();
}

export async function getUpcomingExpense(
  token: string,
  expenseId: number
): Promise<UpcomingExpense> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/upcoming-expenses/${expenseId}`,
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
    throw new Error("Failed to fetch upcoming expense");
  }

  return response.json();
}

export async function updateUpcomingExpense(
  token: string,
  expenseId: number,
  data: UpcomingExpenseUpdate
): Promise<UpcomingExpense> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/upcoming-expenses/${expenseId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update upcoming expense");
  }

  return response.json();
}

export async function deleteUpcomingExpense(
  token: string,
  expenseId: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/upcoming-expenses/${expenseId}`,
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

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete upcoming expense");
  }
}

