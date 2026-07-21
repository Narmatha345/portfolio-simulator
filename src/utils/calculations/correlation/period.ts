import { AlignedSeries, DateRange } from './types';

/** Restrict an aligned series to an inclusive [startDate, endDate] window. */
export function restrictAlignedToDateRange(aligned: AlignedSeries, range: DateRange): AlignedSeries {
  if (aligned.dates.length === 0) return aligned;
  const start = Date.parse(`${range.startDate}T00:00:00Z`);
  const end = Date.parse(`${range.endDate}T23:59:59Z`);

  const dates: Date[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < aligned.dates.length; i++) {
    const t = aligned.dates[i].getTime();
    if (t >= start && t <= end) {
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
