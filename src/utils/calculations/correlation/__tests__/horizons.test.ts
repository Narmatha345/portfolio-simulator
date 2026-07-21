import { computeFrequencyHorizon, computeLongTermHorizon, MIN_OBSERVATIONS } from '../horizons';
import { ProcessedIndexData } from '../../../../types/index';

/** Generates `count` consecutive business-day (Mon-Fri) points starting at `start`. */
function businessDaySeries(start: Date, count: number, priceFn: (i: number) => number): ProcessedIndexData[] {
  const out: ProcessedIndexData[] = [];
  let d = new Date(start.getTime());
  let i = 0;
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push({ date: new Date(d.getTime()), nav: priceFn(i) });
      i++;
    }
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

/** One point per calendar month (28th), for `count` months starting at `startYear`-`startMonth`. */
function monthlySeries(startYear: number, startMonth: number, count: number, priceFn: (i: number) => number): ProcessedIndexData[] {
  const out: ProcessedIndexData[] = [];
  for (let i = 0; i < count; i++) {
    const y = startYear + Math.floor((startMonth - 1 + i) / 12);
    const m = ((startMonth - 1 + i) % 12) + 1;
    out.push({ date: new Date(Date.UTC(y, m - 1, 28)), nav: priceFn(i) });
  }
  return out;
}

function upwardPrice(i: number): number {
  return 100 * Math.pow(1.0005, i) * (1 + 0.01 * Math.sin(i / 3));
}

describe('computeFrequencyHorizon - daily', () => {
  it('is unavailable when common daily observations are below the minimum (126)', () => {
    const start = new Date(Date.UTC(2023, 0, 2));
    const primary = businessDaySeries(start, 100, upwardPrice);
    const candidate = businessDaySeries(start, 100, upwardPrice);
    const result = computeFrequencyHorizon(primary, candidate, 'daily', 'max');
    expect(result.available).toBe(false);
    expect(result.correlation).toBeNull();
    expect(result.minRequired).toBe(MIN_OBSERVATIONS.daily);
  });

  it('is available and perfectly correlated when candidate is a scalar multiple of primary', () => {
    const start = new Date(Date.UTC(2023, 0, 2));
    const primary = businessDaySeries(start, 200, upwardPrice);
    const candidate = businessDaySeries(start, 200, (i) => upwardPrice(i) * 3.5);
    const result = computeFrequencyHorizon(primary, candidate, 'daily', 'max');
    expect(result.available).toBe(true);
    expect(result.correlation).toBeCloseTo(1, 6);
    expect(result.observations).toBeGreaterThanOrEqual(MIN_OBSERVATIONS.daily);
  });

  it('is perfectly negatively correlated when candidate returns are inverted (1/price)', () => {
    const start = new Date(Date.UTC(2023, 0, 2));
    const primary = businessDaySeries(start, 200, upwardPrice);
    const candidate = businessDaySeries(start, 200, (i) => 1 / upwardPrice(i));
    const result = computeFrequencyHorizon(primary, candidate, 'daily', 'max');
    expect(result.available).toBe(true);
    expect(result.correlation).toBeCloseTo(-1, 6);
  });

  it('restricts the common window to the trailing period (e.g. 1y) anchored at the last common date', () => {
    const start = new Date(Date.UTC(2015, 0, 2));
    const primary = businessDaySeries(start, 2000, upwardPrice);
    const candidate = businessDaySeries(start, 2000, upwardPrice);
    const full = computeFrequencyHorizon(primary, candidate, 'daily', 'max');
    const oneYear = computeFrequencyHorizon(primary, candidate, 'daily', '1y');
    expect(oneYear.observations).toBeLessThan(full.observations);
    expect(oneYear.observations).toBeGreaterThanOrEqual(MIN_OBSERVATIONS.daily);
  });

  it('drops missing adjusted-close rows and rechecks the minimum sample (different calendars)', () => {
    const start = new Date(Date.UTC(2023, 0, 2));
    const primary = businessDaySeries(start, 200, upwardPrice).map((p, i) => (i % 10 === 0 ? { ...p, nav: NaN } : p));
    const candidate = businessDaySeries(start, 200, upwardPrice);
    const result = computeFrequencyHorizon(primary, candidate, 'daily', 'max');
    // ~20 of 200 rows dropped, still above the 126 minimum.
    expect(result.available).toBe(true);
    expect(result.observations).toBeLessThan(199);
  });
});

describe('computeLongTermHorizon', () => {
  it('is unavailable with fewer than 36 common monthly observations', () => {
    const primary = monthlySeries(2020, 1, 20, upwardPrice);
    const candidate = monthlySeries(2020, 1, 20, upwardPrice);
    const result = computeLongTermHorizon(primary, candidate);
    expect(result.available).toBe(false);
    expect(result.minRequired).toBe(MIN_OBSERVATIONS.longTerm);
  });

  it('caps the longest common history at 10 years (120 monthly returns) even with more history available', () => {
    const primary = monthlySeries(2000, 1, 260, upwardPrice); // ~21.7 years of months
    const candidate = monthlySeries(2000, 1, 260, (i) => upwardPrice(i) * 2);
    const result = computeLongTermHorizon(primary, candidate);
    expect(result.available).toBe(true);
    expect(result.observations).toBe(120);
    expect(result.correlation).toBeCloseTo(1, 6);
  });

  it('uses the maximum available history when under the 10-year cap', () => {
    const primary = monthlySeries(2020, 1, 40, upwardPrice);
    const candidate = monthlySeries(2020, 1, 40, upwardPrice);
    const result = computeLongTermHorizon(primary, candidate);
    expect(result.available).toBe(true);
    expect(result.observations).toBe(39);
  });
});
