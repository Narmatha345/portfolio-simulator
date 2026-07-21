import { alignByKey } from '../align';
import { ResampledPoint } from '../types';

function point(dateStr: string, value: number): ResampledPoint {
  return { key: dateStr, date: new Date(dateStr), value };
}

describe('alignByKey', () => {
  it('keeps only common keys, preserving order of series A', () => {
    const a = [point('2024-01-01', 1), point('2024-01-02', 2), point('2024-01-03', 3)];
    const b = [point('2024-01-01', 10), point('2024-01-03', 30)];
    const aligned = alignByKey(a, b);
    expect(aligned.dates).toHaveLength(2);
    expect(aligned.a).toEqual([1, 3]);
    expect(aligned.b).toEqual([10, 30]);
  });

  it('returns an empty aligned series when there is no overlap (different calendars)', () => {
    const a = [point('2024-01-01', 1)];
    const b = [point('2024-02-01', 2)];
    const aligned = alignByKey(a, b);
    expect(aligned.dates).toHaveLength(0);
  });
});
