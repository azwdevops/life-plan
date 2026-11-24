import { useQuery } from "@tanstack/react-query";
import {
  getTrialBalance,
  getLedgerReport,
  getLedgerBalances,
  getItemBalances,
  getItemReport,
} from "@/lib/api/reports";
import { useAuth } from "./use-auth";

export function useLedgerBalances(parentGroupName?: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["ledger-balances", parentGroupName ?? "all"],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getLedgerBalances(token, parentGroupName);
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });
}

export function useTrialBalance(startDate: string, endDate: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["trial-balance", startDate, endDate],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getTrialBalance(token, startDate, endDate);
    },
    enabled: !!token && !!startDate && !!endDate,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useLedgerReport(
  ledgerId: number | null,
  startDate: string,
  endDate: string
) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["ledger-report", ledgerId, startDate, endDate],
    queryFn: () => {
      if (!token || !ledgerId) throw new Error("Not authenticated or ledger not selected");
      return getLedgerReport(token, ledgerId, startDate, endDate);
    },
    enabled: !!token && !!ledgerId && !!startDate && !!endDate,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useItemBalances(startDate: string, endDate: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["item-balances", startDate, endDate],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getItemBalances(token, startDate, endDate);
    },
    enabled: !!token && !!startDate && !!endDate,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useItemReport(
  itemId: number | null,
  startDate: string,
  endDate: string
) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["item-report", itemId, startDate, endDate],
    queryFn: () => {
      if (!token || !itemId) throw new Error("Not authenticated or item not selected");
      return getItemReport(token, itemId, startDate, endDate);
    },
    enabled: !!token && !!itemId && !!startDate && !!endDate,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

