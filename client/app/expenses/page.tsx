"use client";

import { Suspense, useState, useEffect, useMemo, memo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  useLedgers,
  useLedgerGroups,
  useParentLedgerGroups,
  useLedgerItems,
} from "@/lib/hooks/use-accounts";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { useQueryClient } from "@tanstack/react-query";
import { renderElbowPieLabel, withMinDisplayShare } from "@/lib/charts/pie-label";
import { usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";
import { usePersistedPeriodFilter, type PeriodType } from "@/lib/hooks/use-persisted-period-filter";

function formatKsh(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

function ExpensesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const isEmbedded = searchParams.get("embedded") === "1" || pathname === "/money-flow";
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const { data: ledgers = [], refetch: refetchLedgers } = useLedgers();
  const { data: groups = [] } = useLedgerGroups();
  const { data: parentGroups = [] } = useParentLedgerGroups();
  const { data: ledgerItems = [], refetch: refetchLedgerItems } = useLedgerItems();
  const { data: expenseTransactions = [], refetch: refetchExpenses, isLoading: isLoadingTransactions } = useTransactions("MONEY_PAID");
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [breakdownView, setBreakdownView] = useState<"chart" | "table">("chart");
  const {
    periodType,
    selectedMonthDate,
    selectedQuarterDate,
    selectedYearDate,
    selectedHalf,
    customStartDate,
    customEndDate,
    setPeriodType,
    setSelectedMonthDate,
    setSelectedQuarterDate,
    setSelectedYearDate,
    setSelectedHalf,
    setCustomStartDate,
    setCustomEndDate,
  } = usePersistedPeriodFilter("expenses-period-filter");

  // Filter ledgers: expense ledgers (under Expenditure parent group), asset ledgers (for paying account), and charge ledgers
  const expenditureParentGroup = parentGroups.find(
    (parent) => parent.name.toLowerCase() === "expenditure"
  );

  const expenseGroups = expenditureParentGroup
    ? groups.filter(
        (group) => group.parent_ledger_group_id === expenditureParentGroup.id
      )
    : groups.filter((group) => group.category === "expenses");
  const assetGroups = groups.filter(
    (group) =>
      group.category === "bank_accounts" ||
      group.category === "cash_accounts"
  );
  const chargeGroups = groups.filter(
    (group) => group.category === "bank_charges"
  );

  const expenseLedgers = ledgers.filter((ledger) =>
    expenseGroups.some((group) => group.id === ledger.ledger_group_id)
  );
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

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

  // Calculate date range based on period type
  const getDateRange = () => {
    if (periodType === "month") {
      const start = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
      const end = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    } else if (periodType === "quarter") {
      const quarter = Math.floor(selectedQuarterDate.getMonth() / 3);
      const year = selectedQuarterDate.getFullYear();
      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
      return { start, end };
    } else if (periodType === "half_year") {
      const year = selectedYearDate.getFullYear();
      const start = new Date(year, selectedHalf === 1 ? 0 : 6, 1);
      const end = new Date(year, selectedHalf === 1 ? 5 : 11, selectedHalf === 1 ? 30 : 31, 23, 59, 59, 999);
      return { start, end };
    } else if (periodType === "year") {
      const year = selectedYearDate.getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
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
  const filteredExpenseTransactions = useMemo(() => {
    return expenseTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.transaction_date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [expenseTransactions, startDate, endDate]);

  // Create a map of ledger_id to ledger name
  const ledgerMap = useMemo(() => {
    const map = new Map<number, string>();
    ledgers.forEach((ledger) => {
      map.set(ledger.id, ledger.name);
    });
    return map;
  }, [ledgers]);

  // filteredExpenseTransactions already carries items (list endpoint eager-loads them).
  const expenseTransactionsWithItems = filteredExpenseTransactions;

  // Group expenses by ledger (expense ledgers only, excluding charges)
  const expensesByLedger = useMemo(() => {
    const ledgerTotals = new Map<number, number>();

    // Process transactions with items
    if (expenseTransactionsWithItems.length > 0) {
      expenseTransactionsWithItems.forEach((transaction) => {
        // Find all DEBIT items that are expense ledgers (not charge ledgers)
        (transaction.items ?? []).forEach((item) => {
          if (item.entry_type === "DEBIT") {
            // Check if this ledger is an expense ledger (not a charge ledger)
            const ledger = ledgers.find(l => l.id === item.ledger_id);
            if (ledger && expenseLedgers.some(el => el.id === ledger.id)) {
              const amount =
                typeof item.amount === "string"
                  ? parseFloat(item.amount)
                  : Number(item.amount) || 0;

              if (amount > 0) {
                const existing = ledgerTotals.get(item.ledger_id) || 0;
                ledgerTotals.set(item.ledger_id, existing + amount);
              }
            }
          }
        });
      });
    }

    // Calculate total expenses (for percentage calculation)
    const totalExpenses = Array.from(ledgerTotals.values()).reduce(
      (sum, total) => sum + total,
      0
    );

    // Build result array with ledger names
    const result = Array.from(ledgerTotals.entries())
      .map(([ledgerId, total]) => {
        const ledgerName = ledgerMap.get(ledgerId) || `Unknown (ID: ${ledgerId})`;
        return {
          name: ledgerName,
          value: Number(total.toFixed(2)),
          percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);

    return result;
  }, [
    expenseTransactionsWithItems,
    ledgerMap,
    ledgers,
    expenseLedgers,
  ]);

  // Map of ledger_item.id to item name
  const itemNameMap = useMemo(() => {
    const map = new Map<number, string>();
    ledgerItems.forEach((item) => {
      map.set(item.id, item.name);
    });
    return map;
  }, [ledgerItems]);

  // Group expenses by item (what was bought), instead of by ledger
  const expensesByItem = useMemo(() => {
    const itemTotals = new Map<number, number>();

    expenseTransactionsWithItems.forEach((transaction) => {
      (transaction.items ?? []).forEach((item) => {
        if (item.entry_type !== "DEBIT" || !item.item_id) return;
        const amount =
          typeof item.amount === "string" ? parseFloat(item.amount) : Number(item.amount) || 0;
        if (amount <= 0) return;
        const existing = itemTotals.get(item.item_id) || 0;
        itemTotals.set(item.item_id, existing + amount);
      });
    });

    const totalExpenses = Array.from(itemTotals.values()).reduce((sum, total) => sum + total, 0);

    return Array.from(itemTotals.entries())
      .map(([itemId, total]) => ({
        name: itemNameMap.get(itemId) || `Unknown item (ID: ${itemId})`,
        value: Number(total.toFixed(2)),
        percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactionsWithItems, itemNameMap]);

  const [breakdownGroupBy, setBreakdownGroupBy] = useState<"ledger" | "item">("ledger");
  const activeBreakdown = breakdownGroupBy === "item" ? expensesByItem : expensesByLedger;
  const activeBreakdownLabel = breakdownGroupBy === "item" ? "item" : "ledger";

  const activeBreakdownDisplay = useMemo(
    () => withMinDisplayShare(activeBreakdown, 4),
    [activeBreakdown]
  );

  const breakdownTotal = useMemo(
    () => activeBreakdown.reduce((sum, entry) => sum + entry.value, 0),
    [activeBreakdown]
  );

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await Promise.all([
        refetchExpenses(),
        refetchLedgers(),
        refetchLedgerItems(),
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const headerActions = useMemo(
    () => [
      {
        label: isRefreshing ? "Refreshing..." : "Refresh",
        onClick: () => void handleRefresh(),
        disabled: isRefreshing,
        icon: (
          <svg
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
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
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRefreshing]
  );
  usePageHeaderActions(headerActions);

  // Don't show loading screen if we're just checking auth - only show if actually loading
  if (!isAuthenticated && !isLoading) {
    return null; // Will redirect, don't render anything
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      {!isEmbedded && (
        <Header
          onMenuClick={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
      )}
      {!isEmbedded && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isLoggedIn={isAuthenticated}
        />
      )}
      <main
        className={
          isEmbedded
            ? "flex-1"
            : `flex-1 transition-all duration-300 ${
                isSidebarOpen && isAuthenticated ? "lg:ml-60" : "lg:ml-0"
              }`
        }
      >
        <div className="container mx-auto px-4 pb-8 md:px-6 md:pb-12">
          {/* Expenses by Ledger Chart */}
          <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Expenses
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={breakdownView}
                    onChange={(e) => setBreakdownView(e.target.value as "chart" | "table")}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    <option value="chart">Chart</option>
                    <option value="table">Table</option>
                  </select>

                  <select
                    value={breakdownGroupBy}
                    onChange={(e) => setBreakdownGroupBy(e.target.value as "ledger" | "item")}
                    className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 focus:outline-none dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                  >
                    <option value="ledger">Ledger</option>
                    <option value="item">Item</option>
                  </select>

                  <select
                    value={periodType}
                    onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 focus:outline-none dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                  >
                    <option value="month">Month</option>
                    <option value="quarter">Quarter</option>
                    <option value="half_year">Half Year</option>
                    <option value="year">Year</option>
                    <option value="custom">Custom</option>
                  </select>

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
                  ) : periodType === "quarter" ? (
                    <DatePicker
                      selected={selectedQuarterDate}
                      onChange={(date: Date | null) => {
                        if (date) setSelectedQuarterDate(date);
                      }}
                      dateFormat="QQQ yyyy"
                      showQuarterYearPicker
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-40"
                      popperPlacement="bottom-start"
                    />
                  ) : periodType === "half_year" ? (
                    <div className="flex items-center gap-2">
                      <DatePicker
                        selected={selectedYearDate}
                        onChange={(date: Date | null) => {
                          if (date) setSelectedYearDate(date);
                        }}
                        dateFormat="yyyy"
                        showYearPicker
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-28"
                        popperPlacement="bottom-start"
                      />
                      <select
                        value={selectedHalf}
                        onChange={(e) => setSelectedHalf(Number(e.target.value) as 1 | 2)}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        <option value={1}>H1 (Jan-Jun)</option>
                        <option value={2}>H2 (Jul-Dec)</option>
                      </select>
                    </div>
                  ) : periodType === "year" ? (
                    <DatePicker
                      selected={selectedYearDate}
                      onChange={(date: Date | null) => {
                        if (date) setSelectedYearDate(date);
                      }}
                      dateFormat="yyyy"
                      showYearPicker
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-28"
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
            </div>
            {isLoadingTransactions ? (
              <div className="py-12 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">Loading expense breakdown...</p>
              </div>
            ) : activeBreakdown.length > 0 ? (
              breakdownView === "table" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {formatKsh(breakdownTotal)}
                    </p>
                  </div>

                  {/* Mobile: stacked cards */}
                  <div className="space-y-2 md:hidden">
                    {activeBreakdown.map((item, index) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                              {item.name}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">
                              {formatKsh(item.value)}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {item.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(item.percentage, 100)}%`,
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                          <th className="px-4 py-3 capitalize">{activeBreakdownLabel}</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {activeBreakdown.map((item, index) => (
                          <tr
                            key={item.name}
                            className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatKsh(item.value)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-zinc-500 dark:text-zinc-400">
                                  {item.percentage.toFixed(1)}%
                                </span>
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(item.percentage, 100)}%`,
                                      backgroundColor: COLORS[index % COLORS.length],
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100">
                          <td className="px-4 py-3">Total</td>
                          <td className="px-4 py-3 text-right">{formatKsh(breakdownTotal)}</td>
                          <td className="px-4 py-3 text-right">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Total: {formatKsh(breakdownTotal)}
                </p>
                {/* Pie Chart */}
                <div className="flex items-center justify-center min-h-0 p-0 sm:p-2 md:p-2">
                  <div className="w-full h-[360px] max-h-[65vh] sm:h-[440px] md:h-[500px] lg:h-[560px] [&_svg]:outline-none [&_svg]:focus:outline-none [&_svg]:overflow-visible">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 110, bottom: 20, left: 110 }}>
                        <Pie
                          data={activeBreakdownDisplay}
                          cx="50%"
                          cy="30%"
                          outerRadius="60%"
                          label={renderElbowPieLabel(activeBreakdownDisplay, formatKsh)}
                          labelLine={false}
                          isAnimationActive={false}
                        fill="#8884d8"
                        dataKey="displayValue"
                      >
                        {activeBreakdownDisplay.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(_value: any, _name: any, item: any) => formatKsh(item?.payload?.value ?? 0)}
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          border: "1px solid #e4e4e7",
                          borderRadius: "0.5rem",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              </div>
              )
            ) : (
              <div className="py-12 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">
                  {filteredExpenseTransactions.length === 0
                    ? "No expense transactions yet. Start recording expenses to see expense breakdown."
                    : expenseLedgers.length === 0
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

const expensesSuspenseFallback = (
  <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
  </div>
);

export default memo(function ExpensesPage() {
  return (
    <Suspense fallback={expensesSuspenseFallback}>
      <ExpensesContent />
    </Suspense>
  );
});
