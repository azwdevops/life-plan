"use client";

import { useState } from "react";
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
}: CashFlowBreakdownProps) {
  const [showCashInDialog, setShowCashInDialog] = useState(false);
  const [showCashOutDialog, setShowCashOutDialog] = useState(false);

  const netCash = cashIn - cashOut;
  const previousNetCash = previousCashIn - previousCashOut;
  const expectedNetCash = expectedCashIn - expectedCashOut;

  // Group breakdown by source
  const groupedCashIn = cashInBreakdown.reduce((acc, item) => {
    const existing = acc.find((x) => x.source === item.source);
    if (existing) {
      existing.amount += item.amount;
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, [] as Array<{ source: string; amount: number }>);

  const groupedCashOut = cashOutBreakdown.reduce((acc, item) => {
    const existing = acc.find((x) => x.source === item.source);
    if (existing) {
      existing.amount += item.amount;
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, [] as Array<{ source: string; amount: number }>);

  return (
    <>
      <div className="rounded-xl border-2 border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Cash Flow Overview
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCashInDialog(true)}
              className="rounded-lg bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
            >
              Cash In Details
            </button>
            <button
              onClick={() => setShowCashOutDialog(true)}
              className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              Cash Out Details
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Previous Month */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Previous Month
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash In:</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +KSh {previousCashIn.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash Out:</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -KSh {previousCashOut.toLocaleString()}
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
                    {previousNetCash >= 0 ? "+" : ""}KSh {previousNetCash.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Month */}
          <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Current Month
              </div>
              <span className="text-xs rounded-full bg-blue-200 px-2 py-0.5 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                Active
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash In:</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +KSh {cashIn.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash Out:</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -KSh {cashOut.toLocaleString()}
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
                    {netCash >= 0 ? "+" : ""}KSh {netCash.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expected (Next Month) */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Expected (Next Month)
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash In:</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +KSh {expectedCashIn.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Cash Out:</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -KSh {expectedCashOut.toLocaleString()}
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
                    {expectedNetCash >= 0 ? "+" : ""}KSh {expectedNetCash.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cash In Dialog */}
      <Dialog
        isOpen={showCashInDialog}
        onClose={() => setShowCashInDialog(false)}
        title="Cash In Breakdown"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <div className="text-sm text-green-600 dark:text-green-400">Total Cash In</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              +KSh {cashIn.toLocaleString()}
            </div>
          </div>
          {groupedCashIn.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Sources:
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {groupedCashIn
                  .sort((a, b) => b.amount - a.amount)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {item.source}
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        +KSh {item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              No cash received this month
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCashInDialog(false)}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>

      {/* Cash Out Dialog */}
      <Dialog
        isOpen={showCashOutDialog}
        onClose={() => setShowCashOutDialog(false)}
        title="Cash Out Breakdown"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <div className="text-sm text-red-600 dark:text-red-400">Total Cash Out</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              -KSh {cashOut.toLocaleString()}
            </div>
          </div>
          {groupedCashOut.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Expenses:
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {groupedCashOut
                  .sort((a, b) => b.amount - a.amount)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {item.source}
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        -KSh {item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              No cash spent this month
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCashOutDialog(false)}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

