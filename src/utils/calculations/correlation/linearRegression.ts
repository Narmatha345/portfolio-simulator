export interface LinearRegressionResult {
  slope: number;
  intercept: number;
}

/** Ordinary least-squares fit of y = slope*x + intercept. */
export function linearRegression(x: number[], y: number[]): LinearRegressionResult | null {
  const n = x.length;
  if (n === 0 || y.length !== n) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    num += dx * (y[i] - meanY);
    den += dx * dx;
  }
  if (den === 0) return null;

  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}
