import { pearsonCorrelation } from './pearson';
import { PairedReturns } from './types';

export interface RollingCorrelationPoint {
  date: Date;
  correlation: number;
}

export const ROLLING_WINDOW_DEFAULTS = {
  daily: 60,
  weekly: 26,
  monthly: 24,
} as const;

/** Trailing-window Pearson correlation over paired returns, one point per window end-date. */
export function computeRollingCorrelation(paired: PairedReturns, window: number): RollingCorrelationPoint[] {
  const out: RollingCorrelationPoint[] = [];
  if (window <= 1 || paired.a.length < window) return out;

  for (let end = window; end <= paired.a.length; end++) {
    const start = end - window;
    const corr = pearsonCorrelation(paired.a.slice(start, end), paired.b.slice(start, end));
    if (Number.isFinite(corr)) {
      out.push({ date: paired.dates[end - 1], correlation: corr });
    }
  }
  return out;
}
