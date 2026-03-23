"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { signup, login, getCurrentUser, UserResponse } from "@/lib/api/auth";
import type { SignupRequest, LoginRequest } from "@/lib/api/auth";
import { clearActiveRun } from "@/lib/active-run-storage";

const TOKEN_KEY = "life_plan_token";
const USER_KEY = "life_plan_user";

// Helper function to read from localStorage synchronously (client-side only)
function getStoredAuth() {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }
  
  const storedToken = localStorage.getItem(TOKEN_KEY);
  const storedUser = localStorage.getItem(USER_KEY);
  
  let user: UserResponse | null = null;
  if (storedToken && storedUser) {
    try {
      const parsed = JSON.parse(storedUser) as UserResponse;
      user = { ...parsed, groups: Array.isArray(parsed.groups) ? parsed.groups : [] };
    } catch {
      // Invalid stored user, clear it
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return { token: null, user: null };
    }
  }
  
  return { token: storedToken, user };
}

export function useAuth() {
  // Initialize state synchronously from localStorage to prevent flickering
  const [user, setUser] = useState<UserResponse | null>(() => {
    if (typeof window !== "undefined") {
      return getStoredAuth().user;
    }
    return null;
  });
  
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return getStoredAuth().token;
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(false); // Start as false since we read synchronously

  // This effect is not needed since we initialize state synchronously
  // But keeping it empty for potential future use
  useEffect(() => {
    // State is already initialized from localStorage synchronously
    // No need to re-read here
  }, []); // Only run once on mount

  const signupMutation = useMutation({
    mutationFn: signup,
    onSuccess: () => {
      // After successful signup, user should login
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      setToken(data.access_token);
      localStorage.setItem(TOKEN_KEY, data.access_token);

      // Fetch user info
      try {
        const userData = await getCurrentUser(data.access_token);
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    },
  });

  const logout = () => {
    clearActiveRun();
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const handleSignup = async (data: SignupRequest) => {
    return signupMutation.mutateAsync(data);
  };

  const handleLogin = async (data: LoginRequest) => {
    return loginMutation.mutateAsync(data);
  };

  /** Persist updated user from API (e.g. after saving fitness profile). */
  const applyUser = useCallback((next: UserResponse) => {
    const normalized: UserResponse = {
      ...next,
      groups: Array.isArray(next.groups) ? next.groups : [],
    };
    setUser(normalized);
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
  }, []);

  return {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    signup: handleSignup,
    login: handleLogin,
    logout,
    applyUser,
    isSigningUp: signupMutation.isPending,
    isLoggingIn: loginMutation.isPending,
    signupError: signupMutation.error,
    loginError: loginMutation.error,
  };
}

