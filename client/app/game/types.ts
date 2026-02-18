export type RiskLevel = "low" | "medium" | "high";
export type LiquidityLevel = "high" | "medium" | "low" | "illiquid";
export type ExpenseCategory = "rent" | "food" | "school_fees" | "fuel" | "utilities" | "other";
export type ContingentLiabilityType = "medical_emergency" | "car_repair" | "home_repair" | "legal_fee" | "family_emergency" | "other";

export type UnexpectedEventType = "vacancy" | "breakdown" | "market_crash" | "default" | "maintenance_surprise";

export interface UnexpectedEvent {
  id: number;
  type: UnexpectedEventType;
  investmentId: number;
  month: number;
  description: string;
  incomeLoss: number; // Income lost this month
  cashflowLoss: number; // Cashflow lost this month
  additionalCost?: number; // Extra cost (e.g., repairs)
  durationMonths?: number; // How long the event lasts (0 = one-time)
  resolved: boolean;
}

export interface Investment {
  id: number;
  name: string;
  type: "land" | "flat" | "mmf" | "matatu" | "shop" | "sacco" | "consulting" | "invoice" | "fixed_deposit" | "stocks";
  description: string;
  initialCost: number;
  monthlyMaintenance: number;
  monthlyIncome: number; // Base income earned (profit) - can vary
  monthlyCashflow: number; // Base cash received - can vary
  incomeDelayMonths: number; // When income is recognized
  cashflowDelayMonths: number; // When cash is actually received
  icon: string;
  isAppreciationOnly?: boolean;
  // Risk and volatility
  riskLevel: RiskLevel; // Low, medium, or high risk
  volatility: number; // 0-1, percentage variation in returns (0 = stable, 1 = very volatile)
  // Unexpected events probabilities (per month, 0-1)
  eventProbabilities?: {
    vacancy?: number; // For properties (0.05 = 5% chance per month)
    breakdown?: number; // For vehicles (0.08 = 8% chance per month)
    marketCrash?: number; // For all investments (0.01 = 1% chance per month)
    default?: number; // For invoices/rentals (0.03 = 3% chance per month)
    maintenanceSurprise?: number; // Unexpected maintenance (0.05 = 5% chance per month)
  };
  // For early cashflow discount option
  earlyCashflowDiscount?: {
    available: boolean;
    discountRate: number; // e.g., 0.15 = 15% discount
    immediateCashflow: number; // Cash received immediately if discounted
  };
  // Liquidity and exit properties
  liquidity: LiquidityLevel; // How easy to sell
  exitCostPercent: number; // Transaction fees as % of sale price (e.g., 0.05 = 5%)
  exitTimeMonths: number; // How long it takes to sell (0 = immediate)
  lockInMonths?: number; // Minimum holding period before can sell (0 = no lock-in)
  earlyExitPenaltyPercent?: number; // Penalty if sold before lock-in expires
  // Market and seasonality
  marketSensitivity?: number; // 0-1, how much market conditions affect returns
  seasonality?: {
    highSeasonMonths: number[]; // Months with high season (0-11)
    lowSeasonMonths: number[]; // Months with low season (0-11)
    highSeasonMultiplier: number; // Multiplier for high season (e.g., 1.2)
    lowSeasonMultiplier: number; // Multiplier for low season (e.g., 0.8)
  };
  // Tax properties
  incomeTaxRate?: number; // Tax rate on income (e.g., 0.15 = 15%)
  isTaxExempt?: boolean; // Whether investment is tax exempt
  capitalGainsTaxRate?: number; // Tax rate on capital gains (e.g., 0.05 = 5%)
  // Appreciation/Depreciation
  appreciationRate?: number; // Annual appreciation rate (e.g., 0.10 = 10%)
  depreciationRate?: number; // Annual depreciation rate (e.g., 0.15 = 15%)
  // Extension and flexible investment
  isExtendable?: boolean; // Can top up/extend this investment
  minimumTopUp?: number; // Minimum top-up amount
  maximumTopUp?: number; // Maximum top-up amount
  isFlexibleAmount?: boolean; // User can specify custom investment amount
  minimumInvestment?: number; // Minimum investment amount
  maximumInvestment?: number; // Maximum investment amount
  // Correlation for diversification
  correlationGroup?: string; // Investments in same group are correlated
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number; // Full invoice amount
  issueMonth: number;
  paymentDueMonth: number; // When payment is due
  isDiscounted: boolean;
  discountedAmount?: number; // Amount received if discounted
  discountRate?: number;
  status: "pending" | "discounted" | "paid" | "overdue";
}

export interface OwnedInvestment {
  id: number;
  investmentId: number;
  investment: Investment;
  purchaseMonth: number;
  purchaseCost: number;
  // Track income earned but not yet received as cash
  accruedIncome: number;
  // Track if early cashflow discount was taken
  earlyCashflowTaken?: boolean;
  // Track current month's actual returns (after volatility)
  currentMonthIncome?: number;
  currentMonthCashflow?: number;
  // Track unexpected events
  activeEvents?: UnexpectedEvent[];
  // Track sale status
  saleInitiatedMonth?: number; // When sale was initiated
  isSelling?: boolean; // Currently in process of selling
  // Track current value (with appreciation/depreciation)
  currentValue?: number; // Current market value of the asset
  // Track when extension happened (to apply new values only from next month)
  lastExtensionMonth?: number; // Month when last extension occurred
  monthlyIncomeBeforeExtension?: number; // Original monthly income before extension
  monthlyCashflowBeforeExtension?: number; // Original monthly cashflow before extension
  monthlyMaintenanceBeforeExtension?: number; // Original monthly maintenance before extension
}

export type MarketCondition = "boom" | "normal" | "recession" | "depression";
export type Season = "high" | "normal" | "low";

export interface MarketCycle {
  condition: MarketCondition;
  month: number;
  multiplier: number; // How returns are affected (1.0 = normal, 1.2 = boom, 0.8 = recession)
}

export type LoanType = "overdraft" | "short_term" | "long_term";

export interface Loan {
  id: number;
  type: LoanType; // Type of loan
  amount: number; // Principal amount borrowed
  interestRate: number; // Annual interest rate (e.g., 0.15 = 15%)
  termMonths: number; // Loan term in months (0 for overdraft = unlimited until paid)
  startMonth: number; // Month when loan was taken
  monthlyPayment: number; // Monthly payment amount (minimum for overdraft)
  remainingBalance: number; // Remaining principal balance
  purpose?: string; // What the loan was used for
  maxAmount?: number; // Maximum overdraft limit (for overdraft type)
}

export interface GameState {
  currentMoney: number;
  portfolio: OwnedInvestment[];
  invoices: Invoice[];
  currentMonth: number; // Month offset from start date
  startDate: Date; // Actual start date of the game
  totalInvested: number;
  totalIncome: number; // Total income earned (profit)
  totalCashflow: number; // Total cash received
  accruedIncome: number; // Income earned but cash not yet received
  unexpectedEvents: UnexpectedEvent[]; // All events that occurred
  marketCondition: MarketCondition; // Current market condition
  marketHistory: MarketCycle[]; // History of market conditions
  loans: Loan[]; // Active loans
  totalDebt: number; // Total outstanding debt
  totalTaxPaid: number; // Total taxes paid so far
  monthlyTaxPaid: number; // Taxes paid this month
  diversificationScore: number; // 0-1, portfolio diversification level (1 = fully diversified)
  portfolioRiskReduction: number; // 0-1, risk reduction from diversification (e.g., 0.2 = 20% risk reduction)
  totalOpportunityCost: number; // Total opportunity cost from locked-in capital
  monthlyOpportunityCost: number; // Opportunity cost this month
  cashflowHistory: number[]; // Last 12 months of net cashflow (for loan qualification)
  gameOver: boolean; // Whether the game has ended
  gameOverReason?: string; // Reason for game over
  expenses: Expense[]; // Monthly recurring expenses
  totalExpenses: number; // Total monthly expenses
  contingentLiabilities: ContingentLiability[]; // Occasional unexpected expenses
  totalContingentLiabilities: number; // Total unpaid contingent liabilities
  monthlyCashIn: number; // Cash received this month
  monthlyCashOut: number; // Cash spent this month
  monthlyCashInBreakdown: Array<{ source: string; amount: number }>; // Breakdown of cash in
  monthlyCashOutBreakdown: Array<{ source: string; amount: number }>; // Breakdown of cash out
  previousMonthCashIn: number; // Cash received last month
  previousMonthCashOut: number; // Cash spent last month
}

export interface Expense {
  id: number;
  category: ExpenseCategory;
  name: string;
  amount: number; // Monthly amount
  isActive: boolean; // Whether this expense is currently active
  startMonth?: number; // When expense started (optional, for one-time expenses)
  endMonth?: number; // When expense ends (optional, for temporary expenses)
}

export interface ContingentLiability {
  id: number;
  type: ContingentLiabilityType;
  description: string;
  amount: number;
  month: number; // Month when it occurred
  isPaid: boolean; // Whether it has been paid
}

export interface CashflowEvent {
  month: number;
  source: string;
  income: number; // Income/profit recognized
  cashflow: number; // Actual cash received
  maintenance: number;
  netCashflow: number;
  type: "investment" | "invoice" | "discount";
}

