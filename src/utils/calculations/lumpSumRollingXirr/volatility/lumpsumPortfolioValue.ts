import { NavEntry } from '../../../../types/navData';

export interface DailyLumpsumPortfolioValue {
  date: Date;
  totalValue: number;
}

/**
 * Calculate daily portfolio values for a lumpsum investment
 * Much simpler than SIP - units are fixed from day 1, just multiply by NAV each day
 * 
 * @param navDataList - NAV data for each fund
 * @param startDate - Investment start date
 * @param endDate - Investment end date
 * @param allocations - Allocation percentages for each fund
 * @param investmentAmount - Total lumpsum amount
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

  const unitsPerFund: number[] = [];

  // Calculate units based on first available NAV >= startDate
  for (let f = 0; f < navDataList.length; f++) {
    const startNav = navDataList[f].find(entry => entry.date >= startDate);
    if (!startNav) {
      return [];
    }
    unitsPerFund[f] = (investmentAmount * allocations[f] / 100) / startNav.nav;
  }

  // Build master date list
  const dateSet = new Set<number>();
  navDataList.forEach(fund => {
    fund.forEach(entry => {
      if (entry.date >= startDate && entry.date <= endDate) {
        dateSet.add(entry.date.getTime());
      }
    });
  });

  const allDates = Array.from(dateSet).sort((a, b) => a - b).map(ts => new Date(ts));

  const dailyValues: DailyLumpsumPortfolioValue[] = [];

  for (const date of allDates) {
    let totalValue = 0;

    for (let f = 0; f < navDataList.length; f++) {
      // Find last known NAV on or before current date
      let navEntry = null;
      for (let i = navDataList[f].length - 1; i >= 0; i--) {
        if (navDataList[f][i].date <= date) {
          navEntry = navDataList[f][i];
          break;
        }
      }

      if (!navEntry) {
        totalValue = 0;
        break;
      }

      totalValue += unitsPerFund[f] * navEntry.nav;
    }

    if (totalValue > 0) {
      dailyValues.push({ date, totalValue });
    }
  }

  return dailyValues;
}
