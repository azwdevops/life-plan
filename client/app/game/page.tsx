"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { InvestmentOpportunityCard } from "./components/InvestmentOpportunityCard";
import { PortfolioDisplay } from "./components/PortfolioDisplay";
import { CashflowTimeline } from "./components/CashflowTimeline";
import { GameStats } from "./components/GameStats";
import { InvoiceManager } from "./components/InvoiceManager";
import { InvestmentGenerator } from "./components/InvestmentGenerator";
import { LoanManager } from "./components/LoanManager";
import { BorrowingManager } from "./components/BorrowingManager";
import { ExpensesManager } from "./components/ExpensesManager";
import { DialogProvider, useDialogs } from "./components/CustomDialogs";
import { saveGame, loadGame, clearGame } from "./utils/gameStorage";
import type { Investment, OwnedInvestment, GameState, Invoice, Loan, MarketCondition, UnexpectedEvent, Expense, ContingentLiability, ContingentLiabilityType } from "./types";

// Utility function to get date from month offset
function getDateFromMonth(startDate: Date, monthOffset: number): Date {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

// Utility function to format date as "Month Year"
function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Calculate diversification score (0-1) based on correlation groups
function calculateDiversificationScore(portfolio: OwnedInvestment[]): number {
  if (portfolio.length === 0) return 0;
  if (portfolio.length === 1) return 0.2; // Single investment has low diversification

  // Count unique correlation groups
  const groups = new Set<string>();
  portfolio.forEach((owned) => {
    const group = owned.investment.correlationGroup || "other";
    groups.add(group);
  });

  // Diversification score: more groups = better diversification
  // Max score when portfolio has investments from 4+ different groups
  const uniqueGroups = groups.size;
  const totalInvestments = portfolio.length;
  
  // Score based on: (unique groups / total investments) * (unique groups / 4)
  // Capped at 1.0
  const groupDiversity = uniqueGroups / Math.max(totalInvestments, 1);
  const groupCoverage = Math.min(uniqueGroups / 4, 1); // Max at 4 groups
  const score = Math.min(groupDiversity * 0.6 + groupCoverage * 0.4, 1.0);
  
  return Math.round(score * 100) / 100; // Round to 2 decimals
}

// Calculate risk reduction from diversification (0-1)
// Well-diversified portfolios have lower overall volatility
function calculateRiskReduction(portfolio: OwnedInvestment[]): number {
  if (portfolio.length === 0) return 0;
  if (portfolio.length === 1) return 0;

  const diversificationScore = calculateDiversificationScore(portfolio);
  
  // Risk reduction increases with diversification
  // Max 30% risk reduction for fully diversified portfolio
  const maxRiskReduction = 0.30;
  return Math.round(diversificationScore * maxRiskReduction * 100) / 100;
}

// Initial game state - realistic starting capital for Kenya
const INITIAL_MONEY = 50000; // KSh 50,000 starting capital

// Sample investment opportunities with realistic Kenya market prices and ROI
const INVESTMENT_OPPORTUNITIES: Investment[] = [
  {
    id: 1,
    name: "Residential Flat (2BR)",
    type: "flat",
    description: "2-bedroom apartment in Nairobi - realistic rental yield",
    initialCost: 5000000, // KSh 5M - realistic for 2BR in Nairobi
    monthlyMaintenance: 15000, // 15% of rental income
    monthlyIncome: 40000, // ~0.8% monthly rental yield (9.6% annually)
    monthlyCashflow: 40000,
    incomeDelayMonths: 0,
    cashflowDelayMonths: 0,
    icon: "🏢",
    riskLevel: "low",
    volatility: 0.10, // 10% variation - rental income is relatively stable
    eventProbabilities: {
      vacancy: 0.05, // 5% chance per month
      default: 0.02, // 2% chance of tenant default
      maintenanceSurprise: 0.03,
    },
    liquidity: "low",
    exitCostPercent: 0.08, // 8% transaction costs (legal, agent fees)
    exitTimeMonths: 3, // Takes 2-4 months to sell
    lockInMonths: 6, // Minimum 6 months before can sell
    earlyExitPenaltyPercent: 0.05, // 5% penalty if sold early
    marketSensitivity: 0.6, // Real estate is moderately sensitive to market
    seasonality: {
      highSeasonMonths: [10, 11, 0, 1], // Nov, Dec, Jan, Feb (holiday season)
      lowSeasonMonths: [5, 6, 7], // May, Jun, Jul (low season)
      highSeasonMultiplier: 1.15, // 15% boost
      lowSeasonMultiplier: 0.90, // 10% reduction
    },
    incomeTaxRate: 0.10, // 10% tax on rental income
    capitalGainsTaxRate: 0.05, // 5% capital gains tax
    correlationGroup: "real_estate", // Real estate investments are correlated
    appreciationRate: 0.08, // 8% annual appreciation for real estate
    isExtendable: true, // Can buy more units or expand
    minimumTopUp: 100000, // Minimum top-up of KSh 100,000 for property
  },
  {
    id: 2,
    name: "Commercial Shop (Purchase)",
    type: "shop",
    description: "Retail shop in busy area - purchase option",
    initialCost: 2000000, // KSh 2M purchase price
    monthlyMaintenance: 25000, // 15% of income
    monthlyIncome: 16667, // 10% annual ROI = 0.83% monthly
    monthlyCashflow: 16667,
    incomeDelayMonths: 0,
    cashflowDelayMonths: 0,
    icon: "🏪",
    riskLevel: "medium",
    volatility: 0.20, // 20% variation - business income fluctuates
    eventProbabilities: {
      vacancy: 0.08, // 8% chance per month (higher for shops)
      default: 0.05, // 5% chance of tenant default
      maintenanceSurprise: 0.04,
    },
    liquidity: "low",
    exitCostPercent: 0.10, // 10% transaction costs for commercial property
    exitTimeMonths: 4, // Takes 3-5 months to sell
    lockInMonths: 12, // 1 year lock-in for commercial
    earlyExitPenaltyPercent: 0.10, // 10% penalty
    marketSensitivity: 0.7, // Commercial is more sensitive
    seasonality: {
      highSeasonMonths: [10, 11, 0], // Nov, Dec, Jan (holiday shopping)
      lowSeasonMonths: [1, 2], // Jan, Feb (post-holiday slump)
      highSeasonMultiplier: 1.20,
      lowSeasonMultiplier: 0.85,
    },
    incomeTaxRate: 0.15, // 15% tax on commercial rental income
    capitalGainsTaxRate: 0.10, // 10% capital gains tax
    correlationGroup: "real_estate", // Real estate investments are correlated
    appreciationRate: 0.10, // 10% annual appreciation for commercial property
    isExtendable: true, // Can expand commercial property
    minimumTopUp: 200000, // Minimum top-up of KSh 200,000 for commercial
  },
  {
    id: 3,
    name: "Land Plot (1/8 acre)",
    type: "land",
    description: "Residential land plot - appreciation only, no monthly income",
    initialCost: 1500000, // KSh 1.5M for 1/8 acre in developing area
    monthlyMaintenance: 0,
    monthlyIncome: 0,
    monthlyCashflow: 0,
    incomeDelayMonths: 0,
    cashflowDelayMonths: 0,
    icon: "🌾",
    isAppreciationOnly: true,
    riskLevel: "medium",
    volatility: 0.0, // No monthly income to vary
    liquidity: "illiquid", // Land is very illiquid
    exitCostPercent: 0.12, // 12% transaction costs (legal, survey, etc.)
    exitTimeMonths: 6, // Takes 4-8 months to sell land
    lockInMonths: 12, // 1 year minimum hold
    earlyExitPenaltyPercent: 0.15, // 15% penalty
    marketSensitivity: 0.4, // Land is less sensitive (appreciation)
    incomeTaxRate: 0.0, // No income tax (appreciation only)
    capitalGainsTaxRate: 0.10, // 10% capital gains tax on land sale
    correlationGroup: "real_estate", // Real estate investments are correlated
    appreciationRate: 0.12, // 12% annual appreciation for land (higher than buildings)
    isExtendable: true, // Can buy adjacent land plots
    minimumTopUp: 50000, // Minimum top-up of KSh 50,000 for land
  },
  {
    id: 4,
    name: "Matatu (14-seater)",
    type: "matatu",
    description: "Public transport vehicle - high returns but delayed cashflow",
    initialCost: 1200000, // KSh 1.2M - realistic matatu price
    monthlyMaintenance: 4500, // 30% of income for maintenance
    monthlyIncome: 15000, // 18% annual ROI = 1.5% monthly (KSh 18,000/year)
    monthlyCashflow: 15000, // Cash received 1 month later
    incomeDelayMonths: 0,
    cashflowDelayMonths: 1,
    icon: "🚐",
    riskLevel: "high",
    volatility: 0.30, // 30% variation - high risk, income very volatile
    eventProbabilities: {
      breakdown: 0.10, // 10% chance per month of breakdown
      maintenanceSurprise: 0.08, // 8% chance of major repair
    },
    liquidity: "medium", // Vehicles can be sold but take time
    exitCostPercent: 0.05, // 5% transaction costs
    exitTimeMonths: 1, // Takes 2-4 weeks to sell
    lockInMonths: 3, // 3 month minimum
    earlyExitPenaltyPercent: 0.08, // 8% penalty
    marketSensitivity: 0.5, // Vehicles moderately sensitive
    seasonality: {
      highSeasonMonths: [11, 0, 1, 2], // Dec, Jan, Feb, Mar (festive season, school opening)
      lowSeasonMonths: [4, 5], // Apr, May (low season)
      highSeasonMultiplier: 1.25, // 25% boost during high season
      lowSeasonMultiplier: 0.75, // 25% reduction
    },
    incomeTaxRate: 0.20, // 20% tax on business income (matatu)
    capitalGainsTaxRate: 0.0, // No capital gains (depreciating asset)
    correlationGroup: "vehicles", // Vehicle investments are correlated
    depreciationRate: 0.20, // 20% annual depreciation for vehicles
    earlyCashflowDiscount: {
      available: true,
      discountRate: 0.10,
      immediateCashflow: 13500, // Get 13,500 now instead of 15,000 later
    },
  },
  {
    id: 5,
    name: "Money Market Fund",
    type: "mmf",
    description: "Low-risk investment with steady returns - 10% annual",
    initialCost: 5000, // Minimum investment KSh 5,000
    monthlyMaintenance: 0,
    monthlyIncome: 42, // 10% annual = 0.83% monthly on KSh 5,000 = ~KSh 42
    monthlyCashflow: 42,
    incomeDelayMonths: 0,
    cashflowDelayMonths: 0,
    icon: "📈",
    riskLevel: "low",
    volatility: 0.05, // 5% variation - very stable
    liquidity: "high", // MMF is highly liquid
    exitCostPercent: 0.0, // No exit costs
    exitTimeMonths: 0, // Immediate withdrawal
    lockInMonths: 0, // No lock-in
    marketSensitivity: 0.3, // MMF is less sensitive
    incomeTaxRate: 0.15, // 15% withholding tax on interest
    capitalGainsTaxRate: 0.0, // No capital gains (interest is taxed as income)
    correlationGroup: "financial", // Financial investments are correlated
    isExtendable: true, // Can top up MMF
    minimumTopUp: 1000, // Minimum top-up of KSh 1,000
    isFlexibleAmount: true, // User can specify investment amount
    minimumInvestment: 5000, // Minimum KSh 5,000
  },
  {
    id: 6,
    name: "SACCO Investment",
    type: "sacco",
    description: "Savings and credit cooperative - 12% annual returns",
    initialCost: 50000, // Minimum SACCO shares
    monthlyMaintenance: 0,
    monthlyIncome: 500, // 12% annual = 1% monthly
    monthlyCashflow: 500, // Paid quarterly, so 2 month delay
    incomeDelayMonths: 2,
    cashflowDelayMonths: 2,
    icon: "🏛️",
    riskLevel: "low",
    volatility: 0.08, // 8% variation - relatively stable
    liquidity: "medium", // SACCO shares can be withdrawn but with notice
    exitCostPercent: 0.02, // 2% exit fee
    exitTimeMonths: 1, // 1 month notice period
    lockInMonths: 6, // 6 month minimum
    earlyExitPenaltyPercent: 0.05, // 5% penalty
    marketSensitivity: 0.2, // SACCO is less sensitive
    isTaxExempt: true, // SACCO dividends are tax-exempt in Kenya
    incomeTaxRate: 0.0, // Tax-exempt
    capitalGainsTaxRate: 0.0, // Tax-exempt
    correlationGroup: "financial", // Financial investments are correlated
    isExtendable: true, // Can add more SACCO shares
    minimumTopUp: 1000, // Minimum top-up of KSh 1,000
    isFlexibleAmount: true, // User can specify investment amount
    minimumInvestment: 5000, // Minimum KSh 5,000
  },
  {
    id: 7,
    name: "Rental House (3BR)",
    type: "flat",
    description: "3-bedroom house for rent in good location",
    initialCost: 8000000, // KSh 8M for 3BR house
    monthlyMaintenance: 20000, // 20% of rental
    monthlyIncome: 60000, // ~0.75% monthly yield (9% annually)
    monthlyCashflow: 60000,
    incomeDelayMonths: 0,
    cashflowDelayMonths: 0,
    icon: "🏠",
    riskLevel: "medium",
    volatility: 0.12, // 12% variation - rental can fluctuate
    liquidity: "low",
    exitCostPercent: 0.08, // 8% transaction costs
    exitTimeMonths: 3, // Takes 2-4 months to sell
  },
  {
    id: 8,
    name: "Shop Rental",
    type: "shop",
    description: "Retail space rental - monthly payment option",
    initialCost: 50000, // Monthly rent KSh 50,000
    monthlyMaintenance: 7500, // 15% of income
    monthlyIncome: 10000, // 20% profit margin on rental business
    monthlyCashflow: 10000,
    incomeDelayMonths: 0,
    cashflowDelayMonths: 0,
    icon: "🛒",
    riskLevel: "medium",
    volatility: 0.25, // 25% variation - business income can vary significantly
    liquidity: "medium", // Shop rental - can exit monthly
    exitCostPercent: 0.0, // No exit cost for rental
    exitTimeMonths: 0, // Can exit immediately (rental)
    lockInMonths: 0, // No lock-in for rental
  },
  {
    id: 9,
    name: "Consulting Services",
    type: "consulting",
    description: "Provide consulting services - issue invoices",
    initialCost: 0, // No initial cost, just time
    monthlyMaintenance: 0,
    monthlyIncome: 0, // Income comes from invoices
    monthlyCashflow: 0,
    incomeDelayMonths: 0,
    cashflowDelayMonths: 0,
    icon: "💼",
    riskLevel: "medium",
    volatility: 0.40, // 40% variation - consulting income very variable
    liquidity: "high", // Consulting has no asset to sell
    exitCostPercent: 0.0,
    exitTimeMonths: 0,
    lockInMonths: 0,
  },
];

function GamePageContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebar();
  const { alert, confirm, prompt } = useDialogs();

  // Initialize game state from localStorage or default
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== "undefined") {
      const savedGame = loadGame();
      if (savedGame) {
        return savedGame;
      }
    }
    return {
      currentMoney: INITIAL_MONEY,
      portfolio: [],
      invoices: [],
      currentMonth: 0,
      startDate: new Date(), // Start from current date
      totalInvested: 0,
      totalIncome: 0,
      totalCashflow: 0,
      accruedIncome: 0,
      unexpectedEvents: [],
      marketCondition: "normal",
      marketHistory: [{ condition: "normal", month: 0, multiplier: 1.0 }],
      loans: [],
      totalDebt: 0,
      totalTaxPaid: 0,
      monthlyTaxPaid: 0,
      diversificationScore: 0,
      portfolioRiskReduction: 0,
      totalOpportunityCost: 0,
      monthlyOpportunityCost: 0,
      cashflowHistory: [],
      gameOver: false,
      expenses: [],
      totalExpenses: 0,
      contingentLiabilities: [],
      totalContingentLiabilities: 0,
    };
  });

  // Get current actual date
  const currentDate = useMemo(
    () => getDateFromMonth(gameState.startDate, gameState.currentMonth),
    [gameState.startDate, gameState.currentMonth]
  );

  const [generatedInvestments, setGeneratedInvestments] = useState<Investment[]>([]);

  // Auto-save game state to localStorage (debounced)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Don't save if game hasn't started (still at initial state)
    if (gameState.currentMonth === 0 && gameState.portfolio.length === 0 && gameState.expenses.length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      try {
        saveGame(gameState);
      } catch (error) {
        console.error("Failed to auto-save game:", error);
      }
    }, 1000); // Debounce: save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [gameState]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  const availableOpportunities = useMemo(() => {
    // Consulting can be done multiple times, others are one-time purchases
    const ownedIds = new Set(
      gameState.portfolio
        .filter((inv) => inv.investment.type !== "consulting")
        .map((inv) => inv.investmentId)
    );
    
    // Combine base opportunities with generated ones
    const allOpportunities = [...INVESTMENT_OPPORTUNITIES, ...generatedInvestments];
    
    return allOpportunities.filter(
      (opp) => opp.type === "consulting" || !ownedIds.has(opp.id)
    );
  }, [gameState.portfolio, generatedInvestments]);

  const existingInvestmentIds = useMemo(() => {
    const ids = new Set<number>();
    INVESTMENT_OPPORTUNITIES.forEach((inv) => ids.add(inv.id));
    generatedInvestments.forEach((inv) => ids.add(inv.id));
    gameState.portfolio.forEach((owned) => ids.add(owned.investmentId));
    return ids;
  }, [generatedInvestments, gameState.portfolio]);

  const handleGenerateInvestments = (newInvestments: Investment[]) => {
    setGeneratedInvestments((prev) => [...prev, ...newInvestments]);
  };

  const handlePurchase = async (investment: Investment, customAmount?: number) => {
    if (investment.type === "consulting") {
      // For consulting, show invoice creation dialog
      // This will be handled by InvoiceManager component
      return;
    }

    // For flexible amount investments, use custom amount or default to initialCost
    const purchaseAmount = investment.isFlexibleAmount && customAmount 
      ? customAmount 
      : investment.initialCost;
    
    // Validate minimum investment
    if (investment.isFlexibleAmount && customAmount) {
      if (investment.minimumInvestment && customAmount < investment.minimumInvestment) {
        await alert(`Minimum investment amount is KSh ${investment.minimumInvestment.toLocaleString()}`);
        return;
      }
      if (investment.maximumInvestment && customAmount > investment.maximumInvestment) {
        await alert(`Maximum investment amount is KSh ${investment.maximumInvestment.toLocaleString()}`);
        return;
      }
    }

    const shortfall = purchaseAmount - gameState.currentMoney;
    
    if (shortfall > 0) {
      // Offer loan option
      const loanAmount = Math.ceil(shortfall / 10000) * 10000; // Round up to nearest 10k
      const interestRate = 0.18; // 18% annual interest (typical Kenya bank rate)
      const termMonths = 12; // 1 year term
      const monthlyRate = interestRate / 12;
      const monthlyPayment = Math.round(
        (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1)
      );

      const confirmLoan = await confirm(
        `Insufficient funds! You need KSh ${shortfall.toLocaleString()} more.\n\n` +
        `Would you like to take a loan?\n` +
        `Loan Amount: KSh ${loanAmount.toLocaleString()}\n` +
        `Interest Rate: ${(interestRate * 100).toFixed(0)}% per year\n` +
        `Term: ${termMonths} months\n` +
        `Monthly Payment: KSh ${monthlyPayment.toLocaleString()}\n\n` +
        `Click Confirm to take the loan, or Cancel to cancel purchase.`,
        "Loan Required"
      );

      if (!confirmLoan) {
        return;
      }

      // Create loan (short-term loan for purchases)
      const newLoan: Loan = {
        id: Date.now(),
        type: "short_term",
        amount: loanAmount,
        interestRate: interestRate,
        termMonths: termMonths,
        startMonth: gameState.currentMonth,
        monthlyPayment: monthlyPayment,
        remainingBalance: loanAmount,
        purpose: `Purchase ${investment.name}`,
      };

      // For flexible amount investments, create a copy with adjusted values
      const adjustedInvestment: Investment = investment.isFlexibleAmount && customAmount
        ? {
            ...investment,
            initialCost: purchaseAmount,
            monthlyIncome: Math.round(investment.monthlyIncome * (purchaseAmount / investment.initialCost)),
            monthlyCashflow: Math.round(investment.monthlyCashflow * (purchaseAmount / investment.initialCost)),
            monthlyMaintenance: Math.round(investment.monthlyMaintenance * (purchaseAmount / investment.initialCost)),
          }
        : investment;

      const ownedInvestment: OwnedInvestment = {
        id: Date.now() + 1,
        investmentId: investment.id,
        investment: adjustedInvestment,
        purchaseMonth: gameState.currentMonth,
        purchaseCost: purchaseAmount,
        accruedIncome: 0,
        earlyCashflowTaken: false,
        currentValue: purchaseAmount, // Start with purchase cost
      };

      setGameState((prev) => {
        const newPortfolio = [...prev.portfolio, ownedInvestment];
        return {
          ...prev,
          currentMoney: prev.currentMoney + loanAmount - purchaseAmount,
          portfolio: newPortfolio,
          totalInvested: prev.totalInvested + purchaseAmount,
          loans: [...prev.loans, newLoan],
          totalDebt: prev.totalDebt + loanAmount,
          diversificationScore: calculateDiversificationScore(newPortfolio),
          portfolioRiskReduction: calculateRiskReduction(newPortfolio),
        };
      });
      return;
    }

    // Enough cash, purchase directly
    // For flexible amount investments, create a copy with adjusted values
    const adjustedInvestment: Investment = investment.isFlexibleAmount && customAmount
      ? {
          ...investment,
          initialCost: purchaseAmount,
          monthlyIncome: Math.round(investment.monthlyIncome * (purchaseAmount / investment.initialCost)),
          monthlyCashflow: Math.round(investment.monthlyCashflow * (purchaseAmount / investment.initialCost)),
          monthlyMaintenance: Math.round(investment.monthlyMaintenance * (purchaseAmount / investment.initialCost)),
        }
      : investment;

    const ownedInvestment: OwnedInvestment = {
      id: Date.now(),
      investmentId: investment.id,
      investment: adjustedInvestment,
      purchaseMonth: gameState.currentMonth,
      purchaseCost: purchaseAmount,
      accruedIncome: 0,
      earlyCashflowTaken: false,
      currentValue: purchaseAmount, // Start with purchase cost
    };

    setGameState((prev) => {
      const newPortfolio = [...prev.portfolio, ownedInvestment];
      return {
        ...prev,
        currentMoney: prev.currentMoney - purchaseAmount,
        portfolio: newPortfolio,
        totalInvested: prev.totalInvested + purchaseAmount,
        diversificationScore: calculateDiversificationScore(newPortfolio),
        portfolioRiskReduction: calculateRiskReduction(newPortfolio),
      };
    });
  };

  const handleCreateInvoice = (amount: number, clientName: string, paymentDueMonths: number) => {
    const invoiceNumber = `INV-${Date.now()}`;
    const newInvoice: Invoice = {
      id: Date.now(),
      invoiceNumber,
      clientName,
      amount,
      issueMonth: gameState.currentMonth,
      paymentDueMonth: gameState.currentMonth + paymentDueMonths,
      isDiscounted: false,
      status: "pending" as const,
    };

    setGameState((prev) => ({
      ...prev,
      invoices: [...prev.invoices, newInvoice],
    }));
  };

  const handleDiscountInvoice = (invoiceId: number, discountRate: number) => {
    setGameState((prev) => {
      const invoice = prev.invoices.find((inv) => inv.id === invoiceId);
      if (!invoice || invoice.isDiscounted) return prev;

      const discountedAmount = invoice.amount * (1 - discountRate);
      const newMoney = prev.currentMoney + discountedAmount;

      return {
        ...prev,
        currentMoney: newMoney,
        invoices: prev.invoices.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                isDiscounted: true,
                discountedAmount,
                discountRate,
                status: "discounted" as const,
              }
            : inv
        ),
        totalCashflow: prev.totalCashflow + discountedAmount,
      };
    });
  };

  const handleSellInvestment = (ownedInvestmentId: number) => {
    setGameState((prev) => {
      const owned = prev.portfolio.find((inv) => inv.id === ownedInvestmentId);
      if (!owned) return prev;

      const investment = owned.investment;
      const monthsSincePurchase = prev.currentMonth - owned.purchaseMonth;
      const monthsSinceSaleStart = owned.saleInitiatedMonth
        ? prev.currentMonth - owned.saleInitiatedMonth
        : 0;

      // Check if already selling and sale is complete
      if (owned.isSelling && monthsSinceSaleStart >= investment.exitTimeMonths) {
        // Sale completes - calculate proceeds using current value (with appreciation/depreciation)
        const salePrice = owned.currentValue || owned.purchaseCost; // Use current value, fallback to purchase cost
        const exitCost = Math.round(salePrice * investment.exitCostPercent);
        let proceeds = salePrice - exitCost;

        // Check for early exit penalty
        if (
          investment.lockInMonths &&
          monthsSincePurchase < investment.lockInMonths &&
          investment.earlyExitPenaltyPercent
        ) {
          const penalty = Math.round(salePrice * investment.earlyExitPenaltyPercent);
          proceeds -= penalty;
        }

        // Apply capital gains tax if applicable (note: monthlyTaxPaid is not available here, handled in advanceMonth)
        if (investment.capitalGainsTaxRate && !investment.isTaxExempt && investment.capitalGainsTaxRate > 0) {
          const capitalGain = Math.max(0, salePrice - owned.purchaseCost);
          const capitalGainsTax = Math.round(capitalGain * investment.capitalGainsTaxRate);
          proceeds -= capitalGainsTax;
        }

        // Remove from portfolio and add proceeds
        const newPortfolio = prev.portfolio.filter((inv) => inv.id !== ownedInvestmentId);
        return {
          ...prev,
          currentMoney: prev.currentMoney + proceeds,
          portfolio: newPortfolio,
          totalCashflow: prev.totalCashflow + proceeds,
          diversificationScore: calculateDiversificationScore(newPortfolio),
          portfolioRiskReduction: calculateRiskReduction(newPortfolio),
        };
      }

      // Check if can sell (lock-in period)
      if (investment.lockInMonths && monthsSincePurchase < investment.lockInMonths) {
        const monthsRemaining = investment.lockInMonths - monthsSincePurchase;
        if (
          !confirm(
            `This investment has a ${investment.lockInMonths}-month lock-in period. You still have ${monthsRemaining} month(s) remaining. Selling now will incur a ${(investment.earlyExitPenaltyPercent || 0) * 100}% penalty. Continue?`
          )
        ) {
          return prev;
        }
      }

      // Initiate sale
      return {
        ...prev,
        portfolio: prev.portfolio.map((inv) =>
          inv.id === ownedInvestmentId
            ? { ...inv, isSelling: true, saleInitiatedMonth: prev.currentMonth }
            : inv
        ),
      };
    });
  };

  const handleBorrow = (loanData: Omit<Loan, "id" | "startMonth">) => {
    setGameState((prev) => {
      if (prev.gameOver) return prev; // Can't borrow if game is over
      
      const newLoan: Loan = {
        ...loanData,
        id: Date.now(),
        startMonth: prev.currentMonth,
      };

      return {
        ...prev,
        currentMoney: prev.currentMoney + loanData.amount,
        loans: [...prev.loans, newLoan],
        totalDebt: prev.totalDebt + loanData.amount,
      };
    });
  };

  const handleAddExpense = (expense: Omit<Expense, "id">) => {
    setGameState((prev) => {
      const newExpense: Expense = {
        ...expense,
        id: Date.now(),
      };
      const totalExpenses = [...prev.expenses, newExpense]
        .filter((e) => e.isActive)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        ...prev,
        expenses: [...prev.expenses, newExpense],
        totalExpenses,
      };
    });
  };

  const handleUpdateExpense = (id: number, updates: Partial<Expense>) => {
    setGameState((prev) => {
      const updatedExpenses = prev.expenses.map((exp) =>
        exp.id === id ? { ...exp, ...updates } : exp
      );
      const totalExpenses = updatedExpenses
        .filter((e) => e.isActive)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        ...prev,
        expenses: updatedExpenses,
        totalExpenses,
      };
    });
  };

  const handleDeleteExpense = (id: number) => {
    setGameState((prev) => {
      const updatedExpenses = prev.expenses.filter((exp) => exp.id !== id);
      const totalExpenses = updatedExpenses
        .filter((e) => e.isActive)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        ...prev,
        expenses: updatedExpenses,
        totalExpenses,
      };
    });
  };

  const handleExtendInvestment = async (ownedInvestmentId: number, topUpAmount: number) => {
    const owned = gameState.portfolio.find((inv) => inv.id === ownedInvestmentId);
    if (!owned || !owned.investment.isExtendable) return;

    const investment = owned.investment;
    
    // Validate top-up amount
    if (investment.minimumTopUp && topUpAmount < investment.minimumTopUp) {
      await alert(`Minimum top-up amount is KSh ${investment.minimumTopUp.toLocaleString()}`);
      return;
    }

    if (topUpAmount > gameState.currentMoney) {
      await alert("Insufficient funds for this top-up");
      return;
    }

    setGameState((prev) => {

      // Calculate new values
      const newPurchaseCost = owned.purchaseCost + topUpAmount;
      const newCurrentValue = (owned.currentValue || owned.purchaseCost) + topUpAmount;
      
      // Store old values before extension (for use in current month)
      const oldMonthlyIncome = investment.monthlyIncome;
      const oldMonthlyCashflow = investment.monthlyCashflow;
      const oldMonthlyMaintenance = investment.monthlyMaintenance;
      
      // Update income and cashflow proportionally
      const multiplier = newPurchaseCost / owned.purchaseCost;
      const newMonthlyIncome = Math.round(investment.monthlyIncome * multiplier);
      const newMonthlyCashflow = Math.round(investment.monthlyCashflow * multiplier);
      const newMonthlyMaintenance = Math.round(investment.monthlyMaintenance * multiplier);

      // Create updated investment with new values
      const updatedInvestment: Investment = {
        ...investment,
        initialCost: newPurchaseCost,
        monthlyIncome: newMonthlyIncome,
        monthlyCashflow: newMonthlyCashflow,
        monthlyMaintenance: newMonthlyMaintenance,
      };

      return {
        ...prev,
        currentMoney: prev.currentMoney - topUpAmount,
        portfolio: prev.portfolio.map((inv) =>
          inv.id === ownedInvestmentId
            ? {
                ...inv,
                purchaseCost: newPurchaseCost,
                currentValue: newCurrentValue,
                investment: updatedInvestment,
                // Store extension info so new values only apply from next month
                lastExtensionMonth: prev.currentMonth,
                monthlyIncomeBeforeExtension: oldMonthlyIncome,
                monthlyCashflowBeforeExtension: oldMonthlyCashflow,
                monthlyMaintenanceBeforeExtension: oldMonthlyMaintenance,
              }
            : inv
        ),
        totalInvested: prev.totalInvested + topUpAmount,
        diversificationScore: calculateDiversificationScore(
          prev.portfolio.map((inv) =>
            inv.id === ownedInvestmentId
              ? { ...inv, investment: updatedInvestment }
              : inv
          )
        ),
        portfolioRiskReduction: calculateRiskReduction(
          prev.portfolio.map((inv) =>
            inv.id === ownedInvestmentId
              ? { ...inv, investment: updatedInvestment }
              : inv
          )
        ),
      };
    });
  };

  const handleEarlyCashflow = (ownedInvestmentId: number) => {
    setGameState((prev) => {
      const owned = prev.portfolio.find((inv) => inv.id === ownedInvestmentId);
      if (!owned || owned.earlyCashflowTaken || !owned.investment.earlyCashflowDiscount?.available) {
        return prev;
      }

      const discount = owned.investment.earlyCashflowDiscount;
      const newMoney = prev.currentMoney + discount.immediateCashflow;

      return {
        ...prev,
        currentMoney: newMoney,
        portfolio: prev.portfolio.map((inv) =>
          inv.id === ownedInvestmentId
            ? { ...inv, earlyCashflowTaken: true }
            : inv
        ),
        totalCashflow: prev.totalCashflow + discount.immediateCashflow,
      };
    });
  };

  const handleAdvanceMonth = () => {
    setGameState((prev) => {
      const newMonth = prev.currentMonth + 1;
      let newMoney = prev.currentMoney;
      let totalIncomeThisMonth = 0;
      let totalCashflowThisMonth = 0;
      let newAccruedIncome = 0;
      let monthlyTaxPaid = 0;
      let monthlyOpportunityCost = 0;

      // Update market condition (economic cycles)
      let newMarketCondition = prev.marketCondition;
      const marketChangeChance = 0.15; // 15% chance of market condition change per month
      
      if (Math.random() < marketChangeChance) {
        // Market condition transitions
        const transitions: Record<MarketCondition, MarketCondition[]> = {
          boom: ["normal", "recession"], // Boom can go to normal or recession
          normal: ["boom", "recession"], // Normal can go to boom or recession
          recession: ["normal", "depression"], // Recession can go to normal or depression
          depression: ["recession", "normal"], // Depression can recover to recession or normal
        };
        
        const possibleTransitions = transitions[prev.marketCondition];
        newMarketCondition = possibleTransitions[Math.floor(Math.random() * possibleTransitions.length)];
      }

      // Market multipliers
      const marketMultipliers: Record<MarketCondition, number> = {
        boom: 1.2, // 20% boost
        normal: 1.0, // Normal
        recession: 0.85, // 15% reduction
        depression: 0.7, // 30% reduction
      };

      const marketMultiplier = marketMultipliers[newMarketCondition];
      const marketHistory = [...prev.marketHistory, { condition: newMarketCondition, month: newMonth, multiplier: marketMultiplier }];

      // Get current month (0-11) for seasonality
      const currentDate = getDateFromMonth(prev.startDate, newMonth);
      const currentMonthIndex = currentDate.getMonth(); // 0-11

      // Process unexpected events and investments
      let newEvents: UnexpectedEvent[] = [];
      let eventIdCounter = prev.unexpectedEvents.length;
      
      // Calculate opportunity cost for locked-in capital
      // Opportunity cost = capital tied up * opportunity rate (e.g., 12% annual = 1% monthly)
      const opportunityRate = 0.12 / 12; // 12% annual = 1% monthly

      const updatedPortfolio = prev.portfolio.map((owned) => {
        const monthsSincePurchase = newMonth - owned.purchaseMonth;
        const investment = owned.investment;
        let newAccrued = owned.accruedIncome;
        let activeEvents = owned.activeEvents || [];
        let eventIncomeLoss = 0;
        let eventCashflowLoss = 0;
        let eventAdditionalCost = 0;
        
        // Calculate opportunity cost for this investment
        if (investment.lockInMonths && monthsSincePurchase < investment.lockInMonths) {
          // Capital is locked in - calculate opportunity cost
          const lockedCapital = owned.purchaseCost;
          const opportunityCostThisMonth = Math.round(lockedCapital * opportunityRate);
          monthlyOpportunityCost += opportunityCostThisMonth;
        } else if (investment.liquidity === "low" || investment.liquidity === "illiquid") {
          // Low liquidity investments have opportunity cost (harder to exit)
          const tiedUpCapital = owned.purchaseCost;
          const liquidityPenalty = investment.liquidity === "illiquid" ? 0.015 : 0.01; // 1.5% for illiquid, 1% for low
          const opportunityCostThisMonth = Math.round(tiedUpCapital * liquidityPenalty);
          monthlyOpportunityCost += opportunityCostThisMonth;
        }

        // Use old values if extension happened in the month we're advancing to (new values apply from next month)
        // Calculate base values early so we can use them in event calculations
        const baseMonthlyIncomeForEvents = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === newMonth && owned.monthlyIncomeBeforeExtension !== undefined)
          ? owned.monthlyIncomeBeforeExtension
          : investment.monthlyIncome;
        const baseMonthlyCashflowForEvents = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === newMonth && owned.monthlyCashflowBeforeExtension !== undefined)
          ? owned.monthlyCashflowBeforeExtension
          : investment.monthlyCashflow;
        const maintenanceForEvents = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === newMonth && owned.monthlyMaintenanceBeforeExtension !== undefined)
          ? owned.monthlyMaintenanceBeforeExtension
          : investment.monthlyMaintenance;

        // Check for new unexpected events
        if (investment.eventProbabilities && monthsSincePurchase > 0) {
          const probs = investment.eventProbabilities;
          
          // Vacancy (for properties)
          if (probs.vacancy && (investment.type === "flat" || investment.type === "shop") && Math.random() < probs.vacancy) {
            const event: UnexpectedEvent = {
              id: eventIdCounter++,
              type: "vacancy",
              investmentId: owned.id,
              month: newMonth,
              description: `${investment.name} is vacant - no rental income this month`,
              incomeLoss: baseMonthlyIncomeForEvents,
              cashflowLoss: baseMonthlyCashflowForEvents,
              durationMonths: Math.floor(Math.random() * 2) + 1, // 1-2 months
              resolved: false,
            };
            newEvents.push(event);
            activeEvents.push(event);
            eventIncomeLoss += event.incomeLoss;
            eventCashflowLoss += event.cashflowLoss;
          }
          
          // Breakdown (for vehicles)
          if (probs.breakdown && investment.type === "matatu" && Math.random() < probs.breakdown) {
            const repairCost = Math.round(investment.initialCost * (0.05 + Math.random() * 0.10)); // 5-15% of vehicle cost
            const event: UnexpectedEvent = {
              id: eventIdCounter++,
              type: "breakdown",
              investmentId: owned.id,
              month: newMonth,
              description: `${investment.name} broke down - needs repair`,
              incomeLoss: baseMonthlyIncomeForEvents,
              cashflowLoss: baseMonthlyCashflowForEvents,
              additionalCost: repairCost,
              durationMonths: Math.floor(Math.random() * 2) + 1, // 1-2 months
              resolved: false,
            };
            newEvents.push(event);
            activeEvents.push(event);
            eventIncomeLoss += event.incomeLoss;
            eventCashflowLoss += event.cashflowLoss;
            eventAdditionalCost += event.additionalCost || 0;
          }
          
          // Maintenance surprise
          if (probs.maintenanceSurprise && Math.random() < probs.maintenanceSurprise) {
            const surpriseCost = Math.round(maintenanceForEvents * (2 + Math.random() * 3)); // 2-5x normal maintenance
            const event: UnexpectedEvent = {
              id: eventIdCounter++,
              type: "maintenance_surprise",
              investmentId: owned.id,
              month: newMonth,
              description: `${investment.name} requires unexpected maintenance`,
              incomeLoss: 0,
              cashflowLoss: 0,
              additionalCost: surpriseCost,
              durationMonths: 0, // One-time
              resolved: false,
            };
            newEvents.push(event);
            activeEvents.push(event);
            eventAdditionalCost += surpriseCost;
          }
        }

        // Resolve ongoing events
        activeEvents = activeEvents.map((event) => {
          if (event.resolved) return event;
          const monthsSinceEvent = newMonth - event.month;
          if (event.durationMonths && monthsSinceEvent >= event.durationMonths) {
            return { ...event, resolved: true };
          }
          // Apply event effects for ongoing events
          if (!event.resolved) {
            eventIncomeLoss += event.incomeLoss;
            eventCashflowLoss += event.cashflowLoss;
            if (event.additionalCost && monthsSinceEvent === 0) {
              eventAdditionalCost += event.additionalCost;
            }
          }
          return event;
        }).filter((event) => !event.resolved || monthsSinceEvent < 3); // Keep resolved events for 3 months for history

        // Use old values if extension happened in the month we're advancing to (new values apply from next month)
        // If extension happened in previous month (newMonth - 1), use new values
        const baseMonthlyIncome = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === newMonth && owned.monthlyIncomeBeforeExtension !== undefined)
          ? owned.monthlyIncomeBeforeExtension
          : investment.monthlyIncome;
        const baseMonthlyCashflow = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === newMonth && owned.monthlyCashflowBeforeExtension !== undefined)
          ? owned.monthlyCashflowBeforeExtension
          : investment.monthlyCashflow;
        const baseMonthlyMaintenance = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === newMonth && owned.monthlyMaintenanceBeforeExtension !== undefined)
          ? owned.monthlyMaintenanceBeforeExtension
          : investment.monthlyMaintenance;

        // Calculate actual returns with volatility (varies each month)
        let actualIncome = baseMonthlyIncome;
        let actualCashflow = baseMonthlyCashflow;
        
        // Apply volatility if investment has volatility and has any returns (income or cashflow)
        if (investment.volatility > 0 && (baseMonthlyIncome > 0 || baseMonthlyCashflow > 0)) {
          // Apply volatility: returns vary by ±(volatility * 100)%
          // Reduced by portfolio diversification
          const riskReduction = prev.portfolioRiskReduction || 0;
          const adjustedVolatility = investment.volatility * (1 - riskReduction);
          // Generate random variation each month: -adjustedVolatility to +adjustedVolatility
          const variation = (Math.random() * 2 - 1) * adjustedVolatility; // -volatility to +volatility
          
          // Apply volatility to income if it exists
          if (baseMonthlyIncome > 0) {
            actualIncome = Math.max(0, Math.round(baseMonthlyIncome * (1 + variation)));
          }
          
          // Apply volatility to cashflow if it exists (use same variation for consistency)
          if (baseMonthlyCashflow > 0) {
            actualCashflow = Math.max(0, Math.round(baseMonthlyCashflow * (1 + variation)));
          }
        }

        // Apply market condition multiplier
        if (investment.marketSensitivity && investment.marketSensitivity > 0) {
          const marketEffect = 1 + (marketMultiplier - 1) * investment.marketSensitivity;
          actualIncome = Math.max(0, Math.round(actualIncome * marketEffect));
          actualCashflow = Math.max(0, Math.round(actualCashflow * marketEffect));
        }

        // Apply seasonality
        if (investment.seasonality && investment.monthlyIncome > 0) {
          const { highSeasonMonths, lowSeasonMonths, highSeasonMultiplier, lowSeasonMultiplier } = investment.seasonality;
          let seasonMultiplier = 1.0;
          
          if (highSeasonMonths.includes(currentMonthIndex)) {
            seasonMultiplier = highSeasonMultiplier;
          } else if (lowSeasonMonths.includes(currentMonthIndex)) {
            seasonMultiplier = lowSeasonMultiplier;
          }
          
          actualIncome = Math.max(0, Math.round(actualIncome * seasonMultiplier));
          actualCashflow = Math.max(0, Math.round(actualCashflow * seasonMultiplier));
        }

        // Apply event losses
        actualIncome = Math.max(0, actualIncome - eventIncomeLoss);
        actualCashflow = Math.max(0, actualCashflow - eventCashflowLoss);
        
        // Apply additional costs
        if (eventAdditionalCost > 0) {
          newMoney -= eventAdditionalCost;
          totalCashflowThisMonth -= eventAdditionalCost;
        }

        // Recognize income (profit) - with volatility
        if (monthsSincePurchase > investment.incomeDelayMonths && actualIncome > 0) {
          totalIncomeThisMonth += actualIncome;
          newAccrued += actualIncome;
        }

        // Receive cashflow (actual cash) - with volatility and taxes
        // For fixed deposits, pay principal + interest at maturity
        if (investment.type === "fixed_deposit" && monthsSincePurchase === investment.cashflowDelayMonths) {
          // Fixed deposit matures - return principal + interest
          const annualRate = 0.12; // 12% annual interest
          const totalInterest = Math.round(owned.purchaseCost * annualRate);
          let afterTaxInterest = totalInterest;
          
          // Apply income tax on interest
          if (investment.incomeTaxRate && !investment.isTaxExempt && investment.incomeTaxRate > 0) {
            const taxAmount = Math.round(totalInterest * investment.incomeTaxRate);
            // totalInterest is already an integer, and taxAmount is an integer, so subtraction is already an integer
            afterTaxInterest = totalInterest - taxAmount;
            monthlyTaxPaid += taxAmount;
          }
          
          // Both purchaseCost and afterTaxInterest are integers, so sum is already an integer
          const totalPayout = owned.purchaseCost + afterTaxInterest;
          newMoney += totalPayout;
          totalCashflowThisMonth += totalPayout;
          newAccrued -= totalInterest; // Reduce accrued by gross interest
        } else if (
          monthsSincePurchase > investment.cashflowDelayMonths &&
          actualCashflow > 0 &&
          !owned.earlyCashflowTaken
        ) {
          // Apply income tax if applicable
          let afterTaxCashflow = actualCashflow;
          if (investment.incomeTaxRate && !investment.isTaxExempt && investment.incomeTaxRate > 0) {
            const taxAmount = Math.round(actualCashflow * investment.incomeTaxRate);
            // actualCashflow is already an integer, and taxAmount is an integer, so subtraction is already an integer
            // No need to round again - this ensures taxAmount + afterTaxCashflow = actualCashflow exactly
            afterTaxCashflow = actualCashflow - taxAmount;
            monthlyTaxPaid += taxAmount;
            // Tax is deducted from cash received
          }

          newMoney += afterTaxCashflow;
          totalCashflowThisMonth += afterTaxCashflow;
          newAccrued -= actualCashflow; // Reduce accrued by gross amount
        }

        // Apply maintenance costs (immediate cash outflow)
        // Use old maintenance value if extension happened in current month
        const maintenanceToApply = (owned.lastExtensionMonth !== undefined && owned.lastExtensionMonth === newMonth && owned.monthlyMaintenanceBeforeExtension !== undefined)
          ? owned.monthlyMaintenanceBeforeExtension
          : baseMonthlyMaintenance;
        
        if (maintenanceToApply > 0 && monthsSincePurchase > 0) {
          newMoney -= maintenanceToApply;
          totalCashflowThisMonth -= maintenanceToApply;
        }

        // Calculate current value with appreciation/depreciation
        let currentValue = owned.currentValue || owned.purchaseCost;
        if (monthsSincePurchase > 0) {
          if (investment.appreciationRate && investment.appreciationRate > 0) {
            // Appreciation compounds monthly
            const monthlyAppreciation = investment.appreciationRate / 12;
            currentValue = Math.round(owned.purchaseCost * Math.pow(1 + monthlyAppreciation, monthsSincePurchase));
          } else if (investment.depreciationRate && investment.depreciationRate > 0) {
            // Depreciation compounds monthly
            const monthlyDepreciation = investment.depreciationRate / 12;
            currentValue = Math.round(owned.purchaseCost * Math.pow(1 - monthlyDepreciation, monthsSincePurchase));
            currentValue = Math.max(0, currentValue); // Can't go below 0
          }
        }

        return {
          ...owned,
          accruedIncome: Math.max(0, newAccrued),
          currentMonthIncome: actualIncome,
          currentMonthCashflow: actualCashflow,
          activeEvents: activeEvents,
          currentValue: currentValue,
        };
      });

      // Process market crash (affects all investments)
      const marketCrashChance = 0.01; // 1% chance per month
      let marketCrashActive = false;
      if (Math.random() < marketCrashChance) {
        marketCrashActive = true;
        const crashEvent: UnexpectedEvent = {
          id: eventIdCounter++,
          type: "market_crash",
          investmentId: -1, // Affects all
          month: newMonth,
          description: "Market crash - all investments lose 20% income this month",
          incomeLoss: 0, // Calculated per investment
          cashflowLoss: 0,
          durationMonths: 1,
          resolved: false,
        };
        newEvents.push(crashEvent);
        
        // Apply market crash to all investments
        updatedPortfolio.forEach((owned) => {
          if (owned.investment.monthlyIncome > 0) {
            const crashLoss = Math.round(owned.investment.monthlyIncome * 0.2);
            totalIncomeThisMonth -= crashLoss;
            // Reduce actual income/cashflow for this month
            if (owned.currentMonthIncome) {
              owned.currentMonthIncome = Math.max(0, owned.currentMonthIncome - crashLoss);
            }
            if (owned.currentMonthCashflow) {
              owned.currentMonthCashflow = Math.max(0, owned.currentMonthCashflow - crashLoss);
            }
          }
        });
      }

      // Process loan payments
      const updatedLoans = prev.loans
        .map((loan) => {
          const monthsSinceLoan = newMonth - loan.startMonth;
          
          // Handle overdraft differently (no fixed term, interest only)
          if (loan.type === "overdraft") {
            // Overdraft: pay interest only (minimum payment)
            const monthlyRate = loan.interestRate / 12;
            const interestPayment = Math.round(loan.remainingBalance * monthlyRate);
            
            // Deduct interest payment from cash
            newMoney -= interestPayment;
            totalCashflowThisMonth -= interestPayment;
            
            // Balance remains the same (no principal payment required, but can pay more)
            return {
              ...loan,
              remainingBalance: loan.remainingBalance, // Can be paid down manually
            };
          }
          
          // Fixed-term loans (short-term, long-term)
          if (loan.termMonths > 0 && monthsSinceLoan >= loan.termMonths) {
            // Loan fully paid
            return null;
          }

          // Calculate monthly interest and principal payment
          const monthlyRate = loan.interestRate / 12;
          const interestPayment = Math.round(loan.remainingBalance * monthlyRate);
          const principalPayment = loan.monthlyPayment - interestPayment;
          const newBalance = Math.max(0, loan.remainingBalance - principalPayment);

          // Deduct payment from cash
          newMoney -= loan.monthlyPayment;
          totalCashflowThisMonth -= loan.monthlyPayment;

          return {
            ...loan,
            remainingBalance: newBalance,
          };
        })
        .filter((loan): loan is Loan => loan !== null);

      const newTotalDebt = updatedLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);

      // Process invoices
      const updatedInvoices: Invoice[] = prev.invoices.map((invoice): Invoice => {
        if (invoice.status === "paid" || invoice.status === "discounted") {
          return invoice;
        }

        if (newMonth >= invoice.paymentDueMonth) {
          if (!invoice.isDiscounted) {
            // Invoice is paid
            newMoney += invoice.amount;
            totalCashflowThisMonth += invoice.amount;
            totalIncomeThisMonth += invoice.amount;
            return { ...invoice, status: "paid" as const };
          }
        } else if (newMonth > invoice.paymentDueMonth + 1) {
          return { ...invoice, status: "overdue" as const };
        }

        return invoice;
      });

      // Calculate total accrued income
      newAccruedIncome = updatedPortfolio.reduce((sum, owned) => sum + owned.accruedIncome, 0);

      // Process monthly expenses (deduct active expenses)
      const monthlyExpenses = prev.expenses
        .filter((exp) => exp.isActive)
        .reduce((sum, exp) => sum + exp.amount, 0);
      newMoney -= monthlyExpenses;
      totalCashflowThisMonth -= monthlyExpenses;

      // Process contingent liabilities (occasional unexpected expenses)
      // 3% chance per month of a contingent liability
      const contingentLiabilityChance = 0.03;
      let newContingentLiability: ContingentLiability | null = null;
      
      if (Math.random() < contingentLiabilityChance) {
        const liabilityTypes: Array<{ type: ContingentLiabilityType; description: string; minAmount: number; maxAmount: number }> = [
          { type: "medical_emergency", description: "Medical emergency", minAmount: 5000, maxAmount: 50000 },
          { type: "car_repair", description: "Car repair", minAmount: 3000, maxAmount: 30000 },
          { type: "home_repair", description: "Home repair", minAmount: 5000, maxAmount: 40000 },
          { type: "legal_fee", description: "Legal fees", minAmount: 10000, maxAmount: 100000 },
          { type: "family_emergency", description: "Family emergency", minAmount: 5000, maxAmount: 50000 },
          { type: "other", description: "Unexpected expense", minAmount: 2000, maxAmount: 20000 },
        ];
        
        const randomType = liabilityTypes[Math.floor(Math.random() * liabilityTypes.length)];
        const amount = Math.round(
          randomType.minAmount + Math.random() * (randomType.maxAmount - randomType.minAmount)
        );
        
        newContingentLiability = {
          id: Date.now(),
          type: randomType.type,
          description: randomType.description,
          amount,
          month: newMonth,
          isPaid: false,
        };
        
        // Deduct immediately (contingent liabilities must be paid)
        newMoney -= amount;
        totalCashflowThisMonth -= amount;
      }

      const updatedContingentLiabilities = newContingentLiability
        ? [...prev.contingentLiabilities, newContingentLiability]
        : prev.contingentLiabilities;
      const totalContingentLiabilities = updatedContingentLiabilities
        .filter((liability) => !liability.isPaid)
        .reduce((sum, liability) => sum + liability.amount, 0);

      // Calculate net cashflow for this month (after all transactions)
      const netCashflowThisMonth = totalCashflowThisMonth;
      
      // Update cashflow history (keep last 12 months)
      const newCashflowHistory = [...prev.cashflowHistory, netCashflowThisMonth].slice(-12);

      // Check for game over: negative cashflow and no borrowing options available
      let gameOver = prev.gameOver;
      let gameOverReason = prev.gameOverReason;
      
      if (!gameOver && newMoney < 0 && netCashflowThisMonth < 0) {
        // Check if user has any borrowing options
        const averageCashflow = newCashflowHistory.length > 0
          ? newCashflowHistory.reduce((sum, cf) => sum + cf, 0) / newCashflowHistory.length
          : 0;
        const hasQualifiedBorrowing = newCashflowHistory.length >= 3 && averageCashflow >= 10000;
        
        if (!hasQualifiedBorrowing) {
          gameOver = true;
          gameOverReason = `Game Over: Negative cashflow (KSh ${Math.abs(netCashflowThisMonth).toLocaleString()}) and insufficient cashflow history to qualify for borrowing.`;
        }
      }

      return {
        ...prev,
        currentMonth: newMonth,
        currentMoney: newMoney,
        portfolio: updatedPortfolio,
        invoices: updatedInvoices,
        totalIncome: prev.totalIncome + totalIncomeThisMonth,
        totalCashflow: prev.totalCashflow + totalCashflowThisMonth,
        accruedIncome: newAccruedIncome,
        unexpectedEvents: [...prev.unexpectedEvents, ...newEvents],
        marketCondition: newMarketCondition,
        marketHistory: marketHistory,
        loans: updatedLoans,
        totalDebt: newTotalDebt,
        totalTaxPaid: prev.totalTaxPaid + monthlyTaxPaid,
        monthlyTaxPaid: monthlyTaxPaid,
        diversificationScore: calculateDiversificationScore(updatedPortfolio),
        portfolioRiskReduction: calculateRiskReduction(updatedPortfolio),
        totalOpportunityCost: prev.totalOpportunityCost + monthlyOpportunityCost,
        monthlyOpportunityCost: monthlyOpportunityCost,
        cashflowHistory: newCashflowHistory,
        gameOver: gameOver,
        gameOverReason: gameOverReason,
        totalExpenses: monthlyExpenses,
        contingentLiabilities: updatedContingentLiabilities,
        totalContingentLiabilities: totalContingentLiabilities,
      };
    });
  };

  const handleStartDateChange = (date: Date | null) => {
    if (date) {
      setGameState((prev) => ({
        ...prev,
        startDate: date,
        currentMonth: 0, // Reset to month 0 when changing start date
      }));
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm(
      "Are you sure you want to reset the game? All progress will be lost.",
      "Reset Game"
    );
    if (confirmed) {
      clearGame(); // Clear saved game from localStorage
      setGameState({
        currentMoney: INITIAL_MONEY,
        portfolio: [],
        invoices: [],
        currentMonth: 0,
        startDate: new Date(),
        totalInvested: 0,
        totalIncome: 0,
        totalCashflow: 0,
        accruedIncome: 0,
        unexpectedEvents: [],
        marketCondition: "normal",
        marketHistory: [{ condition: "normal", month: 0, multiplier: 1.0 }],
        loans: [],
        totalDebt: 0,
        totalTaxPaid: 0,
        monthlyTaxPaid: 0,
        diversificationScore: 0,
        portfolioRiskReduction: 0,
        totalOpportunityCost: 0,
        monthlyOpportunityCost: 0,
        cashflowHistory: [],
        gameOver: false,
        expenses: [],
        totalExpenses: 0,
        contingentLiabilities: [],
        totalContingentLiabilities: 0,
      });
      setGeneratedInvestments([]);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isLoggedIn={isAuthenticated}
      />
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"
        }`}
      >
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Investment Game
              </h1>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Learn investment strategy - Income vs Cashflow timing
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:mr-2">
                  Start Date:
                </label>
                <DatePicker
                  selected={gameState.startDate}
                  onChange={handleStartDateChange}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-48"
                  popperPlacement="bottom-start"
                />
              </div>
              <button
                onClick={handleReset}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Reset Game
              </button>
            </div>
          </div>

          {/* Current Date Display */}
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Current Date</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatMonthYear(currentDate)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Month {gameState.currentMonth} from start
                </div>
              </div>
            </div>
          </div>

          {/* Game Over Display */}
          {gameState.gameOver && (
            <div className="mb-6 rounded-xl border border-red-500 bg-red-50 p-6 shadow-lg dark:border-red-800 dark:bg-red-900/30">
              <div className="flex items-center gap-3">
                <span className="text-4xl">💀</span>
                <div>
                  <h2 className="text-2xl font-bold text-red-900 dark:text-red-100">Game Over</h2>
                  <p className="mt-1 text-red-700 dark:text-red-300">
                    {gameState.gameOverReason || "Your cashflow went negative and you don't qualify for borrowing."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Game Stats */}
          <GameStats gameState={gameState} currentDate={currentDate} />

          {/* Expenses Manager */}
          {!gameState.gameOver && (
            <div className="mb-6">
              <ExpensesManager
                expenses={gameState.expenses}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            </div>
          )}

          {/* Borrowing Manager */}
          {!gameState.gameOver && (
            <div className="mb-6">
              <BorrowingManager
                currentMoney={gameState.currentMoney}
                cashflowHistory={gameState.cashflowHistory}
                currentMonth={gameState.currentMonth}
                existingLoans={gameState.loans}
                onBorrow={handleBorrow}
              />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Investment Opportunities */}
            <div className="lg:col-span-2">
              {/* Investment Generator */}
              <InvestmentGenerator
                onGenerate={handleGenerateInvestments}
                existingInvestmentIds={existingInvestmentIds}
              />

              <div className="mb-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Investment Opportunities
                  </h2>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {availableOpportunities.length} available
                  </span>
                </div>
                {availableOpportunities.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {availableOpportunities.map((opportunity) => (
                      <InvestmentOpportunityCard
                        key={opportunity.id}
                        investment={opportunity}
                        availableMoney={gameState.currentMoney}
                        onPurchase={(customAmount) => handlePurchase(opportunity, customAmount)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-zinc-600 dark:text-zinc-400">
                      No investment opportunities available. Generate new opportunities to continue!
                    </p>
                  </div>
                )}
              </div>

              {/* Invoice Manager */}
              <InvoiceManager
                invoices={gameState.invoices}
                currentMonth={gameState.currentMonth}
                startDate={gameState.startDate}
                onCreateInvoice={handleCreateInvoice}
                onDiscountInvoice={handleDiscountInvoice}
              />

              {/* Portfolio Display */}
              <PortfolioDisplay
                portfolio={gameState.portfolio}
                currentMonth={gameState.currentMonth}
                startDate={gameState.startDate}
                onEarlyCashflow={handleEarlyCashflow}
                onSellInvestment={handleSellInvestment}
                onExtendInvestment={handleExtendInvestment}
              />

              <LoanManager
                loans={gameState.loans}
                currentMonth={gameState.currentMonth}
                startDate={gameState.startDate}
              />
            </div>

            {/* Right Column - Cashflow Timeline */}
            <div className="lg:col-span-1">
              <CashflowTimeline
                portfolio={gameState.portfolio}
                invoices={gameState.invoices}
                currentMonth={gameState.currentMonth}
                startDate={gameState.startDate}
                onAdvanceMonth={handleAdvanceMonth}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function GamePage() {
  return (
    <DialogProvider>
      <GamePageContent />
    </DialogProvider>
  );
}
