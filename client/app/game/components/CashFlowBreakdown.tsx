"use client";

import { useState } from "react";
import { Dialog } from "@/components/Dialog";

interface CashFlowBreakdownProps {
  cashIn: number;
  cashOut: number;
  cashInBreakdown: Array<{ source: string; amount: number }>;
  cashOutBreakdown: Array<{ source: string; amount: number }>;
}

export function CashFlowBreakdown({
  cashIn,
  cashOut,
  cashInBreakdown,
  cashOutBreakdown,
}: CashFlowBreakdownProps) {
  const [showCashInDialog, setShowCashInDialog] = useState(false);
  const [showCashOutDialog, setShowCashOutDialog] = useState(false);

  const netCash = cashIn - cashOut;

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
      <div className="grid gap-4 md:grid-cols-3">
        {/* Cash In */}
        <div
          className="cursor-pointer rounded-xl border-2 border-green-200 bg-green-50 p-4 shadow-sm transition-all hover:border-green-300 hover:shadow-md dark:border-green-800 dark:bg-green-900/20"
          onClick={() => setShowCashInDialog(true)}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-green-700 dark:text-green-300">
              Cash In
            </div>
            <span className="text-lg">💰</span>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            +KSh {cashIn.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-green-600 dark:text-green-400">
            Click to see details
          </div>
        </div>

        {/* Cash Out */}
        <div
          className="cursor-pointer rounded-xl border-2 border-red-200 bg-red-50 p-4 shadow-sm transition-all hover:border-red-300 hover:shadow-md dark:border-red-800 dark:bg-red-900/20"
          onClick={() => setShowCashOutDialog(true)}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-red-700 dark:text-red-300">
              Cash Out
            </div>
            <span className="text-lg">💸</span>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            -KSh {cashOut.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-red-600 dark:text-red-400">
            Click to see details
          </div>
        </div>

        {/* Net Cash */}
        <div
          className={`rounded-xl border-2 p-4 shadow-sm ${
            netCash >= 0
              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
              : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div
              className={`text-sm font-medium ${
                netCash >= 0
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              Net Cash
            </div>
            <span className="text-lg">{netCash >= 0 ? "📈" : "📉"}</span>
          </div>
          <div
            className={`text-2xl font-bold ${
              netCash >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {netCash >= 0 ? "+" : ""}KSh {netCash.toLocaleString()}
          </div>
          <div
            className={`mt-1 text-xs ${
              netCash >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {cashIn.toLocaleString()} - {cashOut.toLocaleString()}
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

