"use client";

import { useMemo } from "react";
import type { GameState } from "../types";
import { CashFlowBreakdown } from "./CashFlowBreakdown";

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getDateFromMonth(startDate: Date, monthOffset: number): Date {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

interface GameStatsProps {
  gameState: GameState;
  currentDate: Date;
  onAdvanceMonth?: () => void;
}

export function GameStats({ gameState, currentDate, onAdvanceMonth }: GameStatsProps) {
  const totalPortfolioValue = gameState.portfolio.reduce(
    (sum, owned) => sum + (owned.currentValue || owned.purchaseCost),
    0
  );
  const totalPurchaseCost = gameState.portfolio.reduce(
    (sum, owned) => sum + owned.purchaseCost,
    0
  );
  const totalAppreciation = totalPortfolioValue - totalPurchaseCost;

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
    <>
        {/* Current Date */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Current Date</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatMonthYear(currentDate)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Month {gameState.currentMonth} from start
              </div>
            </div>
            {!gameState.gameOver && onAdvanceMonth && (
              <button
                onClick={onAdvanceMonth}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
              >
                Advance to {formatMonthYear(getDateFromMonth(gameState.startDate, gameState.currentMonth + 1))}
              </button>
            )}
          </div>
        </div>

        {/* Portfolio Value */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Portfolio Value</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalPortfolioValue.toLocaleString()}
            </span>
          </div>
          {totalAppreciation !== 0 && (
            <div className={`mt-1 text-right text-xs ${
              totalAppreciation > 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {totalAppreciation > 0 ? "📈" : "📉"}
              {totalAppreciation > 0 ? "+" : ""}{Math.abs(totalAppreciation).toLocaleString()}
              ({totalAppreciation > 0 ? "+" : ""}{((totalAppreciation / totalPurchaseCost) * 100).toFixed(1)}%)
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Purchase cost</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {totalPurchaseCost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Cash Flow Overview */}
        <div className="min-w-[280px] flex-1 basis-full lg:basis-auto">
        {(() => {
          // Calculate expected cash in/out for next month with breakdowns
          const nextMonth = gameState.currentMonth + 1;
          let expectedCashIn = 0;
          let expectedCashOut = 0;
          const expectedCashInBreakdown: Array<{ source: string; amount: number }> = [];
          const expectedCashOutBreakdown: Array<{ source: string; amount: number }> = [];

          // Expected cash in from investments
          gameState.portfolio.forEach((owned) => {
            const monthsSincePurchase = nextMonth - owned.purchaseMonth;
            const investment = owned.investment;
            
            // Use new values if extension happened before next month
            const baseMonthlyCashflow = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth < nextMonth)
              ? investment.monthlyCashflow
              : (owned.lastExtensionMonth === nextMonth && owned.monthlyCashflowBeforeExtension !== undefined)
              ? owned.monthlyCashflowBeforeExtension
              : investment.monthlyCashflow;

            if (monthsSincePurchase > investment.cashflowDelayMonths && baseMonthlyCashflow > 0 && !owned.earlyCashflowTaken) {
              // Apply tax if applicable
              let afterTaxCashflow = baseMonthlyCashflow;
              if (investment.incomeTaxRate && !investment.isTaxExempt && investment.incomeTaxRate > 0) {
                const taxAmount = Math.round(baseMonthlyCashflow * investment.incomeTaxRate);
                afterTaxCashflow = baseMonthlyCashflow - taxAmount;
              }
              expectedCashIn += afterTaxCashflow;
              expectedCashInBreakdown.push({ source: `${investment.name} (Cashflow)`, amount: afterTaxCashflow });
            }
          });

          // Expected cash in from invoices
          gameState.invoices.forEach((invoice) => {
            if (invoice.status === "pending" && invoice.paymentDueMonth === nextMonth && !invoice.isDiscounted) {
              expectedCashIn += invoice.amount;
              expectedCashInBreakdown.push({ source: `Invoice ${invoice.invoiceNumber}`, amount: invoice.amount });
            }
          });

          // Expected cash in from gigs (payment due next month)
          (gameState.pendingGigs ?? []).forEach((gig) => {
            if (gig.dueMonth === nextMonth) {
              expectedCashIn += gig.amount;
              expectedCashInBreakdown.push({ source: `Gig: ${gig.title}`, amount: gig.amount });
            }
          });

          // Expected cash out: maintenance
          gameState.portfolio.forEach((owned) => {
            const monthsSincePurchase = nextMonth - owned.purchaseMonth;
            const investment = owned.investment;
            
            const baseMonthlyMaintenance = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth < nextMonth)
              ? investment.monthlyMaintenance
              : (owned.lastExtensionMonth === nextMonth && owned.monthlyMaintenanceBeforeExtension !== undefined)
              ? owned.monthlyMaintenanceBeforeExtension
              : investment.monthlyMaintenance;

            if (baseMonthlyMaintenance > 0 && monthsSincePurchase > 0) {
              expectedCashOut += baseMonthlyMaintenance;
              expectedCashOutBreakdown.push({ source: `${investment.name} (Maintenance)`, amount: baseMonthlyMaintenance });
            }
          });

          // Expected cash out: expenses
          const activeExpenses = gameState.expenses.filter((exp) => exp.isActive);
          activeExpenses.forEach((exp) => {
            expectedCashOut += exp.amount;
            expectedCashOutBreakdown.push({ source: `Expense: ${exp.name}`, amount: exp.amount });
          });

          // Expected cash out: loan payments
          gameState.loans.forEach((loan) => {
            const monthsSinceLoan = nextMonth - loan.startMonth;
            
            if (loan.type === "overdraft") {
              const monthlyRate = loan.interestRate / 12;
              const interestPayment = Math.round(loan.remainingBalance * monthlyRate);
              expectedCashOut += interestPayment;
              expectedCashOutBreakdown.push({ source: `Loan (Overdraft) Interest`, amount: interestPayment });
            } else if (loan.termMonths > 0 && monthsSinceLoan < loan.termMonths) {
              expectedCashOut += loan.monthlyPayment;
              expectedCashOutBreakdown.push({ source: `Loan (${loan.type === "short_term" ? "Short-term" : "Long-term"}) Payment`, amount: loan.monthlyPayment });
            }
          });

          return (
            <CashFlowBreakdown
              cashIn={gameState.monthlyCashIn || 0}
              cashOut={gameState.monthlyCashOut || 0}
              cashInBreakdown={gameState.monthlyCashInBreakdown || []}
              cashOutBreakdown={gameState.monthlyCashOutBreakdown || []}
              previousCashIn={gameState.previousMonthCashIn || 0}
              previousCashOut={gameState.previousMonthCashOut || 0}
              expectedCashIn={expectedCashIn}
              expectedCashOut={expectedCashOut}
              expectedCashInBreakdown={expectedCashInBreakdown}
              expectedCashOutBreakdown={expectedCashOutBreakdown}
            />
          );
        })()}
        </div>
    </>
  );
}
