"use client";

import { useState } from "react";
import { useDialogs } from "./CustomDialogs";
import type { Investment } from "../types";

interface InvestmentOpportunityCardProps {
  investment: Investment;
  availableMoney: number;
  onPurchase: (customAmount?: number) => void;
}

export function InvestmentOpportunityCard({
  investment,
  availableMoney,
  onPurchase,
}: InvestmentOpportunityCardProps) {
  const [customAmount, setCustomAmount] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const { alert } = useDialogs();
  
  const customAmountNum = customAmount ? parseInt(customAmount.replace(/,/g, ""), 10) : null;
  const effectiveAmount = investment.isFlexibleAmount && showCustomInput && customAmountNum 
    ? customAmountNum 
    : investment.initialCost;
  const canAfford = investment.initialCost === 0 || availableMoney >= effectiveAmount;
  const netMonthlyIncome = investment.monthlyIncome - investment.monthlyMaintenance;
  const netMonthlyCashflow = investment.monthlyCashflow - investment.monthlyMaintenance;
  const roiMonths = netMonthlyCashflow > 0 
    ? Math.ceil(investment.initialCost / netMonthlyCashflow)
    : null;

  // Calculate ROI percentages
  const monthlyROI = investment.initialCost > 0 && netMonthlyCashflow > 0
    ? (netMonthlyCashflow / investment.initialCost) * 100
    : 0;
  const annualROI = monthlyROI * 12;

  const hasIncomeCashflowGap = investment.monthlyIncome !== investment.monthlyCashflow ||
    investment.incomeDelayMonths !== investment.cashflowDelayMonths;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{investment.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {investment.name}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {investment.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {investment.initialCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {investment.isFlexibleAmount ? "Minimum Investment:" : "Initial Cost:"}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              KSh {investment.initialCost.toLocaleString()}
              {investment.isFlexibleAmount && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  (Flexible amount)
                </span>
              )}
            </span>
          </div>
        )}

        {investment.monthlyMaintenance > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Monthly Maintenance:</span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              -KSh {investment.monthlyMaintenance.toLocaleString()}
            </span>
          </div>
        )}

        {investment.monthlyIncome > 0 ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Monthly Income (Profit):</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                +KSh {investment.monthlyIncome.toLocaleString()}
              </span>
            </div>
            {investment.incomeDelayMonths > 0 && (
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Income recognized after {investment.incomeDelayMonths} month{investment.incomeDelayMonths > 1 ? "s" : ""}
              </div>
            )}
          </>
        ) : investment.type === "consulting" ? (
          <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
            Create invoices to earn income
          </div>
        ) : null}

        {investment.monthlyCashflow > 0 ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Monthly Cashflow:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                +KSh {investment.monthlyCashflow.toLocaleString()}
              </span>
            </div>
            {investment.cashflowDelayMonths > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400">
                Cash received after {investment.cashflowDelayMonths} month{investment.cashflowDelayMonths > 1 ? "s" : ""}
              </div>
            )}
          </>
        ) : !investment.isAppreciationOnly && investment.type !== "consulting" ? (
          <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            No monthly cashflow
          </div>
        ) : null}

        {hasIncomeCashflowGap && (
          <div className="rounded-lg bg-yellow-50 p-2 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            ⚠️ Income and cashflow timing differ
          </div>
        )}

        {investment.earlyCashflowDiscount?.available && (
          <div className="rounded-lg bg-green-50 p-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
            💰 Early cash option: Get KSh {investment.earlyCashflowDiscount.immediateCashflow.toLocaleString()} now 
            ({(investment.earlyCashflowDiscount.discountRate * 100).toFixed(0)}% discount)
          </div>
        )}

        {investment.isAppreciationOnly && (
          <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Appreciation only - no monthly cashflow
          </div>
        )}

        {/* Risk Level Indicator */}
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Risk Level:</span>
          <span className={`text-xs font-semibold ${
            investment.riskLevel === "low"
              ? "text-green-600 dark:text-green-400"
              : investment.riskLevel === "medium"
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400"
          }`}>
            {investment.riskLevel === "low" && "🟢 Low"}
            {investment.riskLevel === "medium" && "🟡 Medium"}
            {investment.riskLevel === "high" && "🔴 High"}
          </span>
        </div>

        {/* Tax Information */}
        {investment.incomeTaxRate !== undefined && investment.incomeTaxRate > 0 && !investment.isTaxExempt && (
          <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
            💰 Income Tax: {(investment.incomeTaxRate * 100).toFixed(0)}% on monthly income
          </div>
        )}
        {investment.isTaxExempt && (
          <div className="rounded-lg bg-green-50 p-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
            ✅ Tax-exempt investment
          </div>
        )}
        {investment.capitalGainsTaxRate !== undefined && investment.capitalGainsTaxRate > 0 && !investment.isTaxExempt && (
          <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
            💰 Capital Gains Tax: {(investment.capitalGainsTaxRate * 100).toFixed(0)}% on sale
          </div>
        )}

        {/* Volatility Warning */}
        {investment.volatility > 0.15 && investment.monthlyIncome > 0 && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-300">
            ⚠️ High volatility: Returns can vary by ±{(investment.volatility * 100).toFixed(0)}% monthly
          </div>
        )}

        {/* ROI Display - Visual */}
        {netMonthlyCashflow > 0 && investment.initialCost > 0 && (
          <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Monthly ROI:</span>
              <span className={`text-sm font-bold ${
                monthlyROI >= 2
                  ? "text-green-600 dark:text-green-400"
                  : monthlyROI >= 1
                  ? "text-blue-600 dark:text-blue-400"
                  : monthlyROI >= 0.5
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {monthlyROI.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Annual ROI:</span>
              <span className={`text-sm font-bold ${
                annualROI >= 24
                  ? "text-green-600 dark:text-green-400"
                  : annualROI >= 12
                  ? "text-blue-600 dark:text-blue-400"
                  : annualROI >= 6
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {annualROI.toFixed(1)}%
              </span>
            </div>
            {roiMonths && (
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-700">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Break Even:</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {roiMonths} month{roiMonths > 1 ? "s" : ""}
                </span>
              </div>
            )}
            {/* Visual ROI Bar */}
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">ROI Performance</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {annualROI >= 24 ? "Excellent" : annualROI >= 12 ? "Good" : annualROI >= 6 ? "Fair" : "Low"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full transition-all ${
                    annualROI >= 24
                      ? "bg-gradient-to-r from-green-500 to-green-600"
                      : annualROI >= 12
                      ? "bg-gradient-to-r from-blue-500 to-blue-600"
                      : annualROI >= 6
                      ? "bg-gradient-to-r from-amber-500 to-amber-600"
                      : "bg-gradient-to-r from-red-500 to-red-600"
                  }`}
                  style={{
                    width: `${Math.min(100, (annualROI / 30) * 100)}%`, // Scale to 30% max for visual
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Amount Input for Flexible Investments */}
      {investment.isFlexibleAmount && (
        <div className="mb-3 space-y-2">
          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              className="w-full rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              💰 Specify Custom Amount
            </button>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Investment Amount
                </label>
                <input
                  type="number"
                  min={investment.minimumInvestment || 0}
                  max={investment.maximumInvestment || undefined}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`Min: KSh ${(investment.minimumInvestment || investment.initialCost).toLocaleString()}`}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Minimum: KSh {(investment.minimumInvestment || investment.initialCost).toLocaleString()}
                  {investment.maximumInvestment && ` | Maximum: KSh ${investment.maximumInvestment.toLocaleString()}`}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomAmount("");
                }}
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          if (investment.isFlexibleAmount && showCustomInput && customAmount) {
            const amount = parseInt(customAmount.replace(/,/g, ""), 10);
            if (!isNaN(amount) && amount >= (investment.minimumInvestment || investment.initialCost)) {
              onPurchase(amount);
              setShowCustomInput(false);
              setCustomAmount("");
            } else {
              alert(`Please enter a valid amount (minimum KSh ${(investment.minimumInvestment || investment.initialCost).toLocaleString()})`);
            }
          } else {
            onPurchase();
          }
        }}
        disabled={!canAfford && (!investment.isFlexibleAmount || !showCustomInput || !customAmount)}
        className={`w-full rounded-lg px-4 py-2 font-semibold transition-colors ${
          canAfford || (investment.isFlexibleAmount && showCustomInput && customAmount && parseInt(customAmount.replace(/,/g, ""), 10) <= availableMoney)
            ? investment.type === "consulting"
              ? "bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
              : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            : "cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
        }`}
      >
        {investment.type === "consulting" 
          ? "Start Consulting" 
          : investment.isFlexibleAmount && showCustomInput && customAmount
          ? `Invest KSh ${parseInt(customAmount.replace(/,/g, ""), 10).toLocaleString()}`
          : canAfford 
          ? `Purchase for KSh ${investment.initialCost.toLocaleString()}`
          : `Need KSh ${(investment.initialCost - availableMoney).toLocaleString()} more`}
      </button>
    </div>
  );
}
