import { PriceSeries, ResampledPoint } from './types';

function toDailyKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Monday of the ISO week containing `d`, used as the weekly resample key. */
function toWeekMondayKey(d: Date): string {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return toDailyKey(monday);
}

/** Valid, positive, date-sorted adjusted-close points (drops missing/invalid adjusted close rows). */
export function toDailyPoints(series: PriceSeries): ResampledPoint[] {
  return series
    .filter((p) => Number.isFinite(p.nav) && p.nav > 0)
    .map((p) => ({ key: toDailyKey(p.date), date: p.date, value: p.nav }))
    .sort((x, y) => x.date.getTime() - y.date.getTime());
}

function resampleToLastObservationOf(series: PriceSeries, keyFn: (d: Date) => string): ResampledPoint[] {
  const daily = toDailyPoints(series);
  const byPeriod = new Map<string, ResampledPoint>();
  for (const p of daily) {
    // daily points are date-ascending, so the last write per period key is the final
    // available trading day of that period.
    byPeriod.set(keyFn(p.date), { key: keyFn(p.date), date: p.date, value: p.value });
  }
  return Array.from(byPeriod.values()).sort((x, y) => x.date.getTime() - y.date.getTime());
}

/** Resample to the final available trading day of each Mon-Sun week. */
export function toWeeklyPoints(series: PriceSeries): ResampledPoint[] {
  return resampleToLastObservationOf(series, toWeekMondayKey);
}

/** Resample to the final available trading day of each calendar month. */
export function toMonthlyPoints(series: PriceSeries): ResampledPoint[] {
  return resampleToLastObservationOf(series, toMonthKey);
}
