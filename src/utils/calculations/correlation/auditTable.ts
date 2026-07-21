import { alignedPricesForFrequency, longTermAlignedPrices } from './horizons';
import { AlignedSeries, CorrelationFrequency, DateRange, PriceSeries } from './types';

export interface CalculationAuditRow {
  date: string;
  primaryClose: number;
  candidateClose: number;
  /** null for the first row (no prior observation) or when either price that day is non-positive. */
  primaryReturn: number | null;
  candidateReturn: number | null;
}

function toAuditRows(aligned: AlignedSeries): CalculationAuditRow[] {
  return aligned.dates.map((date, i) => {
    let primaryReturn: number | null = null;
    let candidateReturn: number | null = null;
    if (i > 0) {
      const pa0 = aligned.a[i - 1];
      const pa1 = aligned.a[i];
      const pb0 = aligned.b[i - 1];
      const pb1 = aligned.b[i];
      if (pa0 > 0 && pa1 > 0) primaryReturn = Math.log(pa1 / pa0);
      if (pb0 > 0 && pb1 > 0) candidateReturn = Math.log(pb1 / pb0);
    }
    return {
      date: date.toISOString().slice(0, 10),
      primaryClose: aligned.a[i],
      candidateClose: aligned.b[i],
      primaryReturn,
      candidateReturn,
    };
  });
}

/**
 * Full aligned adjusted-close price + log-return table for one candidate/frequency pair, so a
 * user can manually re-derive the correlation value shown for that heatmap cell / table row.
 * The first row always has a blank return (no prior observation to diff against).
 */
export function buildCalculationAuditTable(
  primary: PriceSeries,
  candidate: PriceSeries,
  frequency: CorrelationFrequency,
  dateRange: DateRange
): CalculationAuditRow[] {
  const aligned =
    frequency === 'longTerm'
      ? longTermAlignedPrices(primary, candidate)
      : alignedPricesForFrequency(primary, candidate, frequency, dateRange);
  return toAuditRows(aligned);
}
