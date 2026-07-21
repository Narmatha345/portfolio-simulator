import { runCorrelationScan } from './runCorrelationScan';
import { CandidateInput, CorrelationCandidateRow, UniverseAsset } from '../../types/correlation';
import { ProcessedIndexData } from '../../types/index';

function businessDaySeries(count: number, priceFn: (i: number) => number): ProcessedIndexData[] {
  const out: ProcessedIndexData[] = [];
  let d = new Date(Date.UTC(2020, 0, 1));
  let i = 0;
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push({ date: new Date(d.getTime()), nav: priceFn(i) });
      i++;
    }
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

function upward(i: number): number {
  return 100 * Math.pow(1.0004, i) * (1 + 0.01 * Math.sin(i / 3));
}

const universe: Record<string, UniverseAsset> = {
  GOOD: { symbol: 'GOOD', name: 'Good Co', assetType: 'stock', category: 'equity' },
  SHORT: { symbol: 'SHORT', name: 'Short Co', assetType: 'stock', category: 'equity' },
};

describe('runCorrelationScan', () => {
  it('reports progress once per candidate and produces a ready row for a well-correlated candidate', async () => {
    const primaryPrices = businessDaySeries(300, upward);
    const candidates: CandidateInput[] = [{ symbol: 'GOOD', source: 'universe' }];
    const progressCalls: number[] = [];
    const rows: CorrelationCandidateRow[] = [];

    await runCorrelationScan(
      {
        primaryTicker: 'VGT',
        primaryPrices,
        candidates,
        dateRange: { startDate: '1990-01-01', endDate: '2100-01-01' },
        frequency: 'daily',
        onProgress: (p) => progressCalls.push(p.completed),
        onRow: (r) => rows.push(r),
      },
      {
        fetchPriceData: async () => businessDaySeries(300, (i) => upward(i) * 2),
        lookupAsset: (s) => universe[s],
        isCancelled: () => false,
      }
    );

    expect(progressCalls).toEqual([1]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ready');
    expect(rows[0].primaryCorrelation).toBeCloseTo(1, 5);
    expect(rows[0].category).toBe('strong-positive');
    expect(rows[0].stability).not.toBe('Unavailable');
  });

  it('marks a candidate invalid when the price fetch throws', async () => {
    const primaryPrices = businessDaySeries(300, upward);
    const rows: CorrelationCandidateRow[] = [];

    await runCorrelationScan(
      {
        primaryTicker: 'VGT',
        primaryPrices,
        candidates: [{ symbol: 'DELISTED', source: 'custom' }],
        dateRange: { startDate: '1990-01-01', endDate: '2100-01-01' },
        frequency: 'daily',
        onRow: (r) => rows.push(r),
      },
      {
        fetchPriceData: async () => {
          throw new Error('Ticker "DELISTED" not found');
        },
        lookupAsset: () => undefined,
        isCancelled: () => false,
      }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('invalid');
    expect(rows[0].errorMessage).toMatch(/not found/);
  });

  it('marks a candidate insufficient-history when common observations never meet any minimum', async () => {
    const primaryPrices = businessDaySeries(300, upward);
    const rows: CorrelationCandidateRow[] = [];

    await runCorrelationScan(
      {
        primaryTicker: 'VGT',
        primaryPrices,
        candidates: [{ symbol: 'SHORT', source: 'universe' }],
        dateRange: { startDate: '1990-01-01', endDate: '2100-01-01' },
        frequency: 'daily',
        onRow: (r) => rows.push(r),
      },
      {
        // Only 10 overlapping days -> below every minimum-observation threshold.
        fetchPriceData: async () => businessDaySeries(10, upward),
        lookupAsset: (s) => universe[s],
        isCancelled: () => false,
      }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('insufficient-history');
  });

  it('stops early once cancelled, leaving some candidates unresolved', async () => {
    const primaryPrices = businessDaySeries(300, upward);
    const candidates: CandidateInput[] = Array.from({ length: 20 }, (_, i) => ({ symbol: `C${i}`, source: 'universe' as const }));
    const rows: CorrelationCandidateRow[] = [];
    let cancelled = false;

    await runCorrelationScan(
      {
        primaryTicker: 'VGT',
        primaryPrices,
        candidates,
        dateRange: { startDate: '1990-01-01', endDate: '2100-01-01' },
        frequency: 'daily',
        onRow: (r) => {
          rows.push(r);
          if (rows.length === 2) cancelled = true;
        },
      },
      {
        fetchPriceData: async () => businessDaySeries(300, upward),
        lookupAsset: () => undefined,
        isCancelled: () => cancelled,
        concurrency: 1,
      }
    );

    expect(rows.length).toBeLessThan(candidates.length);
  });
});
