import { handleApiResponse } from "../api-utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface ParentLedgerGroup {
  id: number;
  name: string;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
}

export type LedgerGroupCategory =
  | "incomes"
  | "expenses"
  | "bank_accounts"
  | "cash_accounts"
  | "bank_charges"
  | "other";

export interface LedgerGroup {
  id: number;
  name: string;
  parent_ledger_group_id: number;
  category: LedgerGroupCategory;
  is_active: boolean;
  created_at: string;
  parent_ledger_group?: ParentLedgerGroup;
}

export interface Ledger {
  id: number;
  user_id: number;
  name: string;
  code: string | null;
  ledger_group_id: number;
  is_active: boolean;
  created_at: string;
  ledger_group?: LedgerGroup;
}

export interface LedgerItem {
  id: number;
  user_id: number;
  name: string;
  ledger_id: number;
  is_active: boolean;
  created_at: string;
  ledger?: Ledger;
}

export interface LedgerItemCreate {
  name: string;
  ledger_id: number;
}

export interface ParentLedgerGroupCreate {
  name: string;
  sort_order?: number | null;
}

export interface LedgerGroupCreate {
  name: string;
  parent_ledger_group_id: number;
  category: LedgerGroupCategory;
}

export interface LedgerCreate {
  name: string;
  ledger_group_id: number;
}

export async function getParentLedgerGroups(token: string): Promise<ParentLedgerGroup[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/parent-groups`, {
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
    throw new Error("Failed to fetch parent ledger groups");
  }

  return response.json();
}

export async function createParentLedgerGroup(
  token: string,
  data: ParentLedgerGroupCreate
): Promise<ParentLedgerGroup> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/parent-groups`, {
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
    throw new Error(error.detail || "Failed to create parent ledger group");
  }

  return response.json();
}

export async function getLedgerGroups(token: string, parent_group_id?: number): Promise<LedgerGroup[]> {
  const url = new URL(`${API_BASE_URL}/api/v1/accounts/groups`);
  if (parent_group_id) {
    url.searchParams.append("parent_group_id", parent_group_id.toString());
  }
  
  const response = await fetch(url.toString(), {
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
    throw new Error("Failed to fetch ledger groups");
  }

  return response.json();
}

export async function createLedgerGroup(
  token: string,
  data: LedgerGroupCreate
): Promise<LedgerGroup> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/groups`, {
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
    throw new Error(error.detail || "Failed to create ledger group");
  }

  return response.json();
}

export async function createLedger(
  token: string,
  data: LedgerCreate
): Promise<Ledger> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/`, {
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
    throw new Error(error.detail || "Failed to create ledger");
  }

  return response.json();
}

export async function getLedgers(
  token: string,
  includeInactive: boolean = false
): Promise<Ledger[]> {
  const params = includeInactive ? "?include_inactive=true" : "";
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/${params}`, {
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
    throw new Error("Failed to fetch ledgers");
  }

  return response.json();
}

export async function updateLedger(
  token: string,
  ledgerId: number,
  data: LedgerCreate
): Promise<Ledger> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/${ledgerId}`, {
    method: "PUT",
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
    throw new Error(error.detail || "Failed to update ledger");
  }

  return response.json();
}

export async function deleteLedger(token: string, ledgerId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/${ledgerId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete ledger");
  }
}

export async function updateLedgerGroup(
  token: string,
  groupId: number,
  data: LedgerGroupCreate
): Promise<LedgerGroup> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/groups/${groupId}`, {
    method: "PUT",
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
    throw new Error(error.detail || "Failed to update ledger group");
  }

  return response.json();
}

export async function deleteLedgerGroup(token: string, groupId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/groups/${groupId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete ledger group");
  }
}

export async function getLedgerItems(token: string): Promise<LedgerItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/ledger-items`, {
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
    throw new Error("Failed to fetch items");
  }

  return response.json();
}

export async function createLedgerItem(
  token: string,
  data: LedgerItemCreate
): Promise<LedgerItem> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/ledger-items`, {
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
    throw new Error(error.detail || "Failed to create item");
  }

  return response.json();
}

export async function updateLedgerItem(
  token: string,
  itemId: number,
  data: LedgerItemCreate
): Promise<LedgerItem> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/ledger-items/${itemId}`, {
    method: "PUT",
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
    throw new Error(error.detail || "Failed to update item");
  }

  return response.json();
}

export async function deleteLedgerItem(token: string, itemId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/accounts/ledger-items/${itemId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (handleApiResponse(response)) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete item");
  }
}

