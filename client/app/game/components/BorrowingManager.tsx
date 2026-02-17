"use client";

import { useState } from "react";
import type { Loan, LoanType } from "../types";
import { useDialogs } from "./CustomDialogs";
import { Dialog } from "@/components/Dialog";

interface BorrowingManagerProps {
  currentMoney: number;
  cashflowHistory: number[];
  currentMonth: number;
  existingLoans: Loan[];
  onBorrow: (loan: Omit<Loan, "id" | "startMonth">) => void;
}

interface LoanOption {
  type: LoanType;
  name: string;
  description: string;
  maxAmount: number;
  interestRate: number;
  termMonths: number;
  minMonthlyPayment?: number;
  qualificationCriteria: {
    minAverageCashflow: number;
    minMonthsHistory: number;
    maxDebtToCashflowRatio?: number;
  };
}

export function BorrowingManager({
  currentMoney,
  cashflowHistory,
  currentMonth,
  existingLoans,
  onBorrow,
}: BorrowingManagerProps) {
  const { prompt, alert } = useDialogs();
  const [showDialog, setShowDialog] = useState(false);

  // Calculate qualification metrics
  const averageCashflow = cashflowHistory.length > 0
    ? cashflowHistory.reduce((sum, cf) => sum + cf, 0) / cashflowHistory.length
    : 0;
  const totalDebt = existingLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
  const debtToCashflowRatio = averageCashflow > 0 ? totalDebt / averageCashflow : Infinity;

  // Define loan options
  const loanOptions: LoanOption[] = [
    {
      type: "overdraft",
      name: "Overdraft Facility",
      description: "Flexible credit line - pay interest only, no fixed term",
      maxAmount: Math.max(50000, Math.round(averageCashflow * 2)), // 2x average monthly cashflow
      interestRate: 0.24, // 24% annual (2% monthly)
      termMonths: 0, // No fixed term
      minMonthlyPayment: 0, // Interest only, minimum payment
      qualificationCriteria: {
        minAverageCashflow: 10000,
        minMonthsHistory: 3,
        maxDebtToCashflowRatio: 3, // Max 3x monthly cashflow in debt
      },
    },
    {
      type: "short_term",
      name: "Short-Term Loan",
      description: "Quick access loan - 3-6 months term",
      maxAmount: Math.max(100000, Math.round(averageCashflow * 3)), // 3x average monthly cashflow
      interestRate: 0.20, // 20% annual
      termMonths: 6,
      qualificationCriteria: {
        minAverageCashflow: 20000,
        minMonthsHistory: 6,
        maxDebtToCashflowRatio: 4,
      },
    },
    {
      type: "long_term",
      name: "Long-Term Loan",
      description: "Structured loan - 12-24 months term, lower rate",
      maxAmount: Math.max(500000, Math.round(averageCashflow * 6)), // 6x average monthly cashflow
      interestRate: 0.16, // 16% annual
      termMonths: 24,
      qualificationCriteria: {
        minAverageCashflow: 50000,
        minMonthsHistory: 12,
        maxDebtToCashflowRatio: 5,
      },
    },
  ];

  // Check if user qualifies for a loan option
  const qualifiesForLoan = (option: LoanOption): { qualified: boolean; reason?: string } => {
    if (cashflowHistory.length < option.qualificationCriteria.minMonthsHistory) {
      return {
        qualified: false,
        reason: `Need at least ${option.qualificationCriteria.minMonthsHistory} months of cashflow history`,
      };
    }

    if (averageCashflow < option.qualificationCriteria.minAverageCashflow) {
      return {
        qualified: false,
        reason: `Average monthly cashflow must be at least KSh ${option.qualificationCriteria.minAverageCashflow.toLocaleString()}`,
      };
    }

    if (
      option.qualificationCriteria.maxDebtToCashflowRatio &&
      debtToCashflowRatio > option.qualificationCriteria.maxDebtToCashflowRatio
    ) {
      return {
        qualified: false,
        reason: `Debt-to-cashflow ratio too high (${debtToCashflowRatio.toFixed(1)}x). Max allowed: ${option.qualificationCriteria.maxDebtToCashflowRatio}x`,
      };
    }

    return { qualified: true };
  };

  const handleBorrow = async (option: LoanOption) => {
    const qualification = qualifiesForLoan(option);
    if (!qualification.qualified) {
      await alert(qualification.reason || "You do not qualify for this loan.", "Loan Qualification");
      return;
    }

    const amountStr = await prompt(
      `Enter loan amount (max: KSh ${option.maxAmount.toLocaleString()}):`,
      "Borrow Money",
      option.maxAmount.toString()
    );

    if (!amountStr) return;

    const amount = parseInt(amountStr.replace(/,/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      await alert("Invalid amount. Please enter a positive number.", "Invalid Input");
      return;
    }

    if (amount > option.maxAmount) {
      await alert(
        `Maximum loan amount is KSh ${option.maxAmount.toLocaleString()}.`,
        "Amount Exceeded"
      );
      return;
    }

    // Calculate monthly payment
    let monthlyPayment = 0;
    if (option.type === "overdraft") {
      // Overdraft: interest only (minimum payment)
      const monthlyRate = option.interestRate / 12;
      monthlyPayment = Math.round(amount * monthlyRate);
    } else {
      // Fixed-term loans: amortized payment
      const monthlyRate = option.interestRate / 12;
      monthlyPayment = Math.round(
        (amount * monthlyRate * Math.pow(1 + monthlyRate, option.termMonths)) /
        (Math.pow(1 + monthlyRate, option.termMonths) - 1)
      );
    }

    const confirmBorrow = await prompt(
      `Loan Details:\n` +
      `Type: ${option.name}\n` +
      `Amount: KSh ${amount.toLocaleString()}\n` +
      `Interest Rate: ${(option.interestRate * 100).toFixed(1)}% per year\n` +
      `Term: ${option.termMonths === 0 ? "Flexible (overdraft)" : `${option.termMonths} months`}\n` +
      `Monthly Payment: KSh ${monthlyPayment.toLocaleString()}\n\n` +
      `Confirm to proceed?`,
      "Confirm Loan",
      "yes"
    );

    if (confirmBorrow?.toLowerCase() === "yes" || confirmBorrow?.toLowerCase() === "y") {
      onBorrow({
        type: option.type,
        amount,
        interestRate: option.interestRate,
        termMonths: option.termMonths,
        monthlyPayment,
        remainingBalance: amount,
        maxAmount: option.type === "overdraft" ? option.maxAmount : undefined,
        purpose: option.name,
      });
      setShowDialog(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Borrowing Options
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Access credit based on your cashflow history
            </p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            View Options
          </button>
        </div>
      </div>

      <Dialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        title="Borrowing Options"
        size="xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="mb-4 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Average Monthly Cashflow:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  KSh {Math.round(averageCashflow).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Total Debt:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  KSh {totalDebt.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Cashflow History:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {cashflowHistory.length} months
                </p>
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Debt-to-Cashflow Ratio:</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {debtToCashflowRatio === Infinity ? "N/A" : `${debtToCashflowRatio.toFixed(1)}x`}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
        {loanOptions.map((option) => {
          const qualification = qualifiesForLoan(option);
          const isQualified = qualification.qualified;

          return (
            <div
              key={option.type}
              className={`rounded-lg border p-4 ${
                isQualified
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {option.name}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {option.description}
                  </p>
                </div>
                {isQualified ? (
                  <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">
                    Qualified
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-400 px-3 py-1 text-xs font-medium text-white">
                    Not Qualified
                  </span>
                )}
              </div>

              <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Max Amount:</span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    KSh {option.maxAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Interest Rate:</span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {(option.interestRate * 100).toFixed(1)}% per year
                  </p>
                </div>
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Term:</span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {option.termMonths === 0 ? "Flexible" : `${option.termMonths} months`}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Requirements:</span>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {option.qualificationCriteria.minMonthsHistory} months history,{" "}
                    KSh {option.qualificationCriteria.minAverageCashflow.toLocaleString()} avg
                    cashflow
                  </p>
                </div>
              </div>

              {!isQualified && qualification.reason && (
                <div className="mb-3 rounded bg-yellow-50 p-2 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                  {qualification.reason}
                </div>
              )}

              <button
                onClick={() => handleBorrow(option)}
                disabled={!isQualified}
                className={`w-full rounded-lg px-4 py-2 font-medium ${
                  isQualified
                    ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    : "cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                }`}
              >
                {isQualified ? "Apply for Loan" : "Not Qualified"}
              </button>
            </div>
          );
        })}
          </div>
        </div>
      </Dialog>
    </>
  );
}

