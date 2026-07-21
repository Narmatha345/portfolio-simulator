import { alignByKey } from './align';
import { capAlignedToMaxPoints, restrictAlignedToDateRange } from './period';
import { pearsonCorrelation } from './pearson';
import { toDailyPoints, toMonthlyPoints, toWeeklyPoints } from './resample';
import { computePairedLogReturns } from './returns';
import {
  AlignedSeries,
  CorrelationFrequency,
  CorrelationHorizons,
  DateRange,
  HorizonResult,
  PairedReturns,
  PriceSeries,
} from './types';

export const MIN_OBSERVATIONS: Record<CorrelationFrequency, number> = {
  daily: 126,
  weekly: 52,
  monthly: 24,
  longTerm: 36,
};

/** Long-term horizon caps history at 10 years of monthly observations (i.e. 121 monthly prices -> 120 returns). */
export const LONG_TERM_MAX_MONTHLY_PRICES = 121;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toHorizonResult(frequency: CorrelationFrequency, minRequired: number, paired: PairedReturns): HorizonResult {
  const observations = paired.a.length;
  const startDate = observations > 0 ? isoDate(paired.dates[0]) : null;
  const endDate = observations > 0 ? isoDate(paired.dates[observations - 1]) : null;

  if (observations < minRequired) {
    return {
      frequency,
      correlation: null,
      observations,
      startDate,
      endDate,
      minRequired,
      available: false,
      reason: `Needs at least ${minRequired} overlapping observations; found ${observations}.`,
    };
  }

  const correlation = pearsonCorrelation(paired.a, paired.b);
  if (!Number.isFinite(correlation)) {
    return {
      frequency,
      correlation: null,
      observations,
      startDate,
      endDate,
      minRequired,
      available: false,
      reason: 'One of the return series has zero variance over this window.',
    };
  }

  return { frequency, correlation, observations, startDate, endDate, minRequired, available: true };
}

function resamplerFor(frequency: 'daily' | 'weekly' | 'monthly') {
  if (frequency === 'daily') return toDailyPoints;
  if (frequency === 'weekly') return toWeeklyPoints;
  return toMonthlyPoints;
}

/** Resampled, aligned, date-range-restricted adjusted-close price series (before returns are computed). */
export function alignedPricesForFrequency(
  primary: PriceSeries,
  candidate: PriceSeries,
  frequency: 'daily' | 'weekly' | 'monthly',
  dateRange: DateRange
): AlignedSeries {
  const resample = resamplerFor(frequency);
  const aligned: AlignedSeries = alignByKey(resample(primary), resample(candidate));
  return restrictAlignedToDateRange(aligned, dateRange);
}

export function alignedReturnsForFrequency(
  primary: PriceSeries,
  candidate: PriceSeries,
  frequency: 'daily' | 'weekly' | 'monthly',
  dateRange: DateRange
): PairedReturns {
  return computePairedLogReturns(alignedPricesForFrequency(primary, candidate, frequency, dateRange));
}

export function computeFrequencyHorizon(
  primary: PriceSeries,
  candidate: PriceSeries,
  frequency: 'daily' | 'weekly' | 'monthly',
  dateRange: DateRange
): HorizonResult {
  const paired = alignedReturnsForFrequency(primary, candidate, frequency, dateRange);
  return toHorizonResult(frequency, MIN_OBSERVATIONS[frequency], paired);
}

/** Monthly-resampled, aligned price series capped at the 10-year long-term window (before returns are computed). */
export function longTermAlignedPrices(primary: PriceSeries, candidate: PriceSeries): AlignedSeries {
  const aligned = alignByKey(toMonthlyPoints(primary), toMonthlyPoints(candidate));
  return capAlignedToMaxPoints(aligned, LONG_TERM_MAX_MONTHLY_PRICES);
}

export function longTermReturns(primary: PriceSeries, candidate: PriceSeries): PairedReturns {
  return computePairedLogReturns(longTermAlignedPrices(primary, candidate));
}

/** Long term is always monthly-return correlation over the longest common history, capped at 10 years. */
export function computeLongTermHorizon(primary: PriceSeries, candidate: PriceSeries): HorizonResult {
  const paired = longTermReturns(primary, candidate);
  return toHorizonResult('longTerm', MIN_OBSERVATIONS.longTerm, paired);
}

export function computeCorrelationHorizons(
  primary: PriceSeries,
  candidate: PriceSeries,
  dateRange: DateRange
): CorrelationHorizons {
  return {
    daily: computeFrequencyHorizon(primary, candidate, 'daily', dateRange),
    weekly: computeFrequencyHorizon(primary, candidate, 'weekly', dateRange),
    monthly: computeFrequencyHorizon(primary, candidate, 'monthly', dateRange),
    longTerm: computeLongTermHorizon(primary, candidate),
  };
}
