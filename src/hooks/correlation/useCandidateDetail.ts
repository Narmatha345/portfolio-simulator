import { useEffect, useState } from 'react';
import { yahooFinanceService } from '../../services/yahooFinanceService';
import { linearRegression, LinearRegressionResult } from '../../utils/calculations/correlation/linearRegression';
import { alignedReturnsForFrequency, longTermReturns } from '../../utils/calculations/correlation/horizons';
import { computeRollingCorrelation, ROLLING_WINDOW_DEFAULTS, RollingCorrelationPoint } from '../../utils/calculations/correlation/rollingCorrelation';
import { CorrelationFrequency, DateRange, PriceSeries } from '../../utils/calculations/correlation/types';

export interface CandidateDetailData {
  loading: boolean;
  error: string | null;
  scatter: Array<{ x: number; y: number }>;
  regression: LinearRegressionResult | null;
  rolling: RollingCorrelationPoint[];
  rollingWindow: number;
  observations: number;
}

const EMPTY: CandidateDetailData = {
  loading: false,
  error: null,
  scatter: [],
  regression: null,
  rolling: [],
  rollingWindow: 0,
  observations: 0,
};

/** Re-derives scatter/regression/rolling-correlation data for one candidate on demand (cheap: price history is already cached). */
export function useCandidateDetail(
  primaryPrices: PriceSeries | null,
  symbol: string | null,
  frequency: CorrelationFrequency,
  dateRange: DateRange
): CandidateDetailData {
  const [data, setData] = useState<CandidateDetailData>(EMPTY);

  useEffect(() => {
    if (!primaryPrices || !symbol) {
      setData(EMPTY);
      return;
    }
    let cancelled = false;
    setData({ ...EMPTY, loading: true });

    (async () => {
      try {
        const candidatePrices = await yahooFinanceService.fetchStockData(symbol);
        if (cancelled) return;

        const rollingFrequency: 'daily' | 'weekly' | 'monthly' = frequency === 'longTerm' ? 'monthly' : frequency;
        const paired =
          frequency === 'longTerm'
            ? longTermReturns(primaryPrices, candidatePrices)
            : alignedReturnsForFrequency(primaryPrices, candidatePrices, rollingFrequency, dateRange);

        const scatter = paired.a.map((x, i) => ({ x, y: paired.b[i] }));
        const regression = linearRegression(paired.a, paired.b);
        const rollingWindow = ROLLING_WINDOW_DEFAULTS[rollingFrequency];
        const rolling = computeRollingCorrelation(paired, rollingWindow);

        if (!cancelled) {
          setData({
            loading: false,
            error: null,
            scatter,
            regression,
            rolling,
            rollingWindow,
            observations: paired.a.length,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setData({ ...EMPTY, loading: false, error: (err as Error).message || 'Failed to load candidate detail.' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryPrices, symbol, frequency, dateRange.startDate, dateRange.endDate]);

  return data;
}
