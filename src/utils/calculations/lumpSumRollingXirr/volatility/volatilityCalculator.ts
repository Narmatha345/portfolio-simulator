const TRADING_DAYS_PER_YEAR = 252;

export interface DailyPortfolioValue {
  date: Date;
  totalValue: number;
}

/**
 * Google Finance style Return %
 * Return% = ((Current Value - Invested Amount) / Invested Amount) * 100
 */
export function calculateReturnPercent(
  dailyValues: DailyPortfolioValue[],
  investedAmount: number
): { date: Date; returnPercent: number }[] {

  if (!dailyValues.length || investedAmount <= 0) {
    return [];
  }

  return dailyValues.map(v => {

    const returnPercent =
      ((v.totalValue - investedAmount) / investedAmount) * 100;

    return {
      date: v.date,
      returnPercent
    };
  });
}

/**
 * Calculate portfolio volatility from daily portfolio values
 * Returns annualized volatility as a percentage
 */
export function calculateVolatility(
  dailyValues: DailyPortfolioValue[]
): number {

  if (dailyValues.length < 2) {
    return 0;
  }

  const dailyReturns = calculateDailyReturns(dailyValues);

  if (dailyReturns.length < 2) {
    return 0;
  }

  const meanReturn =
    dailyReturns.reduce((sum, r) => sum + r, 0) /
    dailyReturns.length;

  const variance =
    dailyReturns.reduce((sum, r) => {
      const diff = r - meanReturn;
      return sum + diff * diff;
    }, 0) / dailyReturns.length;

  const dailyVolatility = Math.sqrt(variance);

  const totalDays = dailyValues.length - 1;
  const tradingDays = dailyReturns.length;

  const tradingDaysPerYear =
    totalDays > 0
      ? Math.round((tradingDays / totalDays) * 365)
      : TRADING_DAYS_PER_YEAR;

  const annualizedVolatility =
    dailyVolatility * Math.sqrt(tradingDaysPerYear);

  return (annualizedVolatility * 100) || 0;
}

/**
 * Daily Return = (Today Value / Yesterday Value) - 1
 */
function calculateDailyReturns(
  dailyValues: DailyPortfolioValue[]
): number[] {

  const returns: number[] = [];

  for (let i = 1; i < dailyValues.length; i++) {

    const previousValue = dailyValues[i - 1].totalValue;
    const currentValue = dailyValues[i].totalValue;

    if (previousValue > 0) {

      // Skip weekends/holidays forward filled values
      if (currentValue === previousValue) {
        continue;
      }

      const dailyReturn =
        (currentValue / previousValue) - 1;

      returns.push(dailyReturn);
    }
  }

  return returns;
}