function mean(values: number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Pearson product-moment correlation coefficient. Returns NaN for empty/mismatched/zero-variance input. */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || y.length !== n) return NaN;

  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) return NaN;
  return numerator / Math.sqrt(denomX * denomY);
}
