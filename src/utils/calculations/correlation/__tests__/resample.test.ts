import { toDailyPoints, toMonthlyPoints, toWeeklyPoints } from '../resample';
import { ProcessedIndexData } from '../../../../types/index';

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day));
}

function series(points: Array<[number, number, number, number]>): ProcessedIndexData[] {
  return points.map(([y, m, day, nav]) => ({ date: d(y, m, day), nav }));
}

describe('toDailyPoints', () => {
  it('drops missing/invalid adjusted close rows', () => {
    const s = series([
      [2024, 1, 1, 100],
      [2024, 1, 2, NaN],
      [2024, 1, 3, -5],
      [2024, 1, 4, 105],
    ]);
    const points = toDailyPoints(s);
    expect(points.map((p) => p.value)).toEqual([100, 105]);
  });
});

describe('toWeeklyPoints', () => {
  it('keeps the final available trading day of each week (Mon-Sun)', () => {
    // Mon Jan 1 2024 .. Fri Jan 5 2024 is one week; Mon Jan 8 starts the next.
    const s = series([
      [2024, 1, 1, 100], // Mon
      [2024, 1, 3, 102], // Wed
      [2024, 1, 5, 105], // Fri (last of week 1)
      [2024, 1, 8, 110], // Mon (week 2)
      [2024, 1, 9, 111], // Tue (last of week 2)
    ]);
    const weekly = toWeeklyPoints(s);
    expect(weekly).toHaveLength(2);
    expect(weekly[0].value).toBe(105);
    expect(weekly[0].date).toEqual(d(2024, 1, 5));
    expect(weekly[1].value).toBe(111);
    expect(weekly[1].date).toEqual(d(2024, 1, 9));
  });
});

describe('toMonthlyPoints', () => {
  it('keeps the final available trading day of each calendar month', () => {
    const s = series([
      [2024, 1, 2, 100],
      [2024, 1, 31, 108],
      [2024, 2, 1, 109],
      [2024, 2, 28, 112],
    ]);
    const monthly = toMonthlyPoints(s);
    expect(monthly).toHaveLength(2);
    expect(monthly[0].value).toBe(108);
    expect(monthly[0].date).toEqual(d(2024, 1, 31));
    expect(monthly[1].value).toBe(112);
    expect(monthly[1].date).toEqual(d(2024, 2, 28));
  });
});
