/**
 * Pool of ~100 investment type templates for Kenya.
 * Used by the generator to pick random opportunities; tracker ensures variety across generations.
 */

export type PoolTemplateType =
  | "flat"
  | "shop"
  | "land"
  | "matatu"
  | "mmf"
  | "sacco"
  | "stocks"
  | "fixed_deposit";

export interface InvestmentPoolTemplate {
  type: PoolTemplateType;
  name: string;
  icon: string;
  minCost: number;
  maxCost: number;
  annualROI: number;
  maintenanceRate?: number;
  riskLevel: "low" | "medium" | "high";
  volatility: number;
  eventProbabilities?: {
    vacancy?: number;
    breakdown?: number;
    default?: number;
    maintenanceSurprise?: number;
  };
  isAppreciationOnly?: boolean;
  canRent?: boolean;
  monthlyRentMin?: number;
  monthlyRentMax?: number;
}

const LOCATIONS = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Kitale", "Malindi",
  "Naivasha", "Nyeri", "Garissa", "Lamu", "Machakos", "Meru", "Kakamega", "Kisii",
];

export const INVESTMENT_POOL: InvestmentPoolTemplate[] = [
  // ---- REAL ESTATE / FLATS ----
  { type: "flat", name: "Residential Flat (2BR)", icon: "🏢", minCost: 3000000, maxCost: 8000000, annualROI: 0.06, maintenanceRate: 0.15, riskLevel: "medium", volatility: 0.15, eventProbabilities: { vacancy: 0.05, maintenanceSurprise: 0.03 } },
  { type: "flat", name: "Residential Flat (1BR)", icon: "🏠", minCost: 1500000, maxCost: 4000000, annualROI: 0.065, maintenanceRate: 0.14, riskLevel: "medium", volatility: 0.12, eventProbabilities: { vacancy: 0.06, maintenanceSurprise: 0.03 } },
  { type: "flat", name: "Rental House (3BR)", icon: "🏡", minCost: 6000000, maxCost: 12000000, annualROI: 0.055, maintenanceRate: 0.18, riskLevel: "medium", volatility: 0.14, eventProbabilities: { vacancy: 0.04, maintenanceSurprise: 0.04 } },
  { type: "flat", name: "Rental House (4BR)", icon: "🏘️", minCost: 10000000, maxCost: 20000000, annualROI: 0.05, maintenanceRate: 0.20, riskLevel: "medium", volatility: 0.12, eventProbabilities: { vacancy: 0.04, maintenanceSurprise: 0.05 } },
  { type: "flat", name: "Studio Apartment", icon: "🛏️", minCost: 1200000, maxCost: 3000000, annualROI: 0.07, maintenanceRate: 0.12, riskLevel: "medium", volatility: 0.18, eventProbabilities: { vacancy: 0.07, maintenanceSurprise: 0.02 } },
  { type: "flat", name: "Commercial Property", icon: "🏬", minCost: 5000000, maxCost: 15000000, annualROI: 0.08, maintenanceRate: 0.20, riskLevel: "medium", volatility: 0.18, eventProbabilities: { vacancy: 0.06, maintenanceSurprise: 0.04 } },
  { type: "flat", name: "Office Space", icon: "🏢", minCost: 4000000, maxCost: 12000000, annualROI: 0.075, maintenanceRate: 0.18, riskLevel: "medium", volatility: 0.16, eventProbabilities: { vacancy: 0.05, maintenanceSurprise: 0.03 } },
  { type: "flat", name: "Warehouse", icon: "📦", minCost: 8000000, maxCost: 25000000, annualROI: 0.065, maintenanceRate: 0.15, riskLevel: "medium", volatility: 0.14, eventProbabilities: { vacancy: 0.04, maintenanceSurprise: 0.04 } },
  { type: "flat", name: "Guest House", icon: "🛎️", minCost: 5000000, maxCost: 15000000, annualROI: 0.09, maintenanceRate: 0.22, riskLevel: "medium", volatility: 0.22, eventProbabilities: { vacancy: 0.08, maintenanceSurprise: 0.05 } },
  { type: "flat", name: "Serviced Apartments", icon: "🔑", minCost: 8000000, maxCost: 20000000, annualROI: 0.085, maintenanceRate: 0.25, riskLevel: "medium", volatility: 0.20, eventProbabilities: { vacancy: 0.06, maintenanceSurprise: 0.05 } },
  { type: "flat", name: "Student Hostel", icon: "🎓", minCost: 3000000, maxCost: 10000000, annualROI: 0.10, maintenanceRate: 0.20, riskLevel: "medium", volatility: 0.18, eventProbabilities: { vacancy: 0.05, maintenanceSurprise: 0.05 } },
  { type: "flat", name: "Penthouse", icon: "🌆", minCost: 15000000, maxCost: 50000000, annualROI: 0.045, maintenanceRate: 0.12, riskLevel: "low", volatility: 0.10, eventProbabilities: { vacancy: 0.03, maintenanceSurprise: 0.02 } },
  // ---- SHOPS / RETAIL ----
  { type: "shop", name: "Retail Shop (Purchase)", icon: "🏪", minCost: 500000, maxCost: 3000000, annualROI: 0.10, maintenanceRate: 0.15, riskLevel: "medium", volatility: 0.20, eventProbabilities: { vacancy: 0.08, default: 0.05, maintenanceSurprise: 0.04 }, canRent: true, monthlyRentMin: 20000, monthlyRentMax: 100000 },
  { type: "shop", name: "Market Stall", icon: "🛒", minCost: 200000, maxCost: 800000, annualROI: 0.12, maintenanceRate: 0.10, riskLevel: "medium", volatility: 0.25, eventProbabilities: { vacancy: 0.10, default: 0.06, maintenanceSurprise: 0.05 }, canRent: true, monthlyRentMin: 10000, monthlyRentMax: 40000 },
  { type: "shop", name: "Kiosk", icon: "🏪", minCost: 80000, maxCost: 300000, annualROI: 0.15, maintenanceRate: 0.08, riskLevel: "medium", volatility: 0.28, eventProbabilities: { vacancy: 0.12, default: 0.08 }, canRent: true, monthlyRentMin: 5000, monthlyRentMax: 25000 },
  { type: "shop", name: "Pharmacy", icon: "💊", minCost: 2000000, maxCost: 8000000, annualROI: 0.12, maintenanceRate: 0.12, riskLevel: "medium", volatility: 0.15, eventProbabilities: { vacancy: 0.03, maintenanceSurprise: 0.03 } },
  { type: "shop", name: "Salon / Barbershop", icon: "💇", minCost: 300000, maxCost: 1500000, annualROI: 0.18, maintenanceRate: 0.15, riskLevel: "medium", volatility: 0.22, eventProbabilities: { vacancy: 0.06, maintenanceSurprise: 0.04 }, canRent: true, monthlyRentMin: 15000, monthlyRentMax: 60000 },
  { type: "shop", name: "Restaurant Space", icon: "🍽️", minCost: 1000000, maxCost: 5000000, annualROI: 0.11, maintenanceRate: 0.18, riskLevel: "medium", volatility: 0.24, eventProbabilities: { vacancy: 0.07, default: 0.05, maintenanceSurprise: 0.05 }, canRent: true, monthlyRentMin: 50000, monthlyRentMax: 200000 },
  { type: "shop", name: "Mini-Supermarket", icon: "🛍️", minCost: 1500000, maxCost: 6000000, annualROI: 0.14, maintenanceRate: 0.14, riskLevel: "medium", volatility: 0.20, eventProbabilities: { vacancy: 0.04, maintenanceSurprise: 0.04 } },
  { type: "shop", name: "Hardware Store", icon: "🔧", minCost: 800000, maxCost: 4000000, annualROI: 0.13, maintenanceRate: 0.12, riskLevel: "medium", volatility: 0.18, eventProbabilities: { vacancy: 0.05, maintenanceSurprise: 0.04 } },
  { type: "shop", name: "Clothing Boutique", icon: "👗", minCost: 400000, maxCost: 2000000, annualROI: 0.16, maintenanceRate: 0.10, riskLevel: "medium", volatility: 0.26, eventProbabilities: { vacancy: 0.08, default: 0.04 }, canRent: true, monthlyRentMin: 25000, monthlyRentMax: 80000 },
  { type: "shop", name: "Electronics Shop", icon: "📱", minCost: 600000, maxCost: 3000000, annualROI: 0.15, maintenanceRate: 0.08, riskLevel: "medium", volatility: 0.22, eventProbabilities: { vacancy: 0.06, maintenanceSurprise: 0.03 } },
  { type: "shop", name: "Petrol Station (lease)", icon: "⛽", minCost: 5000000, maxCost: 20000000, annualROI: 0.09, maintenanceRate: 0.20, riskLevel: "medium", volatility: 0.16, eventProbabilities: { vacancy: 0.02, maintenanceSurprise: 0.06 } },
  { type: "shop", name: "Car Wash", icon: "🚗", minCost: 200000, maxCost: 800000, annualROI: 0.20, maintenanceRate: 0.15, riskLevel: "medium", volatility: 0.25, eventProbabilities: { vacancy: 0.05, maintenanceSurprise: 0.06 }, canRent: true, monthlyRentMin: 10000, monthlyRentMax: 35000 },
  // ---- LAND ----
  { type: "land", name: "Residential Land (1/8 acre)", icon: "🌾", minCost: 500000, maxCost: 3000000, annualROI: 0.10, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Commercial Land", icon: "🏗️", minCost: 2000000, maxCost: 10000000, annualROI: 0.12, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Agricultural Land (1 acre)", icon: "🌽", minCost: 800000, maxCost: 5000000, annualROI: 0.08, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Beach Plot", icon: "🏖️", minCost: 3000000, maxCost: 15000000, annualROI: 0.14, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Corner Plot", icon: "📍", minCost: 1500000, maxCost: 8000000, annualROI: 0.11, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Subdivision Plot", icon: "🗺️", minCost: 600000, maxCost: 2500000, annualROI: 0.09, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Industrial Land", icon: "🏭", minCost: 3000000, maxCost: 20000000, annualROI: 0.07, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  // ---- VEHICLES (matatu type) ----
  { type: "matatu", name: "Matatu (14-seater)", icon: "🚐", minCost: 800000, maxCost: 1500000, annualROI: 0.18, maintenanceRate: 0.30, riskLevel: "high", volatility: 0.30, eventProbabilities: { breakdown: 0.10, maintenanceSurprise: 0.08 } },
  { type: "matatu", name: "Matatu (33-seater)", icon: "🚌", minCost: 2500000, maxCost: 4500000, annualROI: 0.16, maintenanceRate: 0.28, riskLevel: "high", volatility: 0.28, eventProbabilities: { breakdown: 0.09, maintenanceSurprise: 0.07 } },
  { type: "matatu", name: "Taxi / Uber", icon: "🚕", minCost: 600000, maxCost: 1200000, annualROI: 0.15, maintenanceRate: 0.25, riskLevel: "high", volatility: 0.25, eventProbabilities: { breakdown: 0.08, maintenanceSurprise: 0.06 } },
  { type: "matatu", name: "Boda Boda", icon: "🏍️", minCost: 80000, maxCost: 150000, annualROI: 0.25, maintenanceRate: 0.20, riskLevel: "high", volatility: 0.35, eventProbabilities: { breakdown: 0.12, maintenanceSurprise: 0.08 } },
  { type: "matatu", name: "Tuk Tuk", icon: "🛺", minCost: 250000, maxCost: 450000, annualROI: 0.22, maintenanceRate: 0.22, riskLevel: "high", volatility: 0.30, eventProbabilities: { breakdown: 0.10, maintenanceSurprise: 0.07 } },
  { type: "matatu", name: "Pickup (cargo)", icon: "🛻", minCost: 1200000, maxCost: 2500000, annualROI: 0.14, maintenanceRate: 0.24, riskLevel: "high", volatility: 0.24, eventProbabilities: { breakdown: 0.07, maintenanceSurprise: 0.06 } },
  { type: "matatu", name: "School Van", icon: "🚐", minCost: 1000000, maxCost: 2000000, annualROI: 0.16, maintenanceRate: 0.26, riskLevel: "high", volatility: 0.22, eventProbabilities: { breakdown: 0.08, maintenanceSurprise: 0.06 } },
  { type: "matatu", name: "Tour Van", icon: "🚙", minCost: 2000000, maxCost: 4000000, annualROI: 0.12, maintenanceRate: 0.22, riskLevel: "medium", volatility: 0.28, eventProbabilities: { breakdown: 0.06, maintenanceSurprise: 0.05 } },
  // ---- MMF / CASH ----
  { type: "mmf", name: "Money Market Fund", icon: "📈", minCost: 5000, maxCost: 10000000, annualROI: 0.10, maintenanceRate: 0, riskLevel: "low", volatility: 0.05 },
  { type: "mmf", name: "Unit Trust", icon: "📊", minCost: 5000, maxCost: 5000000, annualROI: 0.095, maintenanceRate: 0, riskLevel: "low", volatility: 0.06 },
  { type: "mmf", name: "Liquid Fund", icon: "💧", minCost: 1000, maxCost: 2000000, annualROI: 0.085, maintenanceRate: 0, riskLevel: "low", volatility: 0.04 },
  { type: "mmf", name: "Treasury Bill (91-day)", icon: "📜", minCost: 100000, maxCost: 5000000, annualROI: 0.165, maintenanceRate: 0, riskLevel: "low", volatility: 0.02 },
  { type: "mmf", name: "Treasury Bill (182-day)", icon: "📜", minCost: 100000, maxCost: 5000000, annualROI: 0.17, maintenanceRate: 0, riskLevel: "low", volatility: 0.02 },
  { type: "mmf", name: "Treasury Bill (364-day)", icon: "📜", minCost: 100000, maxCost: 5000000, annualROI: 0.18, maintenanceRate: 0, riskLevel: "low", volatility: 0.02 },
  // ---- SACCO / CHAMA ----
  { type: "sacco", name: "SACCO Shares", icon: "🏛️", minCost: 5000, maxCost: 500000, annualROI: 0.12, maintenanceRate: 0, riskLevel: "low", volatility: 0.08 },
  { type: "sacco", name: "Investment Club (Chama)", icon: "👥", minCost: 10000, maxCost: 1000000, annualROI: 0.15, maintenanceRate: 0, riskLevel: "medium", volatility: 0.12 },
  { type: "sacco", name: "Housing SACCO", icon: "🏠", minCost: 10000, maxCost: 800000, annualROI: 0.11, maintenanceRate: 0, riskLevel: "low", volatility: 0.07 },
  { type: "sacco", name: "Transport SACCO", icon: "🚐", minCost: 5000, maxCost: 300000, annualROI: 0.13, maintenanceRate: 0, riskLevel: "low", volatility: 0.09 },
  { type: "sacco", name: "Teachers SACCO", icon: "📚", minCost: 5000, maxCost: 500000, annualROI: 0.12, maintenanceRate: 0, riskLevel: "low", volatility: 0.07 },
  { type: "sacco", name: "Civil Servants SACCO", icon: "🏛️", minCost: 5000, maxCost: 600000, annualROI: 0.115, maintenanceRate: 0, riskLevel: "low", volatility: 0.07 },
  // ---- STOCKS / NSE ----
  { type: "stocks", name: "Stock Shares (NSE)", icon: "📊", minCost: 10000, maxCost: 500000, annualROI: 0, maintenanceRate: 0, riskLevel: "high", volatility: 0.35 },
  { type: "stocks", name: "Dividend Stock", icon: "💹", minCost: 50000, maxCost: 2000000, annualROI: 0.12, maintenanceRate: 0, riskLevel: "medium", volatility: 0.25 },
  { type: "stocks", name: "Growth Stock", icon: "🚀", minCost: 20000, maxCost: 1000000, annualROI: 0, maintenanceRate: 0, riskLevel: "high", volatility: 0.45, isAppreciationOnly: true },
  { type: "stocks", name: "Banking Sector Share", icon: "🏦", minCost: 30000, maxCost: 800000, annualROI: 0.10, maintenanceRate: 0, riskLevel: "medium", volatility: 0.28 },
  { type: "stocks", name: "Telecom Share", icon: "📱", minCost: 40000, maxCost: 600000, annualROI: 0.08, maintenanceRate: 0, riskLevel: "medium", volatility: 0.26 },
  { type: "stocks", name: "Safaricom Share", icon: "📶", minCost: 50000, maxCost: 1000000, annualROI: 0.06, maintenanceRate: 0, riskLevel: "medium", volatility: 0.22 },
  { type: "stocks", name: "EABL Share", icon: "🍺", minCost: 40000, maxCost: 500000, annualROI: 0.09, maintenanceRate: 0, riskLevel: "medium", volatility: 0.24 },
  { type: "stocks", name: "KCB Share", icon: "🏦", minCost: 35000, maxCost: 600000, annualROI: 0.11, maintenanceRate: 0, riskLevel: "medium", volatility: 0.26 },
  { type: "stocks", name: "Equity Bank Share", icon: "🏦", minCost: 40000, maxCost: 700000, annualROI: 0.10, maintenanceRate: 0, riskLevel: "medium", volatility: 0.25 },
  { type: "stocks", name: "REIT (I-REIT)", icon: "🏢", minCost: 100000, maxCost: 2000000, annualROI: 0.085, maintenanceRate: 0, riskLevel: "medium", volatility: 0.18 },
  { type: "stocks", name: "ETF", icon: "📉", minCost: 5000, maxCost: 500000, annualROI: 0.07, maintenanceRate: 0, riskLevel: "medium", volatility: 0.20 },
  // ---- FIXED DEPOSIT ----
  { type: "fixed_deposit", name: "Bank Fixed Deposit (6 months)", icon: "🏦", minCost: 50000, maxCost: 5000000, annualROI: 0.12, maintenanceRate: 0, riskLevel: "low", volatility: 0 },
  { type: "fixed_deposit", name: "Bank Fixed Deposit (12 months)", icon: "🏦", minCost: 50000, maxCost: 5000000, annualROI: 0.135, maintenanceRate: 0, riskLevel: "low", volatility: 0 },
  { type: "fixed_deposit", name: "Treasury Bond (2-year)", icon: "📜", minCost: 100000, maxCost: 10000000, annualROI: 0.17, maintenanceRate: 0, riskLevel: "low", volatility: 0 },
  { type: "fixed_deposit", name: "Treasury Bond (5-year)", icon: "📜", minCost: 100000, maxCost: 10000000, annualROI: 0.18, maintenanceRate: 0, riskLevel: "low", volatility: 0 },
  { type: "fixed_deposit", name: "Treasury Bond (10-year)", icon: "📜", minCost: 100000, maxCost: 10000000, annualROI: 0.185, maintenanceRate: 0, riskLevel: "low", volatility: 0 },
  { type: "fixed_deposit", name: "Corporate Bond", icon: "📄", minCost: 100000, maxCost: 5000000, annualROI: 0.15, maintenanceRate: 0, riskLevel: "low", volatility: 0.02 },
  { type: "fixed_deposit", name: "Infrastructure Bond", icon: "🛣️", minCost: 100000, maxCost: 10000000, annualROI: 0.165, maintenanceRate: 0, riskLevel: "low", volatility: 0 },
  // ---- MORE REAL ESTATE ----
  { type: "flat", name: "Single Room (Bedsitter)", icon: "🛏️", minCost: 800000, maxCost: 2000000, annualROI: 0.08, maintenanceRate: 0.12, riskLevel: "medium", volatility: 0.20, eventProbabilities: { vacancy: 0.08, maintenanceSurprise: 0.04 } },
  { type: "flat", name: "Duplex", icon: "🏠", minCost: 12000000, maxCost: 35000000, annualROI: 0.05, maintenanceRate: 0.18, riskLevel: "medium", volatility: 0.12, eventProbabilities: { vacancy: 0.04, maintenanceSurprise: 0.04 } },
  { type: "flat", name: "Mansion", icon: "🏰", minCost: 25000000, maxCost: 80000000, annualROI: 0.04, maintenanceRate: 0.15, riskLevel: "low", volatility: 0.10, eventProbabilities: { vacancy: 0.03, maintenanceSurprise: 0.03 } },
  { type: "flat", name: "Staff Quarters", icon: "🏘️", minCost: 2000000, maxCost: 6000000, annualROI: 0.07, maintenanceRate: 0.16, riskLevel: "medium", volatility: 0.14, eventProbabilities: { vacancy: 0.05, maintenanceSurprise: 0.04 } },
  { type: "flat", name: "Shop-Cum-House", icon: "🏬", minCost: 3500000, maxCost: 10000000, annualROI: 0.075, maintenanceRate: 0.17, riskLevel: "medium", volatility: 0.16, eventProbabilities: { vacancy: 0.06, maintenanceSurprise: 0.04 } },
  // ---- MORE SHOPS ----
  { type: "shop", name: "Butchery", icon: "🥩", minCost: 400000, maxCost: 1500000, annualROI: 0.18, maintenanceRate: 0.12, riskLevel: "medium", volatility: 0.22, eventProbabilities: { vacancy: 0.05, maintenanceSurprise: 0.04 } },
  { type: "shop", name: "Bakery", icon: "🥖", minCost: 500000, maxCost: 2000000, annualROI: 0.16, maintenanceRate: 0.14, riskLevel: "medium", volatility: 0.20, eventProbabilities: { vacancy: 0.04, maintenanceSurprise: 0.05 } },
  { type: "shop", name: "M-Pesa Agent", icon: "📱", minCost: 100000, maxCost: 400000, annualROI: 0.22, maintenanceRate: 0.05, riskLevel: "medium", volatility: 0.18, eventProbabilities: { default: 0.02 } },
  { type: "shop", name: "Cyber Café", icon: "💻", minCost: 200000, maxCost: 800000, annualROI: 0.20, maintenanceRate: 0.15, riskLevel: "medium", volatility: 0.24, eventProbabilities: { vacancy: 0.06, maintenanceSurprise: 0.06 }, canRent: true, monthlyRentMin: 8000, monthlyRentMax: 30000 },
  { type: "shop", name: "Tailoring Shop", icon: "🧵", minCost: 150000, maxCost: 500000, annualROI: 0.19, maintenanceRate: 0.08, riskLevel: "medium", volatility: 0.22, canRent: true, monthlyRentMin: 8000, monthlyRentMax: 25000 },
  { type: "shop", name: "Boda Boda Stage", icon: "🏍️", minCost: 50000, maxCost: 200000, annualROI: 0.28, maintenanceRate: 0.10, riskLevel: "high", volatility: 0.30, eventProbabilities: { vacancy: 0.08 } },
  { type: "shop", name: "Water Vending", icon: "💧", minCost: 80000, maxCost: 300000, annualROI: 0.24, maintenanceRate: 0.12, riskLevel: "medium", volatility: 0.22 },
  { type: "shop", name: "Milk Bar", icon: "🥛", minCost: 100000, maxCost: 400000, annualROI: 0.20, maintenanceRate: 0.10, riskLevel: "medium", volatility: 0.20 },
  { type: "shop", name: "Poultry Shop", icon: "🐔", minCost: 150000, maxCost: 600000, annualROI: 0.22, maintenanceRate: 0.18, riskLevel: "medium", volatility: 0.26, eventProbabilities: { maintenanceSurprise: 0.06 } },
  { type: "shop", name: "Green Grocery", icon: "🥬", minCost: 100000, maxCost: 500000, annualROI: 0.21, maintenanceRate: 0.08, riskLevel: "medium", volatility: 0.24 },
  // ---- MORE LAND ----
  { type: "land", name: "Riverside Plot", icon: "🌊", minCost: 2000000, maxCost: 12000000, annualROI: 0.13, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Roadside Plot", icon: "🛣️", minCost: 1200000, maxCost: 6000000, annualROI: 0.11, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Ranch Land", icon: "🐄", minCost: 500000, maxCost: 4000000, annualROI: 0.07, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Coffee Farm", icon: "☕", minCost: 1500000, maxCost: 8000000, annualROI: 0.06, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "land", name: "Tea Farm", icon: "🍃", minCost: 2000000, maxCost: 10000000, annualROI: 0.055, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  // ---- MORE VEHICLES ----
  { type: "matatu", name: "Ambulance (lease)", icon: "🚑", minCost: 3000000, maxCost: 6000000, annualROI: 0.14, maintenanceRate: 0.28, riskLevel: "medium", volatility: 0.20, eventProbabilities: { breakdown: 0.06, maintenanceSurprise: 0.06 } },
  { type: "matatu", name: "Delivery Motorcycle", icon: "🏍️", minCost: 120000, maxCost: 250000, annualROI: 0.28, maintenanceRate: 0.18, riskLevel: "high", volatility: 0.32, eventProbabilities: { breakdown: 0.11, maintenanceSurprise: 0.07 } },
  { type: "matatu", name: "Tractor (hire)", icon: "🚜", minCost: 1500000, maxCost: 3500000, annualROI: 0.15, maintenanceRate: 0.25, riskLevel: "high", volatility: 0.26, eventProbabilities: { breakdown: 0.08, maintenanceSurprise: 0.07 } },
  { type: "matatu", name: "Lorry (cargo)", icon: "🚛", minCost: 3500000, maxCost: 8000000, annualROI: 0.12, maintenanceRate: 0.26, riskLevel: "high", volatility: 0.24, eventProbabilities: { breakdown: 0.07, maintenanceSurprise: 0.06 } },
  // More variety
  { type: "flat", name: "Medical Clinic Space", icon: "🏥", minCost: 4000000, maxCost: 12000000, annualROI: 0.075, maintenanceRate: 0.16, riskLevel: "medium", volatility: 0.14, eventProbabilities: { vacancy: 0.04, maintenanceSurprise: 0.04 } },
  { type: "shop", name: "Mobile Money Agent", icon: "📲", minCost: 150000, maxCost: 500000, annualROI: 0.24, maintenanceRate: 0.06, riskLevel: "medium", volatility: 0.18 },
  { type: "land", name: "Mixed-Use Plot", icon: "🏘️", minCost: 2500000, maxCost: 12000000, annualROI: 0.095, maintenanceRate: 0, isAppreciationOnly: true, riskLevel: "medium", volatility: 0 },
  { type: "sacco", name: "Boda Boda SACCO", icon: "🏍️", minCost: 5000, maxCost: 200000, annualROI: 0.14, maintenanceRate: 0, riskLevel: "medium", volatility: 0.11 },
  { type: "mmf", name: "Pension Fund", icon: "👴", minCost: 5000, maxCost: 3000000, annualROI: 0.09, maintenanceRate: 0, riskLevel: "low", volatility: 0.05 },
  { type: "fixed_deposit", name: "Fixed Deposit (24 months)", icon: "🔒", minCost: 100000, maxCost: 10000000, annualROI: 0.14, maintenanceRate: 0, riskLevel: "low", volatility: 0 },
];

export { LOCATIONS };
