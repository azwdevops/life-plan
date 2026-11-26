"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { UpcomingExpensesButton } from "@/components/UpcomingExpensesButton";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTransactions } from "@/lib/hooks/use-transactions";
import {
  useLedgers,
  useLedgerGroups,
  useParentLedgerGroups,
} from "@/lib/hooks/use-accounts";
import { useUpcomingExpenses } from "@/lib/hooks/use-upcoming-expenses";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

type PeriodType = "month" | "custom";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const { data: incomeTransactions = [], refetch: refetchIncome } = useTransactions("MONEY_RECEIVED");
  const { data: expenseTransactions = [], refetch: refetchExpenses, isLoading: isLoadingExpenseTransactions } = useTransactions("MONEY_PAID");
  const { data: transferTransactions = [], refetch: refetchTransfers } = useTransactions("JOURNAL");
  const { data: ledgers = [], refetch: refetchLedgers } = useLedgers();
  const { data: ledgerGroups = [] } = useLedgerGroups();
  const { data: parentLedgerGroups = [] } = useParentLedgerGroups();
  const { data: upcomingExpenses = [] } = useUpcomingExpenses();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  // Initialize custom dates when switching to custom mode
  useEffect(() => {
    if (periodType === "custom" && !customStartDate && !customEndDate) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      setCustomStartDate(start);
      setCustomEndDate(end);
    }
  }, [periodType, customStartDate, customEndDate]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Don't show loading screen if we're just checking auth - only show if actually loading
  if (!isAuthenticated && !isLoading) {
    return null; // Will redirect, don't render anything
  }

  // Calculate date range based on period type
  const getDateRange = () => {
    if (periodType === "month") {
      const start = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
      const end = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    } else {
      // Custom date range
      if (!customStartDate || !customEndDate) {
        // Default to current month if custom dates not set
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end };
      }
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Filter transactions by date range
  const filteredIncomeTransactions = useMemo(() => {
    return incomeTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.transaction_date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [incomeTransactions, startDate, endDate]);

  const filteredExpenseTransactions = useMemo(() => {
    return expenseTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.transaction_date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [expenseTransactions, startDate, endDate]);

  const filteredTransferTransactions = useMemo(() => {
    return transferTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.transaction_date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transferTransactions, startDate, endDate]);

  // Calculate totals - ensure values are numbers
  // Cash In: MONEY_RECEIVED transactions
  const totalCashIn = filteredIncomeTransactions.reduce(
    (sum, transaction) => {
      const amount = typeof transaction.total_amount === 'string' 
        ? parseFloat(transaction.total_amount) 
        : Number(transaction.total_amount) || 0;
      return sum + amount;
    },
    0
  );
  
  // Cash Out: MONEY_PAID transactions
  const totalCashOut = filteredExpenseTransactions.reduce(
    (sum, transaction) => {
      const amount = typeof transaction.total_amount === 'string' 
        ? parseFloat(transaction.total_amount) 
        : Number(transaction.total_amount) || 0;
      return sum + amount;
    },
    0
  );
  
  // Transfers: JOURNAL transactions (separate, not counted in cash in/out)
  const totalTransfers = filteredTransferTransactions.reduce(
    (sum, transaction) => {
      const amount = typeof transaction.total_amount === 'string' 
        ? parseFloat(transaction.total_amount) 
        : Number(transaction.total_amount) || 0;
      return sum + amount;
    },
    0
  );
  
  // Net Cash: Cash In - Cash Out (transfers are separate)
  const netCash = totalCashIn - totalCashOut;

  // Calculate total upcoming expenses
  const totalUpcomingExpenses = upcomingExpenses.reduce(
    (sum, expense) => {
      const amount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : Number(expense.amount) || 0;
      return sum + amount;
    },
    0
  );

  // Get all transactions (with items) to calculate cash/bank balances.
  // The list endpoint now returns items eagerly, so no per-transaction fetch is needed.
  const { data: allTransactionsWithItems = [] } = useTransactions();

  // Calculate cash/bank account balances
  const actualCashBankTotal = useMemo(() => {
    // Get bank and cash account ledger groups
    const bankCashGroups = ledgerGroups.filter(
      (group) =>
        group.category === "bank_accounts" || group.category === "cash_accounts"
    );
    const bankCashLedgerIds = new Set(
      ledgers
        .filter((ledger) =>
          bankCashGroups.some((group) => group.id === ledger.ledger_group_id)
        )
        .map((ledger) => ledger.id)
    );

    // Calculate balances for cash/bank accounts (debit - credit for assets)
    const ledgerBalances = new Map<number, number>();

    if (allTransactionsWithItems.length > 0) {
      allTransactionsWithItems.forEach((transaction) => {
        (transaction.items ?? []).forEach((item) => {
          if (bankCashLedgerIds.has(item.ledger_id)) {
            const amount =
              typeof item.amount === "string"
                ? parseFloat(item.amount)
                : Number(item.amount) || 0;

            const existing = ledgerBalances.get(item.ledger_id) || 0;
            // For assets: DEBIT increases balance, CREDIT decreases balance
            if (item.entry_type === "DEBIT") {
              ledgerBalances.set(item.ledger_id, existing + amount);
            } else if (item.entry_type === "CREDIT") {
              ledgerBalances.set(item.ledger_id, existing - amount);
            }
          }
        });
      });
    }

    // Sum all positive balances (negative balances are overdrafts/liabilities)
    return Array.from(ledgerBalances.values())
      .filter((balance) => balance > 0)
      .reduce((sum, balance) => sum + balance, 0);
  }, [allTransactionsWithItems, ledgers, ledgerGroups]);

  // Expected Net = Actual Cash/Bank - Upcoming Expenses
  const expectedNet = actualCashBankTotal - totalUpcomingExpenses;

  // Fetch transaction details for filtered expense transactions to get items
  // filteredExpenseTransactions already carries items (list endpoint eager-loads them).
  const expenseTransactionsWithItems = filteredExpenseTransactions;
  const isLoadingTransactions = isLoadingExpenseTransactions;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchIncome(),
        refetchExpenses(),
        refetchTransfers(),
        refetchLedgers(),
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Expense ledgers only (under the Expenditure parent group), excluding bank
  // charge ledgers - same filter the Expenses page uses.
  const expenditureParentGroup = parentLedgerGroups.find(
    (parent) => parent.name.toLowerCase() === "expenditure"
  );
  const expenseGroups = expenditureParentGroup
    ? ledgerGroups.filter(
        (group) => group.parent_ledger_group_id === expenditureParentGroup.id
      )
    : ledgerGroups.filter((group) => group.category === "expenses");
  const expenseLedgerIds = new Set(
    ledgers
      .filter((ledger) =>
        expenseGroups.some((group) => group.id === ledger.ledger_group_id)
      )
      .map((ledger) => ledger.id)
  );

  // Group expenses by ledger - a ledger IS the spending category, so this
  // replaces the old spending-type breakdown without needing that field.
  const expensesByLedger = useMemo(() => {
    const ledgerTotals = new Map<number, number>();

    expenseTransactionsWithItems.forEach((transaction) => {
      (transaction.items ?? []).forEach((item) => {
        if (item.entry_type !== "DEBIT" || !expenseLedgerIds.has(item.ledger_id)) return;
        const amount =
          typeof item.amount === "string" ? parseFloat(item.amount) : Number(item.amount) || 0;
        if (amount <= 0) return;
        const existing = ledgerTotals.get(item.ledger_id) || 0;
        ledgerTotals.set(item.ledger_id, existing + amount);
      });
    });

    const totalExpenses = Array.from(ledgerTotals.values()).reduce((sum, total) => sum + total, 0);

    return Array.from(ledgerTotals.entries())
      .map(([ledgerId, total]) => {
        const ledger = ledgers.find((l) => l.id === ledgerId);
        return {
          name: ledger?.name || `Unknown (ID: ${ledgerId})`,
          value: Number(total.toFixed(2)),
          percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactionsWithItems, expenseLedgerIds, ledgers]);

  // Colors for the pie chart
  const COLORS = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16", // lime
    "#6366f1", // indigo
  ];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header
        onMenuClick={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isLoggedIn={isAuthenticated}
      />
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-60" : "lg:ml-0"
        }`}
      >
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Dashboard
            </h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              title="Refresh data"
            >
              <svg
                className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>

          {/* Financial Overview */}
          <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Your Financial Overview
            </h2>
              
              {/* Period Filter */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPeriodType("month")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      periodType === "month"
                        ? "bg-blue-600 text-white dark:bg-blue-500"
                        : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setPeriodType("custom")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      periodType === "custom"
                        ? "bg-blue-600 text-white dark:bg-blue-500"
                        : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {periodType === "month" ? (
                  <DatePicker
                    selected={selectedMonthDate}
                    onChange={(date: Date | null) => {
                      if (date) setSelectedMonthDate(date);
                    }}
                    dateFormat="MMMM yyyy"
                    showMonthYearPicker
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-48"
                    popperPlacement="bottom-start"
                  />
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <DatePicker
                      selected={customStartDate}
                      onChange={(date: Date | null) => setCustomStartDate(date)}
                      selectsStart
                      startDate={customStartDate}
                      endDate={customEndDate}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="Start Date"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-40"
                      popperPlacement="bottom-start"
                    />
                    <span className="text-center text-zinc-600 dark:text-zinc-400 sm:text-left">to</span>
                    <DatePicker
                      selected={customEndDate}
                      onChange={(date: Date | null) => setCustomEndDate(date)}
                      selectsEnd
                      startDate={customStartDate}
                      endDate={customEndDate}
                      minDate={customStartDate || undefined}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="End Date"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-40"
                      popperPlacement="bottom-start"
                    />
                  </div>
                )}
              </div>
              </div>
              {/* Period Display */}
              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {periodType === "month" ? (
                  <span>
                    {selectedMonthDate.toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                ) : customStartDate && customEndDate ? (
                  <span>
                    {customStartDate.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}{" "}
                    to{" "}
                    {customEndDate.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <span>Select date range</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              {/* Current Month Card */}
              <div className="flex-1 min-w-[280px] rounded-lg border-2 border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      Current Month
                    </div>
                    <span className="text-xs rounded-full bg-blue-200 px-2 py-0.5 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                      Active
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash In:</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      +{totalCashIn.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash Out:</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      -{totalCashOut.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      })}
                    </span>
                  </div>
                  <div className="border-t border-blue-300 pt-2 dark:border-blue-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Net:</span>
                      <span
                        className={`text-base font-bold ${
                          netCash >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {netCash >= 0 ? "+" : ""}{netCash.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                          useGrouping: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Month Card */}
              <div className="flex-1 min-w-[280px] rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Next Month
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Current Cash:</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {actualCashBankTotal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Upcoming Expenses:</span>
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      -{Number(totalUpcomingExpenses).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        useGrouping: true,
                      })}
                    </span>
                  </div>
                  <div className="mb-2 flex justify-center">
                    <UpcomingExpensesButton />
                  </div>
                  <div className="border-t border-zinc-300 pt-2 dark:border-zinc-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Expected Net:</span>
                      <span
                        className={`text-base font-bold ${
                          expectedNet >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {expectedNet >= 0 ? "+" : ""}{expectedNet.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                          useGrouping: true,
                        })}
                      </span>
                    </div>
                    <div className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
                      {expectedNet >= 0 ? "✓ Can cover expenses" : "⚠ Insufficient funds"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Expenses by Ledger */}
          <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Expenses by Ledger
            </h2>
            {isLoadingTransactions ? (
              <div className="py-12 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">Loading spending breakdown...</p>
              </div>
            ) : expensesByLedger.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {formatAmount(
                      expensesByLedger.reduce((sum, item) => sum + item.value, 0)
                    )}
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {expensesByLedger.map((item, index) => {
                    const pct = Math.max(Math.min(item.percentage, 100), 3);
                    const color = COLORS[index % COLORS.length];
                    return (
                      <li
                        key={item.name}
                        className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                      >
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                        <div className="relative flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="truncate font-bold text-zinc-900 dark:text-white">
                            {item.name}
                          </span>
                          <span className="shrink-0 font-mono text-xs font-bold text-zinc-800 dark:text-zinc-100">
                            {formatAmount(item.value)} ·{" "}
                            <span style={{ color }}>{item.percentage.toFixed(1)}%</span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">
                  {filteredExpenseTransactions.length === 0
                    ? "No expense transactions yet. Start recording expenses to see spending breakdown."
                    : expenseLedgerIds.size === 0
                    ? "No expense ledgers found. Create expense ledgers in the Accounts page."
                    : "No expenses found in the selected transactions."}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


