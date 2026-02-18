"use client";

import type { GameState, OwnedInvestment } from "../types";

interface GameOverSummaryProps {
  gameState: GameState;
  startDate: Date;
}

function getDateFromMonth(startDate: Date, monthOffset: number): Date {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function GameOverSummary({ gameState, startDate }: GameOverSummaryProps) {
  // Calculate portfolio value (current value of all investments)
  const totalPortfolioValue = gameState.portfolio.reduce((sum, owned) => {
    return sum + (owned.currentValue || owned.purchaseCost);
  }, 0);

  // Calculate net worth (cash + portfolio value - debt)
  const netWorth = gameState.currentMoney + totalPortfolioValue - gameState.totalDebt;

  // Calculate total invested (including extensions)
  const totalInvested = gameState.portfolio.reduce((sum, owned) => {
    return sum + owned.purchaseCost;
  }, 0);

  // Calculate ROI
  const totalReturns = gameState.totalIncome + gameState.totalCashflow;
  const roi = totalInvested > 0 ? ((totalReturns - totalInvested) / totalInvested) * 100 : 0;

  // Group investments by type
  const investmentsByType = gameState.portfolio.reduce((acc, owned) => {
    const type = owned.investment.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(owned);
    return acc;
  }, {} as Record<string, OwnedInvestment[]>);

  // Calculate average monthly income
  const averageMonthlyIncome = gameState.currentMonth > 0
    ? gameState.totalIncome / gameState.currentMonth
    : 0;

  // Calculate average monthly cashflow
  const averageMonthlyCashflow = gameState.currentMonth > 0
    ? gameState.totalCashflow / gameState.currentMonth
    : 0;

  return (
    <div className="mb-6 rounded-xl border-4 border-red-500 bg-red-50 p-6 shadow-lg dark:border-red-800 dark:bg-red-900/30">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-4xl">💀</span>
        <div>
          <h2 className="text-3xl font-bold text-red-900 dark:text-red-100">Game Over</h2>
          <p className="mt-1 text-red-700 dark:text-red-300">
            {gameState.gameOverReason || "Your cashflow went negative and you don't qualify for borrowing."}
          </p>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">Game Duration</div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {gameState.currentMonth} month{gameState.currentMonth !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatMonthYear(getDateFromMonth(startDate, 0))} - {formatMonthYear(getDateFromMonth(startDate, gameState.currentMonth))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">Total Invested</div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            KSh {totalInvested.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {gameState.portfolio.length} investment{gameState.portfolio.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-800 dark:bg-green-900/20">
          <div className="mb-1 text-xs text-green-600 dark:text-green-400">Total Income</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            KSh {gameState.totalIncome.toLocaleString()}
          </div>
          <div className="text-xs text-green-500 dark:text-green-400">
            Avg: KSh {Math.round(averageMonthlyIncome).toLocaleString()}/month
          </div>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-800 dark:bg-green-900/20">
          <div className="mb-1 text-xs text-green-600 dark:text-green-400">Total Cashflow</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            KSh {gameState.totalCashflow.toLocaleString()}
          </div>
          <div className="text-xs text-green-500 dark:text-green-400">
            Avg: KSh {Math.round(averageMonthlyCashflow).toLocaleString()}/month
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <div className="mb-1 text-xs text-blue-600 dark:text-blue-400">Portfolio Value</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            KSh {totalPortfolioValue.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="mb-1 text-xs text-red-600 dark:text-red-400">Total Debt</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            KSh {gameState.totalDebt.toLocaleString()}
          </div>
          <div className="text-xs text-red-500 dark:text-red-400">
            {gameState.loans.length} loan{gameState.loans.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 shadow-sm dark:border-purple-800 dark:bg-purple-900/20">
          <div className="mb-1 text-xs text-purple-600 dark:text-purple-400">Total Taxes Paid</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            KSh {gameState.totalTaxPaid.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mb-1 text-xs text-amber-600 dark:text-amber-400">Monthly Expenses</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            KSh {gameState.totalExpenses.toLocaleString()}
          </div>
          <div className="text-xs text-amber-500 dark:text-amber-400">
            {gameState.expenses.filter((e) => e.isActive).length} active expense{gameState.expenses.filter((e) => e.isActive).length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Cash Flow Analysis */}
      {gameState.monthlyCashInBreakdown && gameState.monthlyCashInBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Final Month Cash Flow Analysis
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <div className="mb-2 text-sm font-semibold text-green-700 dark:text-green-300">
                Cash In: KSh {(gameState.monthlyCashIn || 0).toLocaleString()}
              </div>
              <div className="space-y-1 text-xs text-green-600 dark:text-green-400">
                {gameState.monthlyCashInBreakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.source}:</span>
                    <span className="font-semibold">+KSh {item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">
                Cash Out: KSh {(gameState.monthlyCashOut || 0).toLocaleString()}
              </div>
              <div className="space-y-1 text-xs text-red-600 dark:text-red-400">
                {gameState.monthlyCashOutBreakdown && gameState.monthlyCashOutBreakdown.length > 0 ? (
                  gameState.monthlyCashOutBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.source}:</span>
                      <span className="font-semibold">-KSh {item.amount.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 dark:text-zinc-400">No cash out recorded</div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border-2 border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-800">
            <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">Net Cash Flow (Final Month)</div>
            <div className={`text-2xl font-bold ${
              (gameState.monthlyCashIn || 0) - (gameState.monthlyCashOut || 0) >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {(gameState.monthlyCashIn || 0) - (gameState.monthlyCashOut || 0) >= 0 ? "+" : ""}
              KSh {((gameState.monthlyCashIn || 0) - (gameState.monthlyCashOut || 0)).toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Available cash: KSh {gameState.currentMoney.toLocaleString()} | 
              Needed: KSh {(gameState.monthlyCashOut || 0).toLocaleString()} | 
              Had: KSh {(gameState.monthlyCashIn || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Net Worth and ROI */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border-2 border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
          <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">Net Worth</div>
          <div className={`text-3xl font-bold ${netWorth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            KSh {netWorth.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Cash: KSh {gameState.currentMoney.toLocaleString()} + Portfolio: KSh {totalPortfolioValue.toLocaleString()} - Debt: KSh {gameState.totalDebt.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border-2 border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
          <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">Return on Investment (ROI)</div>
          <div className={`text-3xl font-bold ${roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Returns: KSh {totalReturns.toLocaleString()} / Invested: KSh {totalInvested.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Investment Breakdown */}
      {gameState.portfolio.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Investment Portfolio
          </h3>
          <div className="space-y-3">
            {Object.entries(investmentsByType).map(([type, investments]) => (
              <div
                key={type}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{investments[0].investment.icon}</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                      {type.replace("_", " ")} ({investments.length})
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      KSh {investments.reduce((sum, inv) => sum + (inv.currentValue || inv.purchaseCost), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Invested: KSh {investments.reduce((sum, inv) => sum + inv.purchaseCost, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {investments.map((inv, idx) => (
                    <span key={inv.id}>
                      {inv.investment.name}
                      {idx < investments.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices Summary */}
      {gameState.invoices.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Invoices Summary
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Total Invoices</div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {gameState.invoices.length}
              </div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <div className="text-xs text-green-600 dark:text-green-400">Paid</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {gameState.invoices.filter((inv) => inv.status === "paid").length}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="text-xs text-amber-600 dark:text-amber-400">Pending</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {gameState.invoices.filter((inv) => inv.status === "pending").length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

