import { AlignedSeries, PairedReturns } from './types';

/**
 * return[t] = ln(adjustedClose[t] / adjustedClose[t-1]), computed pairwise over
 * an already date-aligned series. A row is dropped from both sides if either
 * price is missing/non-positive, keeping the two return arrays in lockstep.
 */
export function computePairedLogReturns(aligned: AlignedSeries): PairedReturns {
  const dates: Date[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 1; i < aligned.dates.length; i++) {
    const pa0 = aligned.a[i - 1];
    const pa1 = aligned.a[i];
    const pb0 = aligned.b[i - 1];
    const pb1 = aligned.b[i];
    if (!(pa0 > 0) || !(pa1 > 0) || !(pb0 > 0) || !(pb1 > 0)) continue;
    dates.push(aligned.dates[i]);
    a.push(Math.log(pa1 / pa0));
    b.push(Math.log(pb1 / pb0));
  }
  return { dates, a, b };
}

export function computeLogReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    if (!(prev > 0) || !(curr > 0)) continue;
    out.push(Math.log(curr / prev));
  }
  return out;
}
