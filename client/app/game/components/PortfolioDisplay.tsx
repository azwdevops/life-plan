"use client";

import { useDialogs } from "./CustomDialogs";
import type { OwnedInvestment, UnexpectedEvent } from "../types";

function getDateFromMonth(startDate: Date, monthOffset: number): Date {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface PortfolioDisplayProps {
  portfolio: OwnedInvestment[];
  currentMonth: number;
  startDate: Date;
  onEarlyCashflow: (ownedInvestmentId: number) => void;
  onSellInvestment: (ownedInvestmentId: number) => void;
  onExtendInvestment: (ownedInvestmentId: number, topUpAmount: number) => void;
}

export function PortfolioDisplay({
  portfolio,
  currentMonth,
  startDate,
  onEarlyCashflow,
  onSellInvestment,
  onExtendInvestment,
}: PortfolioDisplayProps) {
  const { prompt, alert, confirm } = useDialogs();
  if (portfolio.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Your portfolio is empty. Purchase investments to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Your Portfolio
      </h2>
      <div className="max-h-[600px] overflow-y-auto">
        <div className="flex flex-wrap items-stretch gap-2">
          {portfolio.map((owned) => {
          // Ensure stocks have isExtendable property (for stocks purchased before this feature was added)
          // Determine minimumTopUp based on investment ID: 10=5000, 11=10000, 12=5000
          const getStockMinimumTopUp = (investmentId: number) => {
            if (investmentId === 11) return 10000; // Dividend Stock
            return 5000; // Stock Shares or Growth Stock
          };
          const investment = owned.investment.type === "stocks" && !owned.investment.isExtendable
            ? { ...owned.investment, isExtendable: true, minimumTopUp: owned.investment.minimumTopUp || getStockMinimumTopUp(owned.investmentId) }
            : owned.investment;
          const monthsSincePurchase = currentMonth - owned.purchaseMonth;
          const isIncomeActive = monthsSincePurchase > investment.incomeDelayMonths;
          const isCashflowActive =
            monthsSincePurchase > investment.cashflowDelayMonths && !owned.earlyCashflowTaken;
          const netMonthlyIncome = investment.monthlyIncome - investment.monthlyMaintenance;
          const netMonthlyCashflow = investment.monthlyCashflow - investment.monthlyMaintenance;
          const hasIncomeCashflowGap =
            investment.monthlyIncome !== investment.monthlyCashflow ||
            investment.incomeDelayMonths !== investment.cashflowDelayMonths;

          return (
            <div
              key={owned.id}
              className="flex w-full min-w-[280px] max-w-[320px] flex-1 flex-col rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-700"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{investment.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {investment.name}
                    </h3>
                    <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                      {formatMonthYear(getDateFromMonth(startDate, owned.purchaseMonth))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">Purchase:</span>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
owned.purchaseCost.toLocaleString()}
                  </p>
                </div>
                {owned.currentValue !== undefined && owned.currentValue !== owned.purchaseCost && (
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">Value:</span>
                    <p className={`text-xs font-semibold ${
                      owned.currentValue > owned.purchaseCost
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
owned.currentValue.toLocaleString()}
                      <span className="ml-1 text-xs">
                        ({owned.currentValue > owned.purchaseCost ? "+" : ""}
                        {(((owned.currentValue - owned.purchaseCost) / owned.purchaseCost) * 100).toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                )}
                
                {/* ROI Display */}
                {netMonthlyCashflow > 0 && owned.purchaseCost > 0 && (
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">ROI:</span>
                    <span className={`ml-1 text-xs font-bold ${
                      (netMonthlyCashflow / owned.purchaseCost) * 12 >= 24
                        ? "text-green-600 dark:text-green-400"
                        : (netMonthlyCashflow / owned.purchaseCost) * 12 >= 12
                        ? "text-blue-600 dark:text-blue-400"
                        : (netMonthlyCashflow / owned.purchaseCost) * 12 >= 6
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {((netMonthlyCashflow / owned.purchaseCost) * 12).toFixed(1)}%
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">Months:</span>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {monthsSincePurchase}
                  </p>
                </div>

                {investment.monthlyIncome > 0 && (
                  <>
                    <div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-500">Income:</span>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        +investment.monthlyIncome.toLocaleString()}
                      </p>
                    </div>
                    {hasIncomeCashflowGap && (
                      <div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">Accrued:</span>
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
owned.accruedIncome.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {investment.monthlyCashflow > 0 && (
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">Cashflow:</span>
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                      +investment.monthlyCashflow.toLocaleString()}
                    </p>
                  </div>
                )}

                {investment.monthlyMaintenance > 0 && (
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">Maint:</span>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                      -investment.monthlyMaintenance.toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="col-span-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">Net:</span>
                  <p className={`text-xs font-semibold ${
                    netMonthlyCashflow >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {netMonthlyCashflow >= 0 ? "+" : ""}netMonthlyCashflow.toLocaleString()}
                  </p>
                </div>

                {/* Active Events Display */}
                {owned.activeEvents && owned.activeEvents.length > 0 && (
                  <div className="col-span-2 space-y-1">
                    {owned.activeEvents
                      .filter((event) => !event.resolved)
                      .map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-lg border p-2 text-xs ${
                            event.type === "vacancy"
                              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                              : event.type === "breakdown"
                              ? "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
                              : event.type === "maintenance_surprise"
                              ? "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                              : "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              {event.type === "vacancy" && "🏠 Vacancy"}
                              {event.type === "breakdown" && "🔧 Breakdown"}
                              {event.type === "maintenance_surprise" && "⚠️ Maintenance Surprise"}
                              {event.type === "market_crash" && "📉 Market Crash"}
                              {event.type === "default" && "❌ Default"}
                            </span>
                            {event.durationMonths && event.durationMonths > 0 && (
                              <span className="text-xs">
                                {event.durationMonths - (currentMonth - event.month)} month(s) remaining
                              </span>
                            )}
                          </div>
                          <p className="mt-1">{event.description}</p>
                          {(event.incomeLoss > 0 || event.cashflowLoss > 0 || event.additionalCost) && (
                            <div className="mt-1 space-y-0.5">
                              {event.incomeLoss > 0 && (
                                <div>Income Loss: -event.incomeLoss.toLocaleString()}</div>
                              )}
                              {event.cashflowLoss > 0 && (
                                <div>Cashflow Loss: -event.cashflowLoss.toLocaleString()}</div>
                              )}
                              {event.additionalCost && event.additionalCost > 0 && (
                                <div>Additional Cost: -event.additionalCost.toLocaleString()}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {investment.earlyCashflowDiscount?.available &&
                  !owned.earlyCashflowTaken &&
                  monthsSincePurchase >= investment.cashflowDelayMonths && (
                    <div className="col-span-2">
                      <button
                        onClick={() => onEarlyCashflow(owned.id)}
                        className="w-full rounded bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                      >
                        Get Early Cash: {" "}
                        {investment.earlyCashflowDiscount.immediateCashflow.toLocaleString()} now
                        ({(investment.earlyCashflowDiscount.discountRate * 100).toFixed(0)}%
                        discount)
                      </button>
                    </div>
                  )}

                {/* Action Buttons */}
                <div className="col-span-2 mt-auto flex flex-col gap-2 sm:flex-row">
                  {owned.isSelling ? (
                    <div className="flex-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-center text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      <p className="font-semibold">Sale in Progress</p>
                      <p className="text-xs">
                        {investment.exitTimeMonths - (currentMonth - (owned.saleInitiatedMonth || currentMonth))} month(s) remaining
                      </p>
                      {investment.exitTimeMonths - (currentMonth - (owned.saleInitiatedMonth || currentMonth)) <= 0 && (
                        <button
                          onClick={() => onSellInvestment(owned.id)}
                          className="mt-1.5 w-full rounded bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                        >
                          Complete Sale
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        const salePrice = owned.currentValue || owned.purchaseCost;
                        const exitCost = Math.round(salePrice * investment.exitCostPercent);
                        const proceeds = salePrice - exitCost;
                        
                        const confirmed = await confirm(
                          `Are you sure you want to sell "${investment.name}"?\n\n` +
                          `Current value: ${salePrice.toLocaleString()}\n` +
                          `Estimated proceeds: ${proceeds.toLocaleString()}\n` +
                          `(After exit costs: ${exitCost.toLocaleString()})\n\n` +
                          `This will initiate a sale process that takes ${investment.exitTimeMonths} month(s) to complete.`,
                          "Sell Investment"
                        );
                        if (confirmed) {
                          onSellInvestment(owned.id);
                        }
                      }}
                      className="flex-1 rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
                    >
                      💰 Sell
                    </button>
                  )}
                  {investment.isExtendable && (
                    <button
                      onClick={async () => {
                        const minTopUp = investment.minimumTopUp || 1000;
                        const topUpAmount = await prompt(
                          `Current investment: ${owned.purchaseCost.toLocaleString()}\n` +
                          `Minimum top-up: ${minTopUp.toLocaleString()}\n\n` +
                          `Enter amount to add:`,
                          minTopUp.toString(),
                          `Extend ${investment.name}`
                        );
                        if (topUpAmount) {
                          const amount = parseInt(topUpAmount.replace(/,/g, ""), 10);
                          if (!isNaN(amount) && amount >= minTopUp) {
                            onExtendInvestment(owned.id, amount);
                          } else {
                            alert(`Please enter a valid amount (minimum ${minTopUp.toLocaleString()})`);
                          }
                        }
                      }}
                      className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      📈 Extend
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
