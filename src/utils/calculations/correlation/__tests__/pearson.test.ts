import { pearsonCorrelation } from '../pearson';

describe('pearsonCorrelation', () => {
  it('is +1 for a perfectly linear positive relationship', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 10);
  });

  it('is -1 for a perfectly linear inverse relationship', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 10);
  });

  it('matches a known fixture value', () => {
    // Fixture: sum(dx*dy)=40, sum(dx^2)=40, sum(dy^2)=40.8 -> 40/sqrt(40*40.8) = 0.990148...
    const x = [2, 4, 6, 8, 10];
    const y = [1, 3, 6, 7, 9];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(0.990148, 5);
  });

  it('is NaN for zero-variance input', () => {
    const x = [5, 5, 5, 5];
    const y = [1, 2, 3, 4];
    expect(Number.isNaN(pearsonCorrelation(x, y))).toBe(true);
  });

  it('is NaN for mismatched or empty arrays', () => {
    expect(Number.isNaN(pearsonCorrelation([1, 2], [1]))).toBe(true);
    expect(Number.isNaN(pearsonCorrelation([], []))).toBe(true);
  });
});
