"use client";

import { useState, useMemo } from "react";
import { Dialog } from "@/components/Dialog";

interface CashFlowBreakdownProps {
  cashIn: number;
  cashOut: number;
  cashInBreakdown: Array<{ source: string; amount: number }>;
  cashOutBreakdown: Array<{ source: string; amount: number }>;
  previousCashIn: number;
  previousCashOut: number;
  expectedCashIn: number;
  expectedCashOut: number;
  // Optional: breakdowns for previous and expected months
  previousCashInBreakdown?: Array<{ source: string; amount: number }>;
  previousCashOutBreakdown?: Array<{ source: string; amount: number }>;
  expectedCashInBreakdown?: Array<{ source: string; amount: number }>;
  expectedCashOutBreakdown?: Array<{ source: string; amount: number }>;
}

export function CashFlowBreakdown({
  cashIn,
  cashOut,
  cashInBreakdown,
  cashOutBreakdown,
  previousCashIn,
  previousCashOut,
  expectedCashIn,
  expectedCashOut,
  previousCashInBreakdown = [],
  previousCashOutBreakdown = [],
  expectedCashInBreakdown = [],
  expectedCashOutBreakdown = [],
}: CashFlowBreakdownProps) {
  const [showDialog, setShowDialog] = useState<"previous" | "current" | "expected" | null>(null);

  const netCash = cashIn - cashOut;
  const previousNetCash = previousCashIn - previousCashOut;
  const expectedNetCash = expectedCashIn - expectedCashOut;

  // Group breakdown by source helper function
  const groupBreakdown = (breakdown: Array<{ source: string; amount: number }>) => {
    return breakdown.reduce((acc, item) => {
      const existing = acc.find((x) => x.source === item.source);
      if (existing) {
        existing.amount += item.amount;
      } else {
        acc.push({ ...item });
      }
      return acc;
    }, [] as Array<{ source: string; amount: number }>);
  };

  // Group all breakdowns
  const groupedCashIn = useMemo(() => groupBreakdown(cashInBreakdown), [cashInBreakdown]);
  const groupedCashOut = useMemo(() => groupBreakdown(cashOutBreakdown), [cashOutBreakdown]);
  const groupedPreviousCashIn = useMemo(() => groupBreakdown(previousCashInBreakdown), [previousCashInBreakdown]);
  const groupedPreviousCashOut = useMemo(() => groupBreakdown(previousCashOutBreakdown), [previousCashOutBreakdown]);
  const groupedExpectedCashIn = useMemo(() => groupBreakdown(expectedCashInBreakdown), [expectedCashInBreakdown]);
  const groupedExpectedCashOut = useMemo(() => groupBreakdown(expectedCashOutBreakdown), [expectedCashOutBreakdown]);

  // Get data for the selected month
  const getDialogData = () => {
    if (showDialog === "previous") {
      return {
        cashIn: previousCashIn,
        cashOut: previousCashOut,
        cashInBreakdown: groupedPreviousCashIn,
        cashOutBreakdown: groupedPreviousCashOut,
        title: "Previous Month Details",
      };
    } else if (showDialog === "current") {
      return {
        cashIn,
        cashOut,
        cashInBreakdown: groupedCashIn,
        cashOutBreakdown: groupedCashOut,
        title: "Current Month Details",
      };
    } else if (showDialog === "expected") {
      return {
        cashIn: expectedCashIn,
        cashOut: expectedCashOut,
        cashInBreakdown: groupedExpectedCashIn,
        cashOutBreakdown: groupedExpectedCashOut,
        title: "Expected Next Month Details",
      };
    }
    return null;
  };

  const dialogData = getDialogData();

  return (
    <>
      <div className="rounded-xl border-2 border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Cash Flow Overview
          </h3>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Previous Month */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Previous Month
              </div>
              <button
                onClick={() => setShowDialog("previous")}
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                View Details
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash In:</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +previousCashIn.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash Out:</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -previousCashOut.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-zinc-300 pt-2 dark:border-zinc-600">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Net:</span>
                  <span
                    className={`text-base font-bold ${
                      previousNetCash >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {previousNetCash >= 0 ? "+" : ""}previousNetCash.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Month */}
          <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  Current Month
                </div>
                <span className="text-xs rounded-full bg-blue-200 px-2 py-0.5 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                  Active
                </span>
              </div>
              <button
                onClick={() => setShowDialog("current")}
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                View Details
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash In:</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +cashIn.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash Out:</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -cashOut.toLocaleString()}
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
                    {netCash >= 0 ? "+" : ""}netCash.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expected (Next Month) */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Expected (Next Month)
              </div>
              <button
                onClick={() => setShowDialog("expected")}
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                View Details
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash In:</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +expectedCashIn.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash Out:</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -expectedCashOut.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-zinc-300 pt-2 dark:border-zinc-600">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Net:</span>
                  <span
                    className={`text-base font-bold ${
                      expectedNetCash >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {expectedNetCash >= 0 ? "+" : ""}expectedNetCash.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Combined Cash In/Out Dialog */}
      {dialogData && (
        <Dialog
          isOpen={showDialog !== null}
          onClose={() => setShowDialog(null)}
          title={dialogData.title}
          size="xl"
        >
          <div className="space-y-4">
            {/* Details: Cash In on Left, Cash Out on Right */}
            <div className="grid grid-cols-2 gap-4">
              {/* Cash In Column */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Cash In
                </div>
                {dialogData.cashInBreakdown.length > 0 ? (
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {dialogData.cashInBreakdown
                      .sort((a, b) => b.amount - a.amount)
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-800"
                        >
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">
                            {item.source}
                          </span>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            +item.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                    No cash received
                  </div>
                )}
              </div>

              {/* Cash Out Column */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Cash Out
                </div>
                {dialogData.cashOutBreakdown.length > 0 ? (
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {dialogData.cashOutBreakdown
                      .sort((a, b) => b.amount - a.amount)
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-800"
                        >
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">
                            {item.source}
                          </span>
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                            -item.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                    No cash spent
                  </div>
                )}
              </div>
            </div>

            {/* Totals Summary */}
            <div className="border-t border-zinc-300 pt-3 dark:border-zinc-600">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Total Cash In:</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    +dialogData.cashIn.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Total Cash Out:</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    -dialogData.cashOut.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-2 dark:border-zinc-600">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Net Cash:</span>
                <span
                  className={`text-base font-bold ${
                    (dialogData.cashIn - dialogData.cashOut) >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {(dialogData.cashIn - dialogData.cashOut) >= 0 ? "+" : ""}(dialogData.cashIn - dialogData.cashOut).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowDialog(null)}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Close
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

