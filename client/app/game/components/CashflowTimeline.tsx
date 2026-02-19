"use client";

import { useMemo } from "react";
import type { OwnedInvestment, Invoice, CashflowEvent, Loan, Expense } from "../types";

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
  loans: Loan[];
  expenses: Expense[];
}

export function CashflowTimeline({
  portfolio,
  invoices,
  currentMonth,
  startDate,
  loans,
  expenses,
}: CashflowTimelineProps) {
  const currentDate = getDateFromMonth(startDate, currentMonth);
  // Calculate cashflow events for the next 12 months
  const upcomingCashflow = useMemo(() => {
    const events: CashflowEvent[] = [];
    const monthsToShow = 12;

    for (let month = currentMonth + 1; month <= currentMonth + monthsToShow; month++) {
      let totalIncome = 0;
      let totalCashflow = 0;
      let totalMaintenance = 0;
      const cashInItems: Array<{ label: string; amount: number }> = [];
      const cashOutItems: Array<{ label: string; amount: number }> = [];

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
          cashInItems.push({
            label: investment.name,
            amount: baseMonthlyIncome,
          });
        } else {
          // Show separately if different
          if (hasIncome) {
            cashInItems.push({
              label: `${investment.name} (Income)`,
              amount: baseMonthlyIncome,
            });
          }
          if (hasCashflow) {
            cashInItems.push({
              label: `${investment.name} (Cashflow)`,
              amount: baseMonthlyCashflow,
            });
          }
        }

        // Maintenance costs
        if (baseMonthlyMaintenance > 0 && monthsSincePurchase > 0) {
          totalMaintenance += baseMonthlyMaintenance;
          cashOutItems.push({
            label: `${investment.name} (Maintenance)`,
            amount: baseMonthlyMaintenance,
          });
        }
      });

      // Process invoices
      invoices.forEach((invoice) => {
        if (invoice.status === "paid" || invoice.status === "discounted") return;

        if (month === invoice.paymentDueMonth) {
          if (!invoice.isDiscounted) {
            totalCashflow += invoice.amount;
            totalIncome += invoice.amount;
            cashInItems.push({
              label: `Invoice ${invoice.invoiceNumber}`,
              amount: invoice.amount,
            });
          }
        }
      });

      // Calculate expected cash out for this month
      let totalExpenses = 0;
      let totalLoanPayments = 0;
      
      // Monthly expenses
      expenses.filter((exp) => exp.isActive).forEach((exp) => {
        totalExpenses += exp.amount;
        cashOutItems.push({
          label: exp.name,
          amount: exp.amount,
        });
      });

      // Loan payments
      loans.forEach((loan) => {
        const monthsSinceLoan = month - loan.startMonth;
        
        if (loan.type === "overdraft") {
          // Overdraft: interest only
          const monthlyRate = loan.interestRate / 12;
          const interestPayment = Math.round(loan.remainingBalance * monthlyRate);
          totalLoanPayments += interestPayment;
          cashOutItems.push({
            label: "Loan (Overdraft) Interest",
            amount: interestPayment,
          });
        } else if (loan.termMonths > 0 && monthsSinceLoan < loan.termMonths) {
          // Fixed-term loans
          totalLoanPayments += loan.monthlyPayment;
          cashOutItems.push({
            label: `Loan (${loan.type === "short_term" ? "Short-term" : "Long-term"}) Payment`,
            amount: loan.monthlyPayment,
          });
        }
      });

      // Always create event if there's any activity (income, cashflow, maintenance, expenses, loans)
      if (totalIncome > 0 || totalCashflow > 0 || totalMaintenance > 0 || totalExpenses > 0 || totalLoanPayments > 0 || cashInItems.length > 0 || cashOutItems.length > 0) {
        // Check if an event for this month already exists
        const existingEventIndex = events.findIndex((e) => e.month === month);
        if (existingEventIndex >= 0) {
          // Merge with existing event
          const existing = events[existingEventIndex];
          const mergedCashflow = existing.cashflow + totalCashflow;
          const mergedMaintenance = existing.maintenance + totalMaintenance;
          const mergedExpenses = totalExpenses; // Expenses are monthly, not cumulative per investment
          const mergedLoanPayments = totalLoanPayments; // Loan payments are monthly, not cumulative
          
          // Merge cash in/out items
          const mergedCashInItems = [...(existing.cashInItems || []), ...cashInItems];
          const mergedCashOutItems = [...(existing.cashOutItems || []), ...cashOutItems];
          
          events[existingEventIndex] = {
            month,
            source: existing.source, // Keep legacy field
            income: existing.income + totalIncome,
            cashflow: mergedCashflow,
            maintenance: mergedMaintenance,
            netCashflow: mergedCashflow - mergedMaintenance - mergedExpenses - mergedLoanPayments,
            type: "investment",
            cashInItems: mergedCashInItems,
            cashOutItems: mergedCashOutItems,
          };
        } else {
          events.push({
            month,
            source: "No activity", // Legacy field
            income: totalIncome,
            cashflow: totalCashflow,
            maintenance: totalMaintenance,
            netCashflow: totalCashflow - totalMaintenance - totalExpenses - totalLoanPayments,
            type: "investment",
            cashInItems,
            cashOutItems,
          });
        }
      }
    }

    // Sort events by month and remove any duplicates
    const uniqueEvents = events.reduce((acc, event) => {
      const existing = acc.find((e) => e.month === event.month);
      if (existing) {
        // Merge duplicates - recalculate net cashflow
        existing.income += event.income;
        existing.cashflow += event.cashflow;
        existing.maintenance += event.maintenance;
        // Net cashflow is already calculated in the event
        existing.netCashflow = event.netCashflow; // Use the calculated value from the event
        existing.source = [existing.source, event.source].filter(Boolean).join("; ");
        // Merge cash in/out items
        existing.cashInItems = [...(existing.cashInItems || []), ...(event.cashInItems || [])];
        existing.cashOutItems = [...(existing.cashOutItems || []), ...(event.cashOutItems || [])];
      } else {
        acc.push(event);
      }
      return acc;
    }, [] as CashflowEvent[]);

    return uniqueEvents.sort((a, b) => a.month - b.month);
  }, [portfolio, invoices, loans, expenses, currentMonth]);

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

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Upcoming Events
        </h3>
        {upcomingCashflow.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
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
                    {event.netCashflow >= 0 ? "+" : ""}event.netCashflow.toLocaleString()}
                  </span>
                </div>
                {event.income > 0 && (
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Income: +event.income.toLocaleString()}
                  </div>
                )}
                {event.cashflow > 0 && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    Cashflow: +event.cashflow.toLocaleString()}
                  </div>
                )}
                {event.maintenance > 0 && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Maintenance: -event.maintenance.toLocaleString()}
                  </div>
                )}
                {event.income !== event.cashflow && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Income-Cashflow gap:                     {(event.income - event.cashflow).toLocaleString()}
                  </div>
                )}
                
                {/* Formatted Breakdown */}
                {(event.cashInItems && event.cashInItems.length > 0) || (event.cashOutItems && event.cashOutItems.length > 0) ? (
                  <div className="mt-2 space-y-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                    {event.cashInItems && event.cashInItems.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-semibold text-green-600 dark:text-green-400">
                          Cash In:
                        </div>
                        <div className="space-y-0.5 pl-2">
                          {event.cashInItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-zinc-600 dark:text-zinc-400">{item.label}</span>
                              <span className="font-medium text-green-600 dark:text-green-400">
                                +{item.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {event.cashOutItems && event.cashOutItems.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-semibold text-red-600 dark:text-red-400">
                          Cash Out:
                        </div>
                        <div className="space-y-0.5 pl-2">
                          {event.cashOutItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-zinc-600 dark:text-zinc-400">{item.label}</span>
                              <span className="font-medium text-red-600 dark:text-red-400">
                                -{item.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {event.source}
                  </div>
                )}
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
