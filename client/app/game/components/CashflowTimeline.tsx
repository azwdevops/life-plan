"use client";

import { useMemo } from "react";
import type { OwnedInvestment, Invoice, CashflowEvent } from "../types";

function getDateFromMonth(startDate: Date, monthOffset: number): Date {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface CashflowTimelineProps {
  portfolio: OwnedInvestment[];
  invoices: Invoice[];
  currentMonth: number;
  startDate: Date;
  onAdvanceMonth: () => void;
  disabled?: boolean;
}

export function CashflowTimeline({
  portfolio,
  invoices,
  currentMonth,
  startDate,
  onAdvanceMonth,
  disabled = false,
}: CashflowTimelineProps) {
  const currentDate = getDateFromMonth(startDate, currentMonth);
  const nextMonthDate = getDateFromMonth(startDate, currentMonth + 1);
  // Calculate cashflow events for the next 12 months
  const upcomingCashflow = useMemo(() => {
    const events: CashflowEvent[] = [];
    const monthsToShow = 12;

    for (let month = currentMonth + 1; month <= currentMonth + monthsToShow; month++) {
      let totalIncome = 0;
      let totalCashflow = 0;
      let totalMaintenance = 0;
      const sourceDetails: string[] = [];

      // Process investments
      portfolio.forEach((owned) => {
        const monthsSincePurchase = month - owned.purchaseMonth;
        const investment = owned.investment;

        // Use old values if extension happened in this month (new values apply from next month)
        // If extension happened in previous month (month - 1), use new values
        const baseMonthlyIncome = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === month && owned.monthlyIncomeBeforeExtension !== undefined)
          ? owned.monthlyIncomeBeforeExtension
          : investment.monthlyIncome;
        const baseMonthlyCashflow = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === month && owned.monthlyCashflowBeforeExtension !== undefined)
          ? owned.monthlyCashflowBeforeExtension
          : investment.monthlyCashflow;
        const baseMonthlyMaintenance = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === month && owned.monthlyMaintenanceBeforeExtension !== undefined)
          ? owned.monthlyMaintenanceBeforeExtension
          : investment.monthlyMaintenance;

        // Check if income and cashflow are both active and the same amount
        const hasIncome = monthsSincePurchase > investment.incomeDelayMonths && baseMonthlyIncome > 0;
        const hasCashflow = monthsSincePurchase > investment.cashflowDelayMonths && baseMonthlyCashflow > 0 && !owned.earlyCashflowTaken;
        const incomeEqualsCashflow = baseMonthlyIncome === baseMonthlyCashflow;

        // Recognize income
        if (hasIncome) {
          totalIncome += baseMonthlyIncome;
        }

        // Receive cashflow
        if (hasCashflow) {
          totalCashflow += baseMonthlyCashflow;
        }

        // Add source detail - consolidate if income and cashflow are the same
        if (hasIncome && hasCashflow && incomeEqualsCashflow) {
          // Income and cashflow are the same, show once
          sourceDetails.push(
            `${investment.name}: +${baseMonthlyIncome.toLocaleString()}`
          );
        } else {
          // Show separately if different
          if (hasIncome) {
            sourceDetails.push(
              `${investment.name} income: +${baseMonthlyIncome.toLocaleString()}`
            );
          }
          if (hasCashflow) {
            sourceDetails.push(
              `${investment.name} cash: +${baseMonthlyCashflow.toLocaleString()}`
            );
          }
        }

        // Maintenance costs
        if (baseMonthlyMaintenance > 0 && monthsSincePurchase > 0) {
          totalMaintenance += baseMonthlyMaintenance;
          sourceDetails.push(
            `${investment.name} maintenance: -${baseMonthlyMaintenance.toLocaleString()}`
          );
        }
      });

      // Process invoices
      invoices.forEach((invoice) => {
        if (invoice.status === "paid" || invoice.status === "discounted") return;

        if (month === invoice.paymentDueMonth) {
          if (!invoice.isDiscounted) {
            totalCashflow += invoice.amount;
            totalIncome += invoice.amount;
            sourceDetails.push(`Invoice ${invoice.invoiceNumber}: +${invoice.amount.toLocaleString()}`);
          }
        }
      });

      if (totalIncome > 0 || totalCashflow > 0 || totalMaintenance > 0 || sourceDetails.length > 0) {
        // Check if an event for this month already exists
        const existingEventIndex = events.findIndex((e) => e.month === month);
        if (existingEventIndex >= 0) {
          // Merge with existing event
          const existing = events[existingEventIndex];
          events[existingEventIndex] = {
            month,
            source: [existing.source, sourceDetails.join(", ")].filter(Boolean).join("; "),
            income: existing.income + totalIncome,
            cashflow: existing.cashflow + totalCashflow,
            maintenance: existing.maintenance + totalMaintenance,
            netCashflow: existing.cashflow + totalCashflow - (existing.maintenance + totalMaintenance),
            type: "investment",
          };
        } else {
          events.push({
            month,
            source: sourceDetails.join(", ") || "No activity",
            income: totalIncome,
            cashflow: totalCashflow,
            maintenance: totalMaintenance,
            netCashflow: totalCashflow - totalMaintenance,
            type: "investment",
          });
        }
      }
    }

    // Sort events by month and remove any duplicates
    const uniqueEvents = events.reduce((acc, event) => {
      const existing = acc.find((e) => e.month === event.month);
      if (existing) {
        // Merge duplicates
        existing.income += event.income;
        existing.cashflow += event.cashflow;
        existing.maintenance += event.maintenance;
        existing.netCashflow = existing.cashflow - existing.maintenance;
        existing.source = [existing.source, event.source].filter(Boolean).join("; ");
      } else {
        acc.push(event);
      }
      return acc;
    }, [] as CashflowEvent[]);

    return uniqueEvents.sort((a, b) => a.month - b.month);
  }, [portfolio, invoices, currentMonth]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Timeline
        </h2>
        <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {formatMonthYear(currentDate)}
        </div>
      </div>

      <button
        onClick={disabled ? undefined : onAdvanceMonth}
        disabled={disabled}
        className={`mb-6 w-full rounded-lg px-4 py-3 font-semibold text-white transition-colors ${
          disabled
            ? "cursor-not-allowed bg-zinc-400 dark:bg-zinc-600"
            : "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
        }`}
      >
        Advance to {formatMonthYear(nextMonthDate)}
      </button>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Upcoming Events
        </h3>
        {upcomingCashflow.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {upcomingCashflow.map((event, index) => (
              <div
                key={index}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMonthYear(getDateFromMonth(startDate, event.month))}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      event.netCashflow >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {event.netCashflow >= 0 ? "+" : ""}KSh {event.netCashflow.toLocaleString()}
                  </span>
                </div>
                {event.income > 0 && (
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Income: +KSh {event.income.toLocaleString()}
                  </div>
                )}
                {event.cashflow > 0 && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    Cashflow: +KSh {event.cashflow.toLocaleString()}
                  </div>
                )}
                {event.maintenance > 0 && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Maintenance: -KSh {event.maintenance.toLocaleString()}
                  </div>
                )}
                {event.income !== event.cashflow && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Income-Cashflow gap: KSh{" "}
                    {(event.income - event.cashflow).toLocaleString()}
                  </div>
                )}
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {event.source}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
            {portfolio.length === 0 && invoices.length === 0
              ? "Purchase investments or create invoices to see timeline"
              : "No events in the next 12 months"}
          </div>
        )}
      </div>
    </div>
  );
}
