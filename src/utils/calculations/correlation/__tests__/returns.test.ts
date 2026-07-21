import { computeLogReturns, computePairedLogReturns } from '../returns';
import { AlignedSeries } from '../types';

describe('computeLogReturns', () => {
  it('computes ln(P[t]/P[t-1]) for each consecutive pair', () => {
    const values = [100, 110, 99];
    const returns = computeLogReturns(values);
    expect(returns).toHaveLength(2);
    expect(returns[0]).toBeCloseTo(Math.log(110 / 100), 10);
    expect(returns[1]).toBeCloseTo(Math.log(99 / 110), 10);
  });

  it('drops rows with non-positive prices', () => {
    const values = [100, 0, 110, -5, 120];
    const returns = computeLogReturns(values);
    // Only 110->120 is a valid consecutive positive pair (index 2 -> 4 are not consecutive so also skipped)
    expect(returns.every((r) => Number.isFinite(r))).toBe(true);
    expect(returns).not.toContain(NaN);
  });

  it('never uses raw price differences (values must be logged, not subtracted)', () => {
    const values = [50, 100];
    const [r] = computeLogReturns(values);
    expect(r).toBeCloseTo(Math.log(2), 10);
    expect(r).not.toBeCloseTo(50, 5);
  });
});

describe('computePairedLogReturns', () => {
  function makeDates(n: number): Date[] {
    return Array.from({ length: n }, (_, i) => new Date(Date.UTC(2024, 0, i + 1)));
  }

  it('computes paired returns from an aligned series', () => {
    const aligned: AlignedSeries = {
      dates: makeDates(3),
      a: [100, 110, 121],
      b: [50, 55, 60.5],
    };
    const paired = computePairedLogReturns(aligned);
    expect(paired.a).toHaveLength(2);
    expect(paired.b).toHaveLength(2);
    expect(paired.a[0]).toBeCloseTo(Math.log(1.1), 10);
    expect(paired.b[0]).toBeCloseTo(Math.log(1.1), 10);
  });

  it('drops a pairwise row from both sides when either price is missing/invalid', () => {
    const aligned: AlignedSeries = {
      dates: makeDates(4),
      a: [100, 110, 120, 130],
      b: [50, NaN, 60, 65],
    };
    const paired = computePairedLogReturns(aligned);
    // Rows using index 1 (110/NaN) are dropped on both sides: only 120->130 (idx2->3) is a fully valid consecutive pair.
    expect(paired.a).toHaveLength(1);
    expect(paired.b).toHaveLength(1);
    expect(paired.dates[0]).toEqual(makeDates(4)[3]);
  });
});
