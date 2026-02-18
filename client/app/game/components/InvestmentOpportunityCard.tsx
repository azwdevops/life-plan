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
  
  // Cashflow-focused calculations
  const cashflowIn = investment.monthlyCashflow;
  const cashflowOut = investment.monthlyMaintenance; // Maintenance is the main cash outflow
  const netCashflow = cashflowIn - cashflowOut;
  
  const roiMonths = netCashflow > 0 
    ? Math.ceil(investment.initialCost / netCashflow)
    : null;

  // Calculate ROI percentages based on net cashflow
  const monthlyROI = investment.initialCost > 0 && netCashflow > 0
    ? (netCashflow / investment.initialCost) * 100
    : 0;
  const annualROI = monthlyROI * 12;

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
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

      <div className="mb-4 flex flex-1 flex-col space-y-2">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {investment.initialCost > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                {investment.isFlexibleAmount ? "Min Investment" : "Initial Cost"}
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                KSh {investment.initialCost.toLocaleString()}
              </div>
              {investment.isFlexibleAmount && (
                <div className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">
                  Flexible
                </div>
              )}
            </div>
          )}

          {/* Cashflow In */}
          {cashflowIn > 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-900/20">
              <div className="text-xs text-green-700 dark:text-green-300">Cashflow In</div>
              <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                +KSh {cashflowIn.toLocaleString()}
              </div>
              {investment.cashflowDelayMonths > 0 && (
                <div className="mt-0.5 text-xs text-green-600 dark:text-green-400">
                  After {investment.cashflowDelayMonths}m
                </div>
              )}
            </div>
          ) : !investment.isAppreciationOnly && investment.type !== "consulting" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="text-xs text-amber-700 dark:text-amber-300">Cashflow In</div>
              <div className="text-xs text-amber-800 dark:text-amber-300">None</div>
            </div>
          ) : null}

          {/* Cashflow Out */}
          {cashflowOut > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-900/20">
              <div className="text-xs text-red-700 dark:text-red-300">Cashflow Out</div>
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                -KSh {cashflowOut.toLocaleString()}
              </div>
            </div>
          )}

          {/* Risk Level */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="text-xs text-zinc-600 dark:text-zinc-400">Risk Level</div>
            <div className={`text-sm font-semibold ${
              investment.riskLevel === "low"
                ? "text-green-600 dark:text-green-400"
                : investment.riskLevel === "medium"
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {investment.riskLevel === "low" && "🟢 Low"}
              {investment.riskLevel === "medium" && "🟡 Medium"}
              {investment.riskLevel === "high" && "🔴 High"}
            </div>
          </div>
        </div>

        {/* Net Cashflow - Prominent Display */}
        <div className={`rounded-lg border-2 p-3 ${
          netCashflow >= 0
            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Net Cashflow:
            </span>
            <span className={`text-lg font-bold ${
              netCashflow >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {netCashflow >= 0 ? "+" : ""}KSh {netCashflow.toLocaleString()}
            </span>
          </div>
          {netCashflow > 0 && investment.initialCost > 0 && (
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Break even in {roiMonths} month{roiMonths && roiMonths > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Additional Info Grid */}
        <div className="grid grid-cols-2 gap-2">
          {investment.earlyCashflowDiscount?.available && (
            <div className="col-span-2 rounded-lg bg-green-50 p-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
              💰 Early cash: KSh {investment.earlyCashflowDiscount.immediateCashflow.toLocaleString()} 
              ({(investment.earlyCashflowDiscount.discountRate * 100).toFixed(0)}% off)
            </div>
          )}

          {investment.isAppreciationOnly && (
            <div className="col-span-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              📈 Appreciation only
            </div>
          )}

          {/* Tax Information - Compact */}
          {investment.incomeTaxRate !== undefined && investment.incomeTaxRate > 0 && !investment.isTaxExempt && cashflowIn > 0 && (
            <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
              💰 Tax: {(investment.incomeTaxRate * 100).toFixed(0)}%
            </div>
          )}
          {investment.isTaxExempt && (
            <div className="rounded-lg bg-green-50 p-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
              ✅ Tax-exempt
            </div>
          )}
          {investment.capitalGainsTaxRate !== undefined && investment.capitalGainsTaxRate > 0 && !investment.isTaxExempt && (
            <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
              💰 CGT: {(investment.capitalGainsTaxRate * 100).toFixed(0)}%
            </div>
          )}

          {/* Volatility Warning */}
          {investment.volatility > 0.15 && cashflowIn > 0 && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-300">
              ⚠️ Volatility: ±{(investment.volatility * 100).toFixed(0)}%
            </div>
          )}
        </div>

        {/* ROI Display - Compact Grid */}
        {netCashflow > 0 && investment.initialCost > 0 && (
          <div className="mt-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">Monthly ROI</div>
                <div className={`text-sm font-bold ${
                  monthlyROI >= 2
                    ? "text-green-600 dark:text-green-400"
                    : monthlyROI >= 1
                    ? "text-blue-600 dark:text-blue-400"
                    : monthlyROI >= 0.5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {monthlyROI.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">Annual ROI</div>
                <div className={`text-sm font-bold ${
                  annualROI >= 24
                    ? "text-green-600 dark:text-green-400"
                    : annualROI >= 12
                    ? "text-blue-600 dark:text-blue-400"
                    : annualROI >= 6
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {annualROI.toFixed(1)}%
                </div>
              </div>
              {roiMonths && (
                <div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Break Even</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {roiMonths}m
                  </div>
                </div>
              )}
            </div>
            {/* Visual ROI Bar */}
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">Performance</span>
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
                    width: `${Math.min(100, (annualROI / 30) * 100)}%`,
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

      {investment.type !== "consulting" && (
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
              ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              : "cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
          }`}
        >
          {investment.isFlexibleAmount && showCustomInput && customAmount
            ? `Invest KSh ${parseInt(customAmount.replace(/,/g, ""), 10).toLocaleString()}`
            : canAfford 
            ? `Purchase for KSh ${investment.initialCost.toLocaleString()}`
            : `Need KSh ${(investment.initialCost - availableMoney).toLocaleString()} more`}
        </button>
      )}
    </div>
  );
}
