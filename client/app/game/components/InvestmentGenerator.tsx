"use client";

import { useState } from "react";
import { useDialogs } from "./CustomDialogs";
import type { Investment } from "../types";

interface InvestmentGeneratorProps {
  onGenerate: (investments: Investment[]) => void;
  existingInvestmentIds: Set<number>;
}

// Investment type templates with realistic Kenya market prices (min, max in KSh)
// Based on actual Kenya market data 2024
const INVESTMENT_TYPES = [
  // Real Estate - Purchase prices
  { 
    type: "flat", 
    name: "Residential Flat (2BR)", 
    icon: "🏢", 
    minCost: 3000000, 
    maxCost: 8000000, // Nairobi: 3-8M for 2-bedroom
    annualROI: 0.06, // 6% rental yield
    maintenanceRate: 0.15, // 15% of rental income for maintenance
    riskLevel: "medium" as const,
    volatility: 0.15, // 15% variation
    eventProbabilities: {
      vacancy: 0.05,
      maintenanceSurprise: 0.03,
    },
  },
  { 
    type: "flat", 
    name: "Commercial Property", 
    icon: "🏬", 
    minCost: 5000000, 
    maxCost: 15000000, // Commercial properties
    annualROI: 0.08, // 8% rental yield
    maintenanceRate: 0.20, // 20% of rental income
    riskLevel: "medium" as const,
    volatility: 0.18, // 18% variation
    eventProbabilities: {
      vacancy: 0.06,
      maintenanceSurprise: 0.04,
    },
  },
  // Shops - Can be rented or purchased
  { 
    type: "shop", 
    name: "Retail Shop (Purchase)", 
    icon: "🏪", 
    minCost: 500000, 
    maxCost: 3000000, // Shop purchase prices
    annualROI: 0.10, // 10% return
    maintenanceRate: 0.15,
    canRent: true,
    monthlyRentMin: 20000,
    monthlyRentMax: 100000, // Monthly rental option
    riskLevel: "medium" as const,
    volatility: 0.20, // 20% variation
    eventProbabilities: {
      vacancy: 0.08,
      default: 0.05,
      maintenanceSurprise: 0.04,
    },
  },
  { 
    type: "shop", 
    name: "Market Stall", 
    icon: "🛒", 
    minCost: 200000, 
    maxCost: 800000,
    annualROI: 0.12, // 12% return
    maintenanceRate: 0.10,
    canRent: true,
    monthlyRentMin: 10000,
    monthlyRentMax: 40000,
    riskLevel: "medium" as const,
    volatility: 0.25, // 25% variation
    eventProbabilities: {
      vacancy: 0.10,
      default: 0.06,
      maintenanceSurprise: 0.05,
    },
  },
  // Land - Appreciation only, no monthly income
  { 
    type: "land", 
    name: "Residential Land (1/8 acre)", 
    icon: "🌾", 
    minCost: 500000, 
    maxCost: 3000000, // Varies by location
    annualROI: 0.10, // 10% appreciation (no monthly income)
    maintenanceRate: 0,
    isAppreciationOnly: true,
    riskLevel: "medium" as const,
    volatility: 0.0, // No monthly income to vary
  },
  { 
    type: "land", 
    name: "Commercial Land", 
    icon: "🏗️", 
    minCost: 2000000, 
    maxCost: 10000000,
    annualROI: 0.12, // 12% appreciation
    maintenanceRate: 0,
    isAppreciationOnly: true,
    riskLevel: "medium" as const,
    volatility: 0.0, // No monthly income to vary
  },
  // Vehicles
  { 
    type: "matatu", 
    name: "Matatu (14-seater)", 
    icon: "🚐", 
    minCost: 800000, 
    maxCost: 1500000, // Actual matatu prices
    annualROI: 0.18, // 18% annual return (1.5% monthly) - high but realistic
    maintenanceRate: 0.30, // High maintenance (30% of income)
    riskLevel: "high" as const,
    volatility: 0.30, // 30% variation - very volatile
    eventProbabilities: {
      breakdown: 0.10,
      maintenanceSurprise: 0.08,
    },
  },
  { 
    type: "matatu", 
    name: "Taxi/Uber", 
    icon: "🚕", 
    minCost: 600000, 
    maxCost: 1200000,
    annualROI: 0.15, // 15% annual return (1.25% monthly)
    maintenanceRate: 0.25,
    riskLevel: "high" as const,
    volatility: 0.25, // 25% variation
    eventProbabilities: {
      breakdown: 0.08,
      maintenanceSurprise: 0.06,
    },
  },
  // Financial Investments
  { 
    type: "mmf", 
    name: "Money Market Fund", 
    icon: "📈", 
    minCost: 5000, // Minimum KSh 5,000 for MMF
    maxCost: 10000000, // No limit really
    annualROI: 0.10, // 10% annual (0.83% monthly)
    maintenanceRate: 0,
    riskLevel: "low" as const,
    volatility: 0.05, // 5% variation - very stable
  },
  { 
    type: "sacco", 
    name: "SACCO Shares", 
    icon: "🏛️", 
    minCost: 5000, 
    maxCost: 500000,
    annualROI: 0.12, // 12% annual (1% monthly)
    maintenanceRate: 0,
    riskLevel: "low" as const,
    volatility: 0.08, // 8% variation - relatively stable
  },
  { 
    type: "sacco", 
    name: "Investment Club", 
    icon: "👥", 
    minCost: 10000, 
    maxCost: 1000000,
    annualROI: 0.15, // 15% annual (1.25% monthly)
    maintenanceRate: 0,
    riskLevel: "medium" as const,
    volatility: 0.12, // 12% variation
  },
] as const;

const LOCATIONS = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Kitale", "Malindi"
];

const DESCRIPTIONS = {
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
};

function generateRandomInvestment(
  baseId: number,
  existingIds: Set<number>
): Investment {
  let investment: Investment;
  let id: number;
  
  // Generate unique ID
  do {
    id = baseId + Math.floor(Math.random() * 1000000);
  } while (existingIds.has(id));

  const template = INVESTMENT_TYPES[Math.floor(Math.random() * INVESTMENT_TYPES.length)] as typeof INVESTMENT_TYPES[number];
  const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const descriptionPool = DESCRIPTIONS[template.type as keyof typeof DESCRIPTIONS] || ["Investment opportunity"];
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
    const rentRange = template.monthlyRentMax - template.monthlyRentMin;
    const monthlyRent = template.monthlyRentMin + Math.random() * rentRange;
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
  } else if ((template as any).type === "fixed_deposit") {
    // Fixed deposit: interest paid at maturity (12 months)
    incomeDelayMonths = 12;
    cashflowDelayMonths = 12;
    monthlyIncome = 0; // No monthly income, paid at maturity
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

  // Build name with location and rental indicator
  let investmentName = `${template.name} - ${location}`;
  if (isRental && canRent) {
    investmentName += " (Rental)";
  }

  investment = {
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
    riskLevel: template.riskLevel as "low" | "medium" | "high",
    volatility: template.volatility,
    // Tax rates based on investment type
    incomeTaxRate:
      template.type === "sacco"
        ? 0.0 // Tax-exempt
        : template.type === "flat"
        ? 0.10 // 10% on rental income
        : template.type === "shop"
        ? 0.15 // 15% on business income
        : template.type === "matatu"
        ? 0.20 // 20% on business income
        : template.type === "mmf"
        ? 0.15 // 15% withholding tax
        : undefined,
    capitalGainsTaxRate:
      template.type === "sacco"
        ? 0.0 // Tax-exempt
        : template.type === "land"
        ? 0.10 // 10% on land
        : template.type === "flat" || template.type === "shop"
        ? 0.05 // 5% on property
        : template.type === "matatu"
        ? 0.0 // No capital gains (depreciating)
        : 0.0,
    isTaxExempt: template.type === "sacco",
    // Correlation groups for diversification
    correlationGroup:
      template.type === "flat" || template.type === "shop" || template.type === "land"
        ? "real_estate"
        : template.type === "matatu"
        ? "vehicles"
        : template.type === "mmf" || template.type === "sacco"
        ? "financial"
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
    // Extension properties
    isExtendable:
      template.type === "mmf" || template.type === "sacco" || 
      template.type === "flat" || template.type === "shop" || template.type === "land"
        ? true
        : false,
    minimumTopUp:
      template.type === "mmf" || template.type === "sacco"
        ? 1000 // KSh 1,000 minimum for financial products
        : template.type === "land"
        ? 50000 // KSh 50,000 minimum for land
        : template.type === "flat"
        ? 100000 // KSh 100,000 minimum for residential
        : template.type === "shop"
        ? 200000 // KSh 200,000 minimum for commercial
        : undefined,
    earlyCashflowDiscount,
  } as Investment;

  return investment;
}

export function InvestmentGenerator({
  onGenerate,
  existingInvestmentIds,
}: InvestmentGeneratorProps) {
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  const handleGenerate = () => {
    if (count < 1 || count > 20) {
      alert("Please enter a number between 1 and 20");
      return;
    }

    setIsGenerating(true);
    setGeneratedCount(0);

    // Simulate spinning/generating effect
    const investments: Investment[] = [];
    const baseId = Date.now();
    
    // Generate investments with delay for visual effect
    const generateWithDelay = (index: number) => {
      setTimeout(() => {
        const investment = generateRandomInvestment(baseId + index, existingInvestmentIds);
        investments.push(investment);
        setGeneratedCount(index + 1);

        if (index === count - 1) {
          // All generated, finish
          setTimeout(() => {
            setIsGenerating(false);
            onGenerate(investments);
            setGeneratedCount(0);
          }, 300);
        }
      }, index * 200); // 200ms delay between each
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

