const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

export interface SignupRequest {
  email: string;
  first_name: string;
  password: string;
  confirm_password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  email: string;
  first_name: string;
  is_active: boolean;
  groups: string[];
}

export async function signup(data: SignupRequest): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Signup failed");
  }

  return response.json();
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login-json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Login failed");
  }

  return response.json();
}

export async function getCurrentUser(token: string): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user");
  }

  return response.json();
}

export interface GroupResponse {
  id: number;
  name: string;
}

export async function getGroups(): Promise<GroupResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/groups`);
  if (!response.ok) throw new Error("Failed to fetch groups");
  return response.json();
}

export async function getAdminUsers(token: string): Promise<UserResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/admin/users`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("Admin access required");
    throw new Error("Failed to fetch users");
  }
  return response.json();
}

export async function setUserGroups(
  token: string,
  userId: number,
  groupNames: string[]
): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/admin/users/${userId}/groups`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ group_names: groupNames }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update user groups");
  }
  return response.json();
}

