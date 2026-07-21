import { AlignedSeries, AnalysisPeriod } from './types';

const PERIOD_YEARS: Partial<Record<AnalysisPeriod, number>> = { '1y': 1, '3y': 3, '5y': 5, '10y': 10 };

/** Restrict an aligned series to the trailing N years, anchored at its own last common date. */
export function restrictAlignedToPeriod(aligned: AlignedSeries, period: AnalysisPeriod): AlignedSeries {
  if (period === 'max' || aligned.dates.length === 0) return aligned;
  const years = PERIOD_YEARS[period];
  if (!years) return aligned;

  const anchor = aligned.dates[aligned.dates.length - 1];
  const cutoff = Date.UTC(anchor.getUTCFullYear() - years, anchor.getUTCMonth(), anchor.getUTCDate());

  const dates: Date[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < aligned.dates.length; i++) {
    if (aligned.dates[i].getTime() >= cutoff) {
      dates.push(aligned.dates[i]);
      a.push(aligned.a[i]);
      b.push(aligned.b[i]);
    }
  }
  return { dates, a, b };
}

/** Keep only the trailing `maxPoints` observations (used to cap long-term history at 10 years of months). */
export function capAlignedToMaxPoints(aligned: AlignedSeries, maxPoints: number): AlignedSeries {
  if (aligned.dates.length <= maxPoints) return aligned;
  const start = aligned.dates.length - maxPoints;
  return { dates: aligned.dates.slice(start), a: aligned.a.slice(start), b: aligned.b.slice(start) };
}
