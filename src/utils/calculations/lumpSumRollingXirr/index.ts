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

export type { Transaction } from '../sipRollingXirr/types';

// ============================================================================
// HELPERS
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
// FUND UNITS
// ============================================================================

function calculateFundUnits(
  fundDateMaps: Map<string, NavEntry>[],
  startDate: Date,
  allocations: number[],
  investmentAmount: number
): number[] | null {

  const units: number[] = [];
  const startKey = toDateKey(startDate);

  for (let f = 0; f < fundDateMaps.length; f++) {

    const navEntry = fundDateMaps[f].get(startKey);
    if (!navEntry) return null;

    const allocation = (investmentAmount * allocations[f]) / 100;

    units[f] = allocation / navEntry.nav;
  }

  return units;
}

// ============================================================================
// PORTFOLIO VALUE
// ============================================================================

function calculatePortfolioValueForDate(
  fundDateMaps: Map<string, NavEntry>[],
  date: Date,
  units: number[]
): number | null {

  let total = 0;
  const key = toDateKey(date);

  for (let f = 0; f < fundDateMaps.length; f++) {

    const navEntry = fundDateMaps[f].get(key);
    if (!navEntry) return null;

    total += units[f] * navEntry.nav;
  }

  return total;
}

// ============================================================================
// CAGR RETURN
// ============================================================================

function calculateRollingReturn(
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
// MAIN FUNCTION
// ============================================================================

export function calculateLumpSumRollingXirr(

  navDataList: NavEntry[][],
  years: number = 1,
  allocations: number[] = [],
  investmentAmount: number = 100

): RollingXirrEntry[] {

  if (!isValidInput(navDataList)) return [];

  const numFunds = navDataList.length;

  const actualAllocations =
    allocations.length === numFunds
      ? allocations
      : Array(numFunds).fill(100 / numFunds);

  const filledNavs = navDataList.map(ensureContinuousDates);

  const fundDateMaps = filledNavs.map(buildDateMap);

  const sorted = getSortedDates(filledNavs[0]);

  const firstDate = sorted[0].date;

  const months = years * 12;

  const results: RollingXirrEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {

    const endDate = sorted[i].date;

    const startDate = getNthPreviousMonthDate(endDate, months);

    if (startDate < firstDate) continue;

    const fundUnits = calculateFundUnits(
      fundDateMaps,
      startDate,
      actualAllocations,
      investmentAmount
    );

    if (!fundUnits) continue;

    const totalValue = calculatePortfolioValueForDate(
      fundDateMaps,
      endDate,
      fundUnits
    );

    if (totalValue === null) continue;

    // volatility window fix
    const dailyValues: DailyPortfolioValue[] = [];

    for (let j = 0; j <= i; j++) {

      const day = sorted[j].date;

      if (day < startDate) continue;

      const value = calculatePortfolioValueForDate(
        fundDateMaps,
        day,
        fundUnits
      );

      if (value !== null) {
        dailyValues.push({
          date: day,
          totalValue: value
        });
      }
    }

    results.push({
      date: endDate,
      xirr:
        Math.round(
          calculateRollingReturn(investmentAmount, totalValue, years) * 10000
        ) / 10000,
      transactions: [],
      volatility:
        Math.round(calculateVolatility(dailyValues) * 10000) / 10000
    });
  }

  return results;
}
