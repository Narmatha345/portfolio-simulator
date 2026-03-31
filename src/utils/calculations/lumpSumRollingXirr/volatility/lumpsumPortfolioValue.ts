import { NavEntry } from '../../../../types/navData';

export interface DailyLumpsumPortfolioValue {
  date: Date;
  totalValue: number;
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildDateMap(fund: NavEntry[]): Map<string, NavEntry> {
  return new Map(fund.map(entry => [toDateKey(entry.date), entry]));
}

/**
 * Calculate daily portfolio values for a lumpsum investment
 */
export function calculateDailyLumpsumPortfolioValue(
  navDataList: NavEntry[][],
  startDate: Date,
  endDate: Date,
  allocations: number[],
  investmentAmount: number
): DailyLumpsumPortfolioValue[] {

  if (navDataList.length === 0 || navDataList.length !== allocations.length) {
    return [];
  }

  const fundMaps = navDataList.map(buildDateMap);

  const startKey = toDateKey(startDate);

  const unitsPerFund: number[] = [];

  // Calculate units on start date
  for (let f = 0; f < fundMaps.length; f++) {

    const startNav = fundMaps[f].get(startKey);

    if (!startNav) return [];

    const allocationAmount =
      (investmentAmount * allocations[f]) / 100;

    unitsPerFund[f] = allocationAmount / startNav.nav;
  }

  const dateSet = new Set<number>();

  navDataList.forEach(fund => {
    fund.forEach(entry => {
      if (entry.date >= startDate && entry.date <= endDate) {
        dateSet.add(entry.date.getTime());
      }
    });
  });

  const allDates = Array.from(dateSet)
    .sort((a, b) => a - b)
    .map(ts => new Date(ts));

  const results: DailyLumpsumPortfolioValue[] = [];

  for (const date of allDates) {

    const key = toDateKey(date);

    let total = 0;

    for (let f = 0; f < fundMaps.length; f++) {

      const navEntry = fundMaps[f].get(key);

      if (!navEntry) {
        total = 0;
        break;
      }

      total += unitsPerFund[f] * navEntry.nav;
    }

    if (total > 0) {
      results.push({
        date,
        totalValue: total
      });
    }
  }

  return results;
}
