"use client";

import type { Loan } from "../types";

interface LoanManagerProps {
  loans: Loan[];
  currentMonth: number;
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

export function LoanManager({ loans, currentMonth, startDate }: LoanManagerProps) {
  if (loans.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Active Loans
      </h2>
      <div className="space-y-4">
        {loans.map((loan) => {
          const monthsSinceLoan = currentMonth - loan.startMonth;
          const monthsRemaining = loan.termMonths - monthsSinceLoan;
          const monthlyRate = loan.interestRate / 12;
          const currentInterest = Math.round(loan.remainingBalance * monthlyRate);

          return (
            <div
              key={loan.id}
              className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">
                    {loan.purpose || "Investment Loan"}
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Taken in {formatMonthYear(getDateFromMonth(startDate, loan.startMonth))}
                  </p>
                </div>
                <span className="text-2xl">💰</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-red-600 dark:text-red-400">Original Amount:</span>
                  <p className="font-semibold text-red-900 dark:text-red-100">
                    {loan.amount.toLocaleString()}
                  </p>
                </div>

                <div>
                  <span className="text-red-600 dark:text-red-400">Remaining Balance:</span>
                  <p className="font-semibold text-red-900 dark:text-red-100">
                    {loan.remainingBalance.toLocaleString()}
                  </p>
                </div>

                <div>
                  <span className="text-red-600 dark:text-red-400">Monthly Payment:</span>
                  <p className="font-semibold text-red-900 dark:text-red-100">
                    {loan.monthlyPayment.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400">
                    (Interest: {currentInterest.toLocaleString()})
                  </p>
                </div>

                <div>
                  <span className="text-red-600 dark:text-red-400">Interest Rate:</span>
                  <p className="font-semibold text-red-900 dark:text-red-100">
                    {(loan.interestRate * 100).toFixed(1)}% per year
                  </p>
                </div>

                <div>
                  <span className="text-red-600 dark:text-red-400">Months Remaining:</span>
                  <p className="font-semibold text-red-900 dark:text-red-100">
                    {monthsRemaining} of {loan.termMonths}
                  </p>
                </div>

                <div>
                  <span className="text-red-600 dark:text-red-400">Progress:</span>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-red-200 dark:bg-red-800">
                    <div
                      className="h-full bg-red-600 dark:bg-red-400"
                      style={{
                        width: `${((loan.termMonths - monthsRemaining) / loan.termMonths) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

