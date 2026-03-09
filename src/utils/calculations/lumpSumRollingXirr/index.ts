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
// PORTFOLIO VALUE FOR ANY DATE
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
  years: number
): number {

  return Math.pow(totalValue / investmentAmount, 1 / years) - 1;
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

    const dailyValues: DailyPortfolioValue[] = [];

    for (let j = 0; j <= i; j++) {

      const day = sorted[j].date;

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
