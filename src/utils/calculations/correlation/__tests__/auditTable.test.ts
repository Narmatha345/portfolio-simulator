import { buildCalculationAuditTable } from '../auditTable';
import { pearsonCorrelation } from '../pearson';
import { DateRange } from '../types';
import { ProcessedIndexData } from '../../../../types/index';

const WIDE_RANGE: DateRange = { startDate: '1990-01-01', endDate: '2100-01-01' };

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day));
}

function series(points: Array<[number, number, number, number]>): ProcessedIndexData[] {
  return points.map(([y, m, day, nav]) => ({ date: d(y, m, day), nav }));
}

describe('buildCalculationAuditTable', () => {
  it('returns one row per aligned date, with the first row having a blank return', () => {
    const primary = series([
      [2024, 1, 2, 100],
      [2024, 1, 3, 110],
      [2024, 1, 4, 121],
    ]);
    const candidate = series([
      [2024, 1, 2, 50],
      [2024, 1, 3, 55],
      [2024, 1, 4, 60.5],
    ]);

    const rows = buildCalculationAuditTable(primary, candidate, 'daily', WIDE_RANGE);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ date: '2024-01-02', primaryClose: 100, candidateClose: 50, primaryReturn: null, candidateReturn: null });
    expect(rows[1].primaryReturn).toBeCloseTo(Math.log(1.1), 10);
    expect(rows[1].candidateReturn).toBeCloseTo(Math.log(1.1), 10);
    expect(rows[2].date).toBe('2024-01-04');
  });

  it('only includes dates common to both series (different calendars)', () => {
    const primary = series([
      [2024, 1, 2, 100],
      [2024, 1, 3, 101],
      [2024, 1, 4, 102],
    ]);
    const candidate = series([
      [2024, 1, 2, 50],
      [2024, 1, 4, 51],
    ]);

    const rows = buildCalculationAuditTable(primary, candidate, 'daily', WIDE_RANGE);

    expect(rows.map((r) => r.date)).toEqual(['2024-01-02', '2024-01-04']);
  });

  it('the return columns it produces reproduce the same Pearson correlation as the deterministic engine', () => {
    // Build a longer series so the shape matches real usage, and confirm the audit table's own
    // return columns yield the same correlation a user could compute by hand from this table.
    const primary = series(
      Array.from({ length: 40 }, (_, i) => [2024, 1, i + 1, 100 * Math.pow(1.001, i)] as [number, number, number, number])
    );
    const candidate = series(
      Array.from({ length: 40 }, (_, i) => [2024, 1, i + 1, 50 * Math.pow(1.001, i) * 2] as [number, number, number, number])
    );

    const rows = buildCalculationAuditTable(primary, candidate, 'daily', WIDE_RANGE);
    const returnRows = rows.filter((r) => r.primaryReturn !== null && r.candidateReturn !== null);
    const correlation = pearsonCorrelation(
      returnRows.map((r) => r.primaryReturn as number),
      returnRows.map((r) => r.candidateReturn as number)
    );

    expect(correlation).toBeCloseTo(1, 6);
  });

  it('uses monthly resampling and the 10-year cap for the long-term frequency', () => {
    const primary = Array.from({ length: 200 }, (_, i) => {
      const y = 2000 + Math.floor(i / 12);
      const m = (i % 12) + 1;
      return { date: new Date(Date.UTC(y, m - 1, 28)), nav: 100 * Math.pow(1.002, i) };
    });
    const candidate = primary.map((p) => ({ date: p.date, nav: p.nav * 3 }));

    // A deliberately narrow range: if long-term respected it, almost every row would be excluded.
    const rows = buildCalculationAuditTable(primary, candidate, 'longTerm', { startDate: '2023-01-01', endDate: '2023-01-02' });

    // Capped at 121 monthly prices (120 returns) even though 200 months are available,
    // and NOT restricted to the narrow date range above (long-term ignores it).
    expect(rows).toHaveLength(121);
  });
});
