"use client";

import { useState, useRef } from "react";
import { useDialogs } from "./CustomDialogs";
import type { Investment } from "../types";
import { INVESTMENT_POOL, LOCATIONS } from "../data/investmentPool";
import type { InvestmentPoolTemplate } from "../data/investmentPool";

interface InvestmentGeneratorProps {
  onGenerate: (investments: Investment[]) => void;
  existingInvestmentIds: Set<number>;
}

const RECENTLY_USED_MAX = 40;

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick `count` pool indices, preferring ones not recently used, so each generation tends to be fresh. */
function pickPoolIndices(
  count: number,
  recentlyUsed: number[]
): number[] {
  const usedSet = new Set(recentlyUsed);
  const preferred = INVESTMENT_POOL.map((_, i) => i).filter((i) => !usedSet.has(i));
  const rest = INVESTMENT_POOL.map((_, i) => i).filter((i) => usedSet.has(i));
  const shuffled = [...shuffleArray(preferred), ...shuffleArray(rest)];
  const indices: number[] = [];
  const chosen = new Set<number>();
  for (let i = 0; i < shuffled.length && indices.length < count; i++) {
    if (!chosen.has(shuffled[i])) {
      chosen.add(shuffled[i]);
      indices.push(shuffled[i]);
    }
  }
  return indices;
}

const DESCRIPTIONS: Record<string, string[]> = {
  flat: [
    "Well-maintained property in prime location",
    "Modern apartment with great amenities",
    "Spacious unit with parking",
    "Recently renovated property",
  ],
  shop: [
    "High-traffic location with good visibility",
    "Prime retail space in busy market",
    "Corner location with excellent foot traffic",
    "Established business location",
  ],
  land: [
    "Prime location with development potential",
    "Well-located plot with good access",
    "Strategic location for future development",
    "Corner plot with multiple access points",
  ],
  matatu: [
    "Reliable vehicle on profitable route",
    "Well-maintained vehicle with good returns",
    "Popular route with consistent demand",
    "Established route with loyal customers",
  ],
  mmf: [
    "Low-risk investment with steady returns",
    "Diversified portfolio fund",
    "Conservative investment option",
    "Stable returns with low volatility",
  ],
  sacco: [
    "Established cooperative with good returns",
    "Well-managed investment opportunity",
    "Regular dividend payments",
    "Stable investment with growth potential",
  ],
  stocks: [
    "Listed company with growth potential",
    "Diversified equity exposure",
    "Dividend-paying stock",
    "Blue-chip investment",
  ],
  fixed_deposit: [
    "Fixed-term government security",
    "Predictable returns at maturity",
    "Low-risk capital preservation",
  ],
};

function getLiquidityAndExit(
  type: InvestmentPoolTemplate["type"]
): { liquidity: Investment["liquidity"]; exitCostPercent: number; exitTimeMonths: number; lockInMonths: number; earlyExitPenaltyPercent: number } {
  switch (type) {
    case "flat":
      return { liquidity: "low", exitCostPercent: 0.08, exitTimeMonths: 3, lockInMonths: 6, earlyExitPenaltyPercent: 0.05 };
    case "shop":
      return { liquidity: "medium", exitCostPercent: 0.06, exitTimeMonths: 2, lockInMonths: 3, earlyExitPenaltyPercent: 0.05 };
    case "land":
      return { liquidity: "illiquid", exitCostPercent: 0.12, exitTimeMonths: 6, lockInMonths: 12, earlyExitPenaltyPercent: 0.15 };
    case "matatu":
      return { liquidity: "medium", exitCostPercent: 0.05, exitTimeMonths: 1, lockInMonths: 3, earlyExitPenaltyPercent: 0.08 };
    case "mmf":
      return { liquidity: "high", exitCostPercent: 0, exitTimeMonths: 0, lockInMonths: 0, earlyExitPenaltyPercent: 0 };
    case "sacco":
      return { liquidity: "medium", exitCostPercent: 0.02, exitTimeMonths: 1, lockInMonths: 6, earlyExitPenaltyPercent: 0.05 };
    case "stocks":
      return { liquidity: "high", exitCostPercent: 0.01, exitTimeMonths: 0, lockInMonths: 0, earlyExitPenaltyPercent: 0 };
    case "fixed_deposit":
      return { liquidity: "low", exitCostPercent: 0, exitTimeMonths: 12, lockInMonths: 12, earlyExitPenaltyPercent: 0.05 };
    default:
      return { liquidity: "medium", exitCostPercent: 0.05, exitTimeMonths: 1, lockInMonths: 0, earlyExitPenaltyPercent: 0 };
  }
}

function generateRandomInvestment(
  baseId: number,
  existingIds: Set<number>,
  template: InvestmentPoolTemplate
): Investment {
  let id: number;
  do {
    id = baseId + Math.floor(Math.random() * 1000000);
  } while (existingIds.has(id));

  const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const descriptionPool = DESCRIPTIONS[template.type] || ["Investment opportunity"];
  const description = descriptionPool[Math.floor(Math.random() * descriptionPool.length)];

  // Generate cost within realistic Kenya market range
  // For MMF, ensure minimum is 5000
  const effectiveMinCost = template.type === "mmf" ? Math.max(5000, template.minCost) : template.minCost;
  const costRange = template.maxCost - effectiveMinCost;
  const randomCost = effectiveMinCost + Math.random() * costRange;
  // Round to nearest 10000 for larger investments, 1000 for smaller ones
  const roundingFactor = effectiveMinCost >= 1000000 ? 10000 : 1000;
  let initialCost = Math.round(randomCost / roundingFactor) * roundingFactor;
  // Ensure MMF meets minimum requirement
  if (template.type === "mmf" && initialCost < 5000) {
    initialCost = 5000;
  }

  // Check if this is a rental option for shops
  const canRent = "canRent" in template && template.canRent;
  const isRental = canRent && Math.random() > 0.5; // 50% chance of rental option

  // Calculate income based on realistic ROI
  let monthlyIncome = 0;
  let monthlyCashflow = 0;
  let monthlyMaintenance = 0;

  if ("isAppreciationOnly" in template && template.isAppreciationOnly) {
    // Land - no monthly income, only appreciation
    monthlyIncome = 0;
    monthlyCashflow = 0;
    monthlyMaintenance = 0;
  } else if (isRental && canRent && "monthlyRentMin" in template && "monthlyRentMax" in template) {
    // Shop rental option - pay monthly rent instead of purchase
    const rentMin = template.monthlyRentMin;
    const rentMax = template.monthlyRentMax;
    if (rentMin == null || rentMax == null) throw new Error("Rental template missing rent bounds");
    const rentRange = rentMax - rentMin;
    const monthlyRent = rentMin + Math.random() * rentRange;
    initialCost = Math.round(monthlyRent / 1000) * 1000; // Use rent as "cost"
    // Rental shops typically have 15-25% profit margin
    monthlyIncome = Math.round(monthlyRent * (0.15 + Math.random() * 0.10));
    monthlyCashflow = monthlyIncome;
    monthlyMaintenance = Math.round(monthlyIncome * (template.maintenanceRate || 0.15));
  } else {
    // Purchase option - calculate based on annual ROI
    // Convert annual ROI to monthly (divide by 12)
    const monthlyROI = template.annualROI / 12;
    monthlyIncome = Math.round(initialCost * monthlyROI);
    
    // For real estate, rental income is typically 0.5-0.8% of property value monthly
    if (template.type === "flat") {
      monthlyIncome = Math.round(initialCost * (0.005 + Math.random() * 0.003));
    }
    
    monthlyCashflow = monthlyIncome;
    monthlyMaintenance = Math.round(monthlyIncome * (template.maintenanceRate || 0.15));
  }

  // Cashflow timing - realistic delays
  let incomeDelayMonths = 0;
  let cashflowDelayMonths = 0;
  
  if (template.type === "flat" || template.type === "shop") {
    // Real estate may have 0-1 month delay for first tenant
    incomeDelayMonths = Math.random() > 0.7 ? 1 : 0;
    cashflowDelayMonths = incomeDelayMonths;
  } else if (template.type === "matatu") {
    // Matatu income recognized immediately but cash may be delayed 1 month
    incomeDelayMonths = 0;
    cashflowDelayMonths = Math.random() > 0.6 ? 1 : 0;
  } else if (template.type === "sacco" || template.type === "mmf") {
    // Financial investments: dividends/interest paid quarterly or annually
    incomeDelayMonths = Math.random() > 0.5 ? Math.floor(Math.random() * 3) : 0; // 0-2 months
    cashflowDelayMonths = incomeDelayMonths;
  } else if (template.type === "stocks") {
    if (template.isAppreciationOnly || template.annualROI === 0) {
      monthlyIncome = 0;
      monthlyCashflow = 0;
      incomeDelayMonths = 0;
      cashflowDelayMonths = 0;
    } else {
      incomeDelayMonths = Math.random() > 0.7 ? Math.floor(Math.random() * 2) : 0;
      cashflowDelayMonths = incomeDelayMonths;
    }
  } else if (template.type === "fixed_deposit") {
    incomeDelayMonths = 12;
    cashflowDelayMonths = 12;
    monthlyIncome = 0;
    monthlyCashflow = 0;
  }

  // Early cashflow discount - available for matatu/business with delayed cashflow
  const hasEarlyCashflow = 
    (template.type === "matatu" || template.type === "shop") && 
    monthlyCashflow > 0 && 
    cashflowDelayMonths > 0 &&
    Math.random() > 0.7; // 30% chance
    
  const earlyCashflowDiscount = hasEarlyCashflow
    ? {
        available: true,
        discountRate: 0.10 + Math.random() * 0.10, // 10-20% discount
        immediateCashflow: Math.round(monthlyCashflow * (1 - (0.10 + Math.random() * 0.10))),
      }
    : undefined;

  const { liquidity, exitCostPercent, exitTimeMonths, lockInMonths, earlyExitPenaltyPercent } = getLiquidityAndExit(template.type);

  let investmentName = `${template.name} - ${location}`;
  if (isRental && canRent) {
    investmentName += " (Rental)";
  }

  const investment: Investment = {
    id,
    name: investmentName,
    type: template.type as Investment["type"],
    description: isRental && canRent
      ? `${description} in ${location} - Monthly rental option`
      : `${description} in ${location}`,
    initialCost,
    monthlyMaintenance,
    monthlyIncome,
    monthlyCashflow,
    incomeDelayMonths,
    cashflowDelayMonths,
    icon: template.icon,
    isAppreciationOnly: ("isAppreciationOnly" in template && template.isAppreciationOnly) || false,
    riskLevel: template.riskLevel,
    volatility: template.volatility,
    eventProbabilities: template.eventProbabilities,
    liquidity,
    exitCostPercent,
    exitTimeMonths,
    lockInMonths,
    earlyExitPenaltyPercent,
    incomeTaxRate:
      template.type === "sacco"
        ? 0.0
        : template.type === "flat"
        ? 0.10
        : template.type === "shop"
        ? 0.15
        : template.type === "matatu"
        ? 0.20
        : template.type === "mmf" || template.type === "fixed_deposit"
        ? 0.15
        : template.type === "stocks"
        ? 0.15
        : undefined,
    capitalGainsTaxRate:
      template.type === "sacco" || template.type === "fixed_deposit"
        ? 0.0
        : template.type === "land"
        ? 0.10
        : template.type === "flat" || template.type === "shop"
        ? 0.05
        : template.type === "matatu"
        ? 0.0
        : template.type === "stocks"
        ? 0.05
        : 0.0,
    isTaxExempt: template.type === "sacco",
    // Correlation groups for diversification
    correlationGroup:
      template.type === "flat" || template.type === "shop" || template.type === "land"
        ? "real_estate"
        : template.type === "matatu"
        ? "vehicles"
        : template.type === "mmf" || template.type === "sacco" || template.type === "fixed_deposit"
        ? "financial"
        : template.type === "stocks"
        ? "equities"
        : "other",
    // Appreciation/Depreciation rates
    appreciationRate:
      template.type === "land"
        ? 0.10 + Math.random() * 0.06 // 10-16% for land
        : template.type === "flat" || template.type === "shop"
        ? 0.06 + Math.random() * 0.04 // 6-10% for property
        : undefined,
    depreciationRate:
      template.type === "matatu"
        ? 0.15 + Math.random() * 0.10 // 15-25% for vehicles
        : undefined,
    isExtendable:
      template.type === "mmf" || template.type === "sacco" ||
      template.type === "flat" || template.type === "shop" || template.type === "land" || template.type === "stocks"
        ? true
        : false,
    minimumTopUp:
      template.type === "mmf" || template.type === "sacco"
        ? 1000
        : template.type === "stocks"
        ? 5000
        : template.type === "land"
        ? 50000
        : template.type === "flat"
        ? 100000
        : template.type === "shop"
        ? 200000
        : undefined,
    isFlexibleAmount:
      template.type === "mmf" || template.type === "sacco" || template.type === "stocks"
        ? true
        : false,
    minimumInvestment:
      template.type === "mmf"
        ? 5000
        : template.type === "sacco"
        ? 5000
        : template.type === "stocks"
        ? 10000
        : template.type === "fixed_deposit"
        ? 50000
        : undefined,
    dueDiligenceHours: 2 + Math.floor(Math.random() * 5), // 2–6 hours
    earlyCashflowDiscount,
  };

  return investment;
}

export function InvestmentGenerator({
  onGenerate,
  existingInvestmentIds,
}: InvestmentGeneratorProps) {
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const recentlyUsedRef = useRef<number[]>([]);

  const handleGenerate = () => {
    if (count < 1 || count > 20) {
      alert("Please enter a number between 1 and 20");
      return;
    }

    setIsGenerating(true);
    setGeneratedCount(0);

    const poolIndices = pickPoolIndices(count, recentlyUsedRef.current);
    recentlyUsedRef.current = [...recentlyUsedRef.current, ...poolIndices].slice(-RECENTLY_USED_MAX);

    const investments: Investment[] = [];
    const baseId = Date.now();
    const ids = new Set(existingInvestmentIds);

    const generateWithDelay = (index: number) => {
      setTimeout(() => {
        const template = INVESTMENT_POOL[poolIndices[index]];
        const investment = generateRandomInvestment(baseId + index, ids, template);
        investments.push(investment);
        ids.add(investment.id);
        setGeneratedCount(index + 1);

        if (index === count - 1) {
          setTimeout(() => {
            setIsGenerating(false);
            onGenerate(investments);
            setGeneratedCount(0);
          }, 300);
        }
      }, index * 200);
    };

    for (let i = 0; i < count; i++) {
      generateWithDelay(i);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Generate Investment Opportunities
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create randomized investment opportunities to explore
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Number of Opportunities
          </label>
          <input
            type="number"
            value={count}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= 20) {
                setCount(val);
              }
            }}
            min="1"
            max="20"
            disabled={isGenerating}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-2 font-semibold text-white transition-all hover:from-purple-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:from-purple-500 dark:to-blue-500 dark:hover:from-purple-600 dark:hover:to-blue-600"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating... ({generatedCount}/{count})
            </span>
          ) : (
            "🎰 Generate Opportunities"
          )}
        </button>
      </div>

      {isGenerating && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Generating investments...</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {generatedCount} / {count}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300 dark:from-purple-500 dark:to-blue-500"
              style={{ width: `${(generatedCount / count) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

