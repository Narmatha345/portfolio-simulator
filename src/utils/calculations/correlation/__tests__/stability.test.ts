import { classifyStability } from '../stability';

describe('classifyStability', () => {
  it('is Stable when the four horizon values are tightly clustered (range <= 0.20)', () => {
    expect(classifyStability([0.7, 0.75, 0.68, 0.72])).toBe('Stable');
  });

  it('is Mixed when the range is moderate (<= 0.40)', () => {
    expect(classifyStability([0.7, 0.5, 0.35, 0.6])).toBe('Mixed');
  });

  it('is Unstable when the range is large (> 0.40)', () => {
    expect(classifyStability([0.8, 0.1, -0.2, 0.5])).toBe('Unstable');
  });

  it('is Unavailable with fewer than two usable values', () => {
    expect(classifyStability([null, null, 0.5, undefined])).toBe('Unavailable');
    expect(classifyStability([])).toBe('Unavailable');
  });

  it('ignores null/undefined horizon values when scoring', () => {
    expect(classifyStability([0.7, null, 0.72, undefined])).toBe('Stable');
  });
});
