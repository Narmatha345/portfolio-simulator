import { AlignedSeries, ResampledPoint } from './types';

/**
 * Align two resampled series to their common period keys (dates where both
 * assets have a valid adjusted close). This is the "use only common trading
 * dates" step required before any return or correlation calculation.
 */
export function alignByKey(seriesA: ResampledPoint[], seriesB: ResampledPoint[]): AlignedSeries {
  const mapB = new Map(seriesB.map((p) => [p.key, p]));
  const dates: Date[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (const pa of seriesA) {
    const pb = mapB.get(pa.key);
    if (!pb) continue;
    dates.push(pa.date);
    a.push(pa.value);
    b.push(pb.value);
  }
  return { dates, a, b };
}
