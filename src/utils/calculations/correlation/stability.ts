export type StabilityRating = 'Stable' | 'Mixed' | 'Unstable' | 'Unavailable';

/**
 * Deterministic dispersion across the four horizon correlation values (daily,
 * weekly, monthly, long-term): range = max - min of the available values.
 * range <= 0.20 -> Stable, range <= 0.40 -> Mixed, otherwise Unstable.
 * Fewer than 2 available horizon values cannot be scored -> Unavailable.
 * This is a pure function of already-calculated correlations; never AI-classified.
 */
export function classifyStability(values: Array<number | null | undefined>): StabilityRating {
  const available = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  if (available.length < 2) return 'Unavailable';
  const range = Math.max(...available) - Math.min(...available);
  if (range <= 0.2) return 'Stable';
  if (range <= 0.4) return 'Mixed';
  return 'Unstable';
}
