import { classifyCorrelation } from '../classify';

describe('classifyCorrelation', () => {
  it('classifies strong positive (+0.70 to +1.00)', () => {
    expect(classifyCorrelation(0.7).category).toBe('strong-positive');
    expect(classifyCorrelation(1.0).category).toBe('strong-positive');
    expect(classifyCorrelation(0.85).category).toBe('strong-positive');
  });

  it('classifies moderate positive (+0.30 to +0.69)', () => {
    expect(classifyCorrelation(0.3).category).toBe('moderate-positive');
    expect(classifyCorrelation(0.69).category).toBe('moderate-positive');
  });

  it('classifies low/uncorrelated (-0.29 to +0.29)', () => {
    expect(classifyCorrelation(0).category).toBe('low-uncorrelated');
    expect(classifyCorrelation(0.29).category).toBe('low-uncorrelated');
    expect(classifyCorrelation(-0.29).category).toBe('low-uncorrelated');
  });

  it('classifies moderate negative (-0.69 to -0.30)', () => {
    expect(classifyCorrelation(-0.3).category).toBe('moderate-negative');
    expect(classifyCorrelation(-0.69).category).toBe('moderate-negative');
  });

  it('classifies strong negative (-1.00 to -0.70)', () => {
    expect(classifyCorrelation(-0.7).category).toBe('strong-negative');
    expect(classifyCorrelation(-1.0).category).toBe('strong-negative');
  });

  it('never labels a negative relationship as "poorly correlated"', () => {
    const labels = [classifyCorrelation(-0.5).label, classifyCorrelation(-0.9).label];
    labels.forEach((l) => expect(l.toLowerCase()).not.toContain('poorly correlated'));
  });

  it('keeps low/uncorrelated and negative as distinct categories', () => {
    expect(classifyCorrelation(0).category).not.toBe(classifyCorrelation(-0.5).category);
  });
});
