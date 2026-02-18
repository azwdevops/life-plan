"use client";

import type { GameState, MarketCondition } from "../types";
import { CashFlowBreakdown } from "./CashFlowBreakdown";

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface GameStatsProps {
  gameState: GameState;
  currentDate: Date;
}

const marketConditionLabels: Record<MarketCondition, { label: string; color: string; emoji: string }> = {
  boom: { label: "Boom", color: "text-green-600 dark:text-green-400", emoji: "📈" },
  normal: { label: "Normal", color: "text-blue-600 dark:text-blue-400", emoji: "➡️" },
  recession: { label: "Recession", color: "text-amber-600 dark:text-amber-400", emoji: "📉" },
  depression: { label: "Depression", color: "text-red-600 dark:text-red-400", emoji: "🔻" },
};

export function GameStats({ gameState }: GameStatsProps) {
  const totalPortfolioValue = gameState.portfolio.reduce(
    (sum, owned) => sum + (owned.currentValue || owned.purchaseCost),
    0
  );
  const totalPurchaseCost = gameState.portfolio.reduce(
    (sum, owned) => sum + owned.purchaseCost,
    0
  );
  const totalAppreciation = totalPortfolioValue - totalPurchaseCost;

  const monthlyPassiveIncome = gameState.portfolio.reduce((sum, owned) => {
    const monthsSincePurchase = gameState.currentMonth - owned.purchaseMonth;
    const investment = owned.investment;
    
    // Use old values if extension happened in current month (new values apply from next month)
    const monthlyIncome = (owned.lastExtensionMonth === gameState.currentMonth && owned.monthlyIncomeBeforeExtension !== undefined)
      ? owned.monthlyIncomeBeforeExtension
      : investment.monthlyIncome;

    if (monthsSincePurchase > investment.incomeDelayMonths) {
      return sum + monthlyIncome;
    }
    return sum;
  }, 0);

  // Calculate gross cashflow (before tax) for all investments
  const monthlyGrossCashflow = gameState.portfolio.reduce((sum, owned) => {
    const monthsSincePurchase = gameState.currentMonth - owned.purchaseMonth;
    const investment = owned.investment;
    
    // Use old values if extension happened in current month (new values apply from next month)
    const monthlyCashflow = (owned.lastExtensionMonth === gameState.currentMonth && owned.monthlyCashflowBeforeExtension !== undefined)
      ? owned.monthlyCashflowBeforeExtension
      : investment.monthlyCashflow;

    if (
      monthsSincePurchase > investment.cashflowDelayMonths &&
      !owned.earlyCashflowTaken
    ) {
      return sum + monthlyCashflow;
    }
    return sum;
  }, 0);

  const monthlyMaintenance = gameState.portfolio.reduce((sum, owned) => {
    const monthsSincePurchase = gameState.currentMonth - owned.purchaseMonth;
    const investment = owned.investment;
    
    // Use old values if extension happened in current month (new values apply from next month)
    const monthlyMaintenance = (owned.lastExtensionMonth === gameState.currentMonth && owned.monthlyMaintenanceBeforeExtension !== undefined)
      ? owned.monthlyMaintenanceBeforeExtension
      : investment.monthlyMaintenance;
    
    if (monthsSincePurchase > 0) {
      return sum + monthlyMaintenance;
    }
    return sum;
  }, 0);

  // Net monthly cashflow = Gross cashflow - Taxes paid this month - Maintenance - Expenses
  // Use actual monthlyTaxPaid from gameState to match what's actually deducted
  const monthlyExpenses = gameState.totalExpenses || 0;
  const netMonthlyCashflow = monthlyGrossCashflow - (gameState.monthlyTaxPaid || 0) - monthlyMaintenance - monthlyExpenses;

  return (
    <div className="mb-8">
      {/* Market Condition Display */}
      <div className="mb-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Market Condition:</span>
            {gameState.marketCondition && marketConditionLabels[gameState.marketCondition] ? (
              <span className={`text-sm font-bold ${marketConditionLabels[gameState.marketCondition].color}`}>
                {marketConditionLabels[gameState.marketCondition].emoji} {marketConditionLabels[gameState.marketCondition].label}
              </span>
            ) : (
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                ➡️ Normal
              </span>
            )}
          </div>
          {gameState.marketCondition && gameState.marketCondition !== "normal" && (
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Returns are {gameState.marketCondition === "boom" ? "boosted" : "reduced"} by market conditions
            </div>
          )}
        </div>
      </div>

      {/* Cash Flow Breakdown */}
      <div className="mb-6">
        <CashFlowBreakdown
          cashIn={gameState.monthlyCashIn || 0}
          cashOut={gameState.monthlyCashOut || 0}
          cashInBreakdown={gameState.monthlyCashInBreakdown || []}
          cashOutBreakdown={gameState.monthlyCashOutBreakdown || []}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          Available Cash
        </div>
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          KSh {gameState.currentMoney.toLocaleString()}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          Portfolio Value
        </div>
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          KSh {totalPortfolioValue.toLocaleString()}
        </div>
        {totalAppreciation !== 0 && (
          <div className={`text-xs ${
            totalAppreciation > 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}>
            {totalAppreciation > 0 ? "📈" : "📉"} 
            {totalAppreciation > 0 ? "+" : ""}KSh {Math.abs(totalAppreciation).toLocaleString()} 
            ({totalAppreciation > 0 ? "+" : ""}{((totalAppreciation / totalPurchaseCost) * 100).toFixed(1)}%)
          </div>
        )}
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Purchase cost: KSh {totalPurchaseCost.toLocaleString()}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          Monthly Income
        </div>
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          +KSh {monthlyPassiveIncome.toLocaleString()}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          (Profit recognized)
        </div>
      </div>


      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          Accrued Income
        </div>
        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
          KSh {gameState.accruedIncome.toLocaleString()}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          (Earned, not received)
        </div>
      </div>

      {gameState.totalDebt > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="mb-2 text-sm text-red-600 dark:text-red-400">
            Total Debt
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            KSh {gameState.totalDebt.toLocaleString()}
          </div>
          <div className="text-xs text-red-500 dark:text-red-400">
            {gameState.loans.length} active loan{gameState.loans.length > 1 ? "s" : ""}
          </div>
        </div>
      )}

      {gameState.monthlyTaxPaid > 0 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm dark:border-purple-800 dark:bg-purple-900/20">
          <div className="mb-2 text-sm text-purple-600 dark:text-purple-400">
            Taxes This Month
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            -KSh {gameState.monthlyTaxPaid.toLocaleString()}
          </div>
          <div className="text-xs text-purple-500 dark:text-purple-400">
            Total paid: KSh {gameState.totalTaxPaid.toLocaleString()}
          </div>
        </div>
      )}

      {/* Diversification Score */}
      {gameState.portfolio.length > 0 && (
        <div className="col-span-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Portfolio Diversification
            </span>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {(gameState.diversificationScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800">
            <div
              className="h-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-400"
              style={{ width: `${gameState.diversificationScore * 100}%` }}
            />
          </div>
          {gameState.portfolioRiskReduction > 0 && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              ✅ Risk reduced by {(gameState.portfolioRiskReduction * 100).toFixed(0)}% through diversification
            </div>
          )}
          {gameState.diversificationScore < 0.5 && gameState.portfolio.length > 1 && (
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              💡 Tip: Diversify across different investment types (real estate, vehicles, financial) to reduce risk
            </div>
          )}
        </div>
      )}

      {/* Opportunity Cost Display */}
      {gameState.monthlyOpportunityCost > 0 && (
        <div className="col-span-full rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm dark:border-orange-800 dark:bg-orange-900/20">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Opportunity Cost This Month
            </span>
            <span className="text-lg font-bold text-orange-700 dark:text-orange-300">
              -KSh {gameState.monthlyOpportunityCost.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400">
            Cost of capital tied up in lock-in periods and illiquid investments
          </div>
          <div className="mt-1 text-xs text-orange-500 dark:text-orange-400">
            Total opportunity cost: KSh {gameState.totalOpportunityCost.toLocaleString()}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
