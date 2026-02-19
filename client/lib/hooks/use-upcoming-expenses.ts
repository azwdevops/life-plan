import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUpcomingExpense,
  getUpcomingExpenses,
  getUpcomingExpense,
  updateUpcomingExpense,
  deleteUpcomingExpense,
  UpcomingExpenseCreate,
  UpcomingExpenseUpdate,
} from "@/lib/api/upcoming-expenses";
import { useAuth } from "./use-auth";

export function useCreateUpcomingExpense() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (data: UpcomingExpenseCreate) => {
      if (!token) throw new Error("Not authenticated");
      return createUpcomingExpense(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"] });
    },
  });
}

export function useUpcomingExpenses() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["upcoming-expenses"],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getUpcomingExpenses(token);
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false,
  });
}

export function useUpcomingExpense(expenseId: number) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["upcoming-expenses", expenseId],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getUpcomingExpense(token, expenseId);
    },
    enabled: !!token && !!expenseId,
  });
}

export function useUpdateUpcomingExpense() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      expenseId,
      data,
    }: {
      expenseId: number;
      data: UpcomingExpenseUpdate;
    }) => {
      if (!token) throw new Error("Not authenticated");
      return updateUpcomingExpense(token, expenseId, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"] });
      queryClient.invalidateQueries({
        queryKey: ["upcoming-expenses", data.id],
      });
    },
  });
}

export function useDeleteUpcomingExpense() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (expenseId: number) => {
      if (!token) throw new Error("Not authenticated");
      return deleteUpcomingExpense(token, expenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"] });
    },
  });
}

