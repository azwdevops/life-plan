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
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Your Portfolio
      </h2>
      <div className="space-y-4">
        {portfolio.map((owned) => {
          const investment = owned.investment;
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
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{investment.icon}</span>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {investment.name}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Purchased in {formatMonthYear(getDateFromMonth(startDate, owned.purchaseMonth))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Purchase Cost:</span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    KSh {owned.purchaseCost.toLocaleString()}
                  </p>
                </div>
                {owned.currentValue !== undefined && owned.currentValue !== owned.purchaseCost && (
                  <div>
                    <span className="text-zinc-600 dark:text-zinc-400">Current Value:</span>
                    <p className={`font-semibold ${
                      owned.currentValue > owned.purchaseCost
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      KSh {owned.currentValue.toLocaleString()}
                      <span className="ml-2 text-xs">
                        ({owned.currentValue > owned.purchaseCost ? "+" : ""}
                        {(((owned.currentValue - owned.purchaseCost) / owned.purchaseCost) * 100).toFixed(1)}%)
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {owned.currentValue > owned.purchaseCost ? "📈 Appreciated" : "📉 Depreciated"}
                    </p>
                  </div>
                )}
                
                {/* ROI Display */}
                {netMonthlyCashflow > 0 && owned.purchaseCost > 0 && (
                  <div>
                    <span className="text-zinc-600 dark:text-zinc-400">ROI:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${
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
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        ({(netMonthlyCashflow / owned.purchaseCost * 100).toFixed(2)}%/mo)
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Months Owned:</span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {monthsSincePurchase}
                  </p>
                </div>

                {investment.monthlyIncome > 0 && (
                  <>
                    <div>
                      <span className="text-zinc-600 dark:text-zinc-400">Monthly Income:</span>
                      <p className="font-semibold text-blue-600 dark:text-blue-400">
                        +KSh {investment.monthlyIncome.toLocaleString()}
                        {owned.currentMonthIncome !== undefined && owned.currentMonthIncome !== investment.monthlyIncome && (
                          <span className="ml-2 text-xs">
                            (This month: {owned.currentMonthIncome >= 0 ? "+" : ""}KSh {owned.currentMonthIncome.toLocaleString()})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {isIncomeActive
                          ? investment.volatility > 0
                            ? `Active - varies by ±${(investment.volatility * 100).toFixed(0)}%`
                            : "Active"
                          : `Starts in ${investment.incomeDelayMonths - monthsSincePurchase} month${investment.incomeDelayMonths - monthsSincePurchase > 1 ? "s" : ""}`}
                      </p>
                      {investment.incomeTaxRate !== undefined && investment.incomeTaxRate > 0 && !investment.isTaxExempt && (
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          Tax: {(investment.incomeTaxRate * 100).toFixed(0)}% (After tax: KSh {Math.round(investment.monthlyIncome * (1 - investment.incomeTaxRate)).toLocaleString()})
                        </p>
                      )}
                      {investment.isTaxExempt && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          ✅ Tax-exempt
                        </p>
                      )}
                    </div>
                    {hasIncomeCashflowGap && (
                      <div>
                        <span className="text-zinc-600 dark:text-zinc-400">Accrued Income:</span>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">
                          KSh {owned.accruedIncome.toLocaleString()}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          (Earned but not yet received)
                        </p>
                      </div>
                    )}
                  </>
                )}

                {investment.monthlyCashflow > 0 && (
                  <>
                    <div>
                      <span className="text-zinc-600 dark:text-zinc-400">Monthly Cashflow:</span>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        +KSh {investment.monthlyCashflow.toLocaleString()}
                        {owned.currentMonthCashflow !== undefined && owned.currentMonthCashflow !== investment.monthlyCashflow && (
                          <span className="ml-2 text-xs">
                            (This month: {owned.currentMonthCashflow >= 0 ? "+" : ""}KSh {owned.currentMonthCashflow.toLocaleString()})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {isCashflowActive
                          ? owned.earlyCashflowTaken
                            ? "Early cash taken"
                            : investment.volatility > 0
                            ? `Active - varies by ±${(investment.volatility * 100).toFixed(0)}%`
                            : "Active"
                          : `Starts in ${investment.cashflowDelayMonths - monthsSincePurchase} month${investment.cashflowDelayMonths - monthsSincePurchase > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </>
                )}

                {investment.monthlyMaintenance > 0 && (
                  <div>
                    <span className="text-zinc-600 dark:text-zinc-400">Maintenance:</span>
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      -KSh {investment.monthlyMaintenance.toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="col-span-2">
                  <span className="text-zinc-600 dark:text-zinc-400">Net Monthly:</span>
                  <p className={`font-semibold ${
                    netMonthlyCashflow >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {netMonthlyCashflow >= 0 ? "+" : ""}KSh {netMonthlyCashflow.toLocaleString()}
                  </p>
                </div>

                {/* Active Events Display */}
                {owned.activeEvents && owned.activeEvents.length > 0 && (
                  <div className="col-span-2 space-y-2">
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
                                <div>Income Loss: -KSh {event.incomeLoss.toLocaleString()}</div>
                              )}
                              {event.cashflowLoss > 0 && (
                                <div>Cashflow Loss: -KSh {event.cashflowLoss.toLocaleString()}</div>
                              )}
                              {event.additionalCost && event.additionalCost > 0 && (
                                <div>Additional Cost: -KSh {event.additionalCost.toLocaleString()}</div>
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
                        className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                      >
                        Get Early Cash: KSh{" "}
                        {investment.earlyCashflowDiscount.immediateCashflow.toLocaleString()} now
                        ({(investment.earlyCashflowDiscount.discountRate * 100).toFixed(0)}%
                        discount)
                      </button>
                    </div>
                  )}

                {/* Action Buttons */}
                <div className="col-span-2 flex flex-col gap-2 sm:flex-row">
                  {owned.isSelling ? (
                    <div className="flex-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      <p className="font-semibold">Sale in Progress</p>
                      <p className="text-xs">
                        {investment.exitTimeMonths - (currentMonth - (owned.saleInitiatedMonth || currentMonth))} month(s) remaining
                      </p>
                      {investment.exitTimeMonths - (currentMonth - (owned.saleInitiatedMonth || currentMonth)) <= 0 && (
                        <button
                          onClick={() => onSellInvestment(owned.id)}
                          className="mt-2 w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
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
                          `Current value: KSh ${salePrice.toLocaleString()}\n` +
                          `Estimated proceeds: KSh ${proceeds.toLocaleString()}\n` +
                          `(After exit costs: KSh ${exitCost.toLocaleString()})\n\n` +
                          `This will initiate a sale process that takes ${investment.exitTimeMonths} month(s) to complete.`,
                          "Sell Investment"
                        );
                        if (confirmed) {
                          onSellInvestment(owned.id);
                        }
                      }}
                      className="w-full rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
                    >
                      💰 Sell
                    </button>
                  )}
                  {investment.isExtendable && (
                    <button
                      onClick={async () => {
                        const minTopUp = investment.minimumTopUp || 1000;
                        const topUpAmount = await prompt(
                          `Current investment: KSh ${owned.purchaseCost.toLocaleString()}\n` +
                          `Minimum top-up: KSh ${minTopUp.toLocaleString()}\n\n` +
                          `Enter amount to add:`,
                          minTopUp.toString(),
                          `Extend ${investment.name}`
                        );
                        if (topUpAmount) {
                          const amount = parseInt(topUpAmount.replace(/,/g, ""), 10);
                          if (!isNaN(amount) && amount >= minTopUp) {
                            onExtendInvestment(owned.id, amount);
                          } else {
                            alert(`Please enter a valid amount (minimum KSh ${minTopUp.toLocaleString()})`);
                          }
                        }
                      }}
                      className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
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
  );
}
