import xirr from 'xirr';
import { NavEntry } from '../../../types/navData';
import { areDatesContinuous, getNthPreviousMonthDate } from '../../date/dateUtils';
import { fillMissingNavDates } from '../../data/fillMissingNavDates';
import { calculateVolatility, DailyPortfolioValue } from './volatility/volatilityCalculator';
import { Transaction } from '../sipRollingXirr/types';

// ============================================================================
// TYPES
// ============================================================================

export interface RollingXirrEntry {
  date: Date;
  xirr: number;
  transactions: Transaction[];
  volatility?: number;
}

// Re-export Transaction for convenience
export type { Transaction } from '../sipRollingXirr/types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildDateMap(fund: NavEntry[]): Map<string, NavEntry> {
  return new Map(fund.map(entry => [toDateKey(entry.date), entry]));
}

function ensureContinuousDates(fund: NavEntry[]): NavEntry[] {
  return areDatesContinuous(fund) ? fund : fillMissingNavDates(fund);
}

function isValidInput(navDataList: NavEntry[][]): boolean {
  return navDataList.length > 0 && navDataList.every(fund => fund.length >= 2);
}

function getSortedDates(fund: NavEntry[]): NavEntry[] {
  return [...fund].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ============================================================================
// MAIN CALCULATION FUNCTION (OPTIMIZED)
// ============================================================================

/**
 * Calculate Lumpsum Rolling XIRR for given NAV data
 * 
 * OPTIMIZATION: Pre-computes daily portfolio values once for the entire date range,
 * then slices for each rolling window instead of recalculating.
 * This reduces complexity from O(windows × daysPerWindow) to O(totalDays).
 * 
 * @param navDataList - Array of NAV data for each fund
 * @param years - Rolling period in years (default: 1)
 * @param allocations - Target allocation percentages for each fund (default: equal split)
 * @param investmentAmount - Total investment amount (default: 100)
 * @param includeNilTransactions - Whether to include nil transactions in result (default: false)
 * @returns Array of Lumpsum Rolling XIRR entries for each date
 */
// Timing accumulators for performance analysis
let _xirrTime = 0;
let _volatilityTime = 0;
let _precomputeTime = 0;

export function calculateLumpSumRollingXirr(
  navDataList: NavEntry[][],
  years: number = 1,
  allocations: number[] = [],
  investmentAmount: number = 100,
  includeNilTransactions: boolean = false
): RollingXirrEntry[] {
  // Reset timing accumulators
  _xirrTime = 0;
  _volatilityTime = 0;
  _precomputeTime = 0;
  
  // Validate input
  if (!isValidInput(navDataList)) return [];

  // Prepare data
  const numFunds = navDataList.length;
  const actualAllocations = allocations.length === numFunds 
    ? allocations 
    : Array(numFunds).fill(100 / numFunds);
  
  const filledNavs = navDataList.map(ensureContinuousDates);
  const fundDateMaps = filledNavs.map(buildDateMap);
  const sorted = getSortedDates(filledNavs[0]);
  const firstDate = sorted[0].date;
  const months = years * 12;

  // Build date index map for fast lookups
  const dateIndexMap = new Map<string, number>();
  sorted.forEach((entry, idx) => {
    dateIndexMap.set(toDateKey(entry.date), idx);
  });

  // Pre-compute raw NAVs per fund per date for fast lookups
  // We store NAVs instead of normalized values because portfolio value calculation
  // requires NAV ratios relative to each window's start date, not a global base date.
  // For multi-fund portfolios: Value[date] = Σ(alloc[f] × NAV[f,date] / NAV[f,startDate]) × investment
  const precomputeStart = performance.now();
  
  // Build array of NAVs per date: allNavs[dateIdx][fundIdx] = NAV
  const allNavs: number[][] = [];
  for (const entry of sorted) {
    const dateKey = toDateKey(entry.date);
    const navsForDate: number[] = [];
    for (let f = 0; f < numFunds; f++) {
      const navEntry = fundDateMaps[f].get(dateKey);
      navsForDate.push(navEntry?.nav ?? 0);
    }
    allNavs.push(navsForDate);
  }
  _precomputeTime = performance.now() - precomputeStart;

  // Calculate XIRR for each date
  const results: RollingXirrEntry[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const endDate = sorted[i].date;
    const startDate = getNthPreviousMonthDate(endDate, months);
    if (startDate < firstDate) continue;
    
    const startKey = toDateKey(startDate);
    const startIdx = dateIndexMap.get(startKey);
    if (startIdx === undefined) continue;
    
    // Calculate units purchased at start for each fund
    const fundUnits = calculateFundUnits(fundDateMaps, startDate, actualAllocations, investmentAmount);
    if (!fundUnits) continue;
    
    // Calculate total portfolio value at end date
    const totalValue = calculateTotalValue(fundDateMaps, endDate, fundUnits);
    if (totalValue === null) continue;
    
    // Calculate XIRR (timed)
    const xirrStart = performance.now();
    const xirrValue = calculateXirr(investmentAmount, totalValue, startDate, endDate);
    _xirrTime += performance.now() - xirrStart;
    if (xirrValue === null) continue;
    
    // Calculate volatility using pre-computed NAVs (timed)
    // For each date in the window, compute portfolio value using correct formula:
    // Value[date] = Σ(alloc[f] × NAV[f,date] / NAV[f,startDate]) × investment
    const volStart = performance.now();
    const startNavs = allNavs[startIdx];
    const dailyValues: DailyPortfolioValue[] = [];
    
    for (let j = startIdx; j <= i; j++) {
      const dateNavs = allNavs[j];
      let portfolioValue = 0;
      for (let f = 0; f < numFunds; f++) {
        if (startNavs[f] > 0) {
          portfolioValue += (actualAllocations[f] / 100) * (dateNavs[f] / startNavs[f]) * investmentAmount;
        }
      }
      dailyValues.push({ date: sorted[j].date, totalValue: portfolioValue });
    }
    const volatility = calculateVolatility(dailyValues);
    _volatilityTime += performance.now() - volStart;
    
    // Build only buy/sell transactions (skip nil - major performance gain)
    const transactions = buildBuySellTransactions(
      fundDateMaps,
      fundUnits,
      actualAllocations,
      startDate,
      endDate,
      investmentAmount
    );
    
    results.push({
      date: endDate,
      xirr: Math.round(xirrValue * 10000) / 10000,
      transactions,
      volatility: Math.round(volatility * 10000) / 10000
    });
  }
  
  // Log timing breakdown
  console.log(`[Lumpsum Calc] Precompute: ${(_precomputeTime / 1000).toFixed(2)}s | XIRR: ${(_xirrTime / 1000).toFixed(2)}s | Volatility: ${(_volatilityTime / 1000).toFixed(2)}s | Total entries: ${results.length}`);
  
  return results;
}

/**
 * Build only buy and sell transactions (skip nil transactions for performance)
 * This is used for corpus value calculation in charts
 */
function buildBuySellTransactions(
  fundDateMaps: Map<string, NavEntry>[],
  fundUnits: number[],
  allocations: number[],
  startDate: Date,
  endDate: Date,
  investmentAmount: number
): Transaction[] {
  const transactions: Transaction[] = [];
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);
  
  // Build buy transactions (start date)
  let startPortfolioValue = 0;
  for (let fundIdx = 0; fundIdx < fundDateMaps.length; fundIdx++) {
    const navEntry = fundDateMaps[fundIdx].get(startKey);
    if (!navEntry) continue;
    
    const currentValue = fundUnits[fundIdx] * navEntry.nav;
    startPortfolioValue += currentValue;
    const fundAllocation = (investmentAmount * allocations[fundIdx]) / 100;
    
    transactions.push({
      fundIdx,
      nav: navEntry.nav,
      when: navEntry.date,
      units: fundUnits[fundIdx],
      amount: -fundAllocation,
      type: 'buy',
      cumulativeUnits: fundUnits[fundIdx],
      currentValue,
      allocationPercentage: 0
    });
  }
  
  // Build sell transactions (end date)
  let endPortfolioValue = 0;
  const sellTransactions: Transaction[] = [];
  for (let fundIdx = 0; fundIdx < fundDateMaps.length; fundIdx++) {
    const navEntry = fundDateMaps[fundIdx].get(endKey);
    if (!navEntry) continue;
    
    const currentValue = fundUnits[fundIdx] * navEntry.nav;
    endPortfolioValue += currentValue;
    
    sellTransactions.push({
      fundIdx,
      nav: navEntry.nav,
      when: navEntry.date,
      units: fundUnits[fundIdx],
      amount: currentValue,
      type: 'sell',
      cumulativeUnits: fundUnits[fundIdx],
      currentValue,
      allocationPercentage: 0
    });
  }
  
  // Calculate allocation percentages
  transactions.forEach(tx => {
    tx.allocationPercentage = startPortfolioValue > 0 
      ? (tx.currentValue / startPortfolioValue) * 100 
      : 0;
  });
  sellTransactions.forEach(tx => {
    tx.allocationPercentage = endPortfolioValue > 0 
      ? (tx.currentValue / endPortfolioValue) * 100 
      : 0;
  });
  
  transactions.push(...sellTransactions);
  return transactions;
}

/**
 * Calculate units purchased for each fund at start date
 */
function calculateFundUnits(
  fundDateMaps: Map<string, NavEntry>[],
  startDate: Date,
  allocations: number[],
  investmentAmount: number
): number[] | null {
  const fundUnits: number[] = [];
  const startKey = toDateKey(startDate);

  for (let f = 0; f < fundDateMaps.length; f++) {
    const startEntry = fundDateMaps[f].get(startKey);
    if (!startEntry) return null;
    
    const fundAllocation = (investmentAmount * allocations[f]) / 100;
    fundUnits[f] = fundAllocation / startEntry.nav;
  }

  return fundUnits;
}

/**
 * Calculate total portfolio value at end date
 */
function calculateTotalValue(
  fundDateMaps: Map<string, NavEntry>[],
  endDate: Date,
  fundUnits: number[]
): number | null {
  let totalValue = 0;
  const endKey = toDateKey(endDate);

  for (let f = 0; f < fundDateMaps.length; f++) {
    const endEntry = fundDateMaps[f].get(endKey);
    if (!endEntry) return null;
    
    totalValue += fundUnits[f] * endEntry.nav;
  }

  return totalValue;
}

/**
 * Calculate XIRR from initial investment and final value
 */
function calculateXirr(
  investmentAmount: number,
  totalValue: number,
  startDate: Date,
  endDate: Date
): number | null {

  if (investmentAmount === 0) return null;

  // Yahoo Finance Return %
  const returnPercent = (totalValue - investmentAmount) / investmentAmount;

  return returnPercent;

}

/**
 * Build detailed transactions for all dates in the period
 */
function buildDetailedTransactions(
  fundDateMaps: Map<string, NavEntry>[],
  fundUnits: number[],
  allocations: number[],
  sorted: NavEntry[],
  startDate: Date,
  endDate: Date,
  investmentAmount: number
): Transaction[] {
  const transactions: Transaction[] = [];
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);
  
  // Filter dates within the period
  const periodDates = sorted.filter(
    entry => entry.date >= startDate && entry.date <= endDate
  );
  
  // Generate transactions for each day
  for (const dateEntry of periodDates) {
    const dateKey = toDateKey(dateEntry.date);
    const isStartDate = dateKey === startKey;
    const isEndDate = dateKey === endKey;
    let totalPortfolioValue = 0;
    const dayTransactions: Transaction[] = [];

    // Create transaction for each fund
    for (let fundIdx = 0; fundIdx < fundDateMaps.length; fundIdx++) {
      const navEntry = fundDateMaps[fundIdx].get(dateKey);
      if (!navEntry) continue;

      const currentValue = fundUnits[fundIdx] * navEntry.nav;
      totalPortfolioValue += currentValue;
      const fundAllocation = (investmentAmount * allocations[fundIdx]) / 100;
      
      // Determine transaction type, amount, and units
      let type: 'buy' | 'sell' | 'nil' = 'nil';
      let amount = 0;
      let units = 0; // nil transactions have 0 units (no transaction happening)
      
      if (isStartDate) {
        type = 'buy';
        amount = -fundAllocation;
        units = fundUnits[fundIdx]; // buying these units
      } else if (isEndDate) {
        type = 'sell';
        amount = currentValue;
        units = fundUnits[fundIdx]; // selling these units
      }

      dayTransactions.push({
        fundIdx,
        nav: navEntry.nav,
        when: navEntry.date,
        units,
        amount,
        type,
        cumulativeUnits: fundUnits[fundIdx], // total units held
        currentValue,
        allocationPercentage: 0 // Calculated below
      });
    }

    // Calculate allocation percentages
    dayTransactions.forEach(tx => {
      tx.allocationPercentage = totalPortfolioValue > 0 
        ? (tx.currentValue / totalPortfolioValue) * 100 
        : 0;
    });

    transactions.push(...dayTransactions);
  }

  return transactions;
}

// ============================================================================
// ON-DEMAND RECALCULATION
// ============================================================================

/**
 * Recalculate transactions for a specific date with nil transactions included
 * Used for on-demand calculation when viewing transaction details in modal
 * 
 * @param navDataList - Array of NAV data for each fund
 * @param targetDate - The specific date to recalculate for
 * @param years - Rolling period in years
 * @param allocations - Target allocation percentages for each fund
 * @param investmentAmount - Total investment amount
 * @returns Transaction array with nil transactions included, or null if calculation fails
 */
export function recalculateLumpsumTransactionsForDate(
  navDataList: NavEntry[][],
  targetDate: Date,
  years: number,
  allocations: number[],
  investmentAmount: number = 100
): Transaction[] | null {
  // Validate input
  if (!isValidInput(navDataList)) return null;

  // Prepare data
  const numFunds = navDataList.length;
  const actualAllocations = allocations.length === numFunds 
    ? allocations 
    : Array(numFunds).fill(100 / numFunds);
  
  const filledNavs = navDataList.map(ensureContinuousDates);
  const fundDateMaps = filledNavs.map(buildDateMap);
  const sorted = getSortedDates(filledNavs[0]);
  const firstDate = sorted[0].date;
  const months = years * 12;

  // Calculate start date
  const startDate = getNthPreviousMonthDate(targetDate, months);
  if (startDate < firstDate) return null;

  // Calculate fund units
  const fundUnits = calculateFundUnits(
    fundDateMaps,
    startDate,
    actualAllocations,
    investmentAmount
  );
  if (!fundUnits) return null;

  // Build detailed transactions (with nil included)
  const allTransactions = buildDetailedTransactions(
    fundDateMaps,
    fundUnits,
    actualAllocations,
    sorted,
    startDate,
    targetDate,
    investmentAmount
  );

  return allTransactions;
}
