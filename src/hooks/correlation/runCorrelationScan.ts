import { classifyCorrelation } from '../../utils/calculations/correlation/classify';
import { classifyStability } from '../../utils/calculations/correlation/stability';
import { computeCorrelationHorizons } from '../../utils/calculations/correlation/horizons';
import { AnalysisPeriod, CorrelationFrequency, CorrelationHorizons, PriceSeries } from '../../utils/calculations/correlation/types';
import { runWithConcurrency } from '../../utils/concurrency/runWithConcurrency';
import { CandidateInput, CorrelationCandidateRow, ScanProgress, UniverseAsset } from '../../types/correlation';

const OPTION_SYMBOL_PATTERN = /^[A-Z]{1,6}\d{6}[CP]\d{6,8}$/;

export function looksLikeOptionSymbol(symbol: string): boolean {
  return OPTION_SYMBOL_PATTERN.test(symbol.trim().toUpperCase());
}

function exchangeSuffix(symbol: string): string | null {
  const dot = symbol.indexOf('.');
  return dot >= 0 ? symbol.slice(dot) : null;
}

/** Lightweight heuristic: a different dotted exchange suffix than the primary ticker usually implies a different listing currency. */
export function currencyNoteFor(primaryTicker: string, candidateSymbol: string): string | undefined {
  const primarySuffix = exchangeSuffix(primaryTicker);
  const candidateSuffix = exchangeSuffix(candidateSymbol);
  if (primarySuffix !== candidateSuffix) {
    return 'Listed on a different exchange/currency than the primary ticker; correlation is still return-based, not currency-adjusted.';
  }
  return undefined;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Failed to load price data for this symbol.';
}

/** longTerm is the most representative default; falls back through monthly/weekly/daily when unavailable, or the user's selected frequency first. */
function pickPrimaryCorrelation(horizons: CorrelationHorizons, frequency: CorrelationFrequency): number | undefined {
  const order: CorrelationFrequency[] = [frequency, 'longTerm', 'monthly', 'weekly', 'daily'];
  for (const f of order) {
    const v = horizons[f]?.correlation;
    if (v !== null && v !== undefined) return v;
  }
  return undefined;
}

export interface RunScanDeps {
  fetchPriceData: (symbol: string) => Promise<PriceSeries>;
  lookupAsset: (symbol: string) => UniverseAsset | undefined;
  isCancelled: () => boolean;
  concurrency?: number;
}

export interface RunScanParams {
  primaryTicker: string;
  primaryPrices: PriceSeries;
  candidates: CandidateInput[];
  period: AnalysisPeriod;
  frequency: CorrelationFrequency;
  onProgress?: (progress: ScanProgress) => void;
  onRow?: (row: CorrelationCandidateRow) => void;
}

function baseRow(input: CandidateInput, asset: UniverseAsset | undefined): Pick<CorrelationCandidateRow, 'symbol' | 'name' | 'assetType' | 'source' | 'aiReason'> {
  return {
    symbol: input.symbol,
    name: asset?.name ?? input.symbol,
    assetType: asset?.assetType ?? 'unknown',
    source: input.source,
    aiReason: input.aiReason,
  };
}

export async function runCorrelationScan(params: RunScanParams, deps: RunScanDeps): Promise<void> {
  const total = params.candidates.length;
  let completed = 0;

  await runWithConcurrency({
    items: params.candidates,
    concurrency: deps.concurrency ?? 6,
    isCancelled: deps.isCancelled,
    worker: async (input) => {
      const asset = deps.lookupAsset(input.symbol);
      const prices = await deps.fetchPriceData(input.symbol);
      return { input, asset, prices };
    },
    onItemSettled: (settled) => {
      completed++;
      params.onProgress?.({ completed, total, currentSymbol: settled.item.symbol });

      if (settled.status === 'rejected') {
        const asset = deps.lookupAsset(settled.item.symbol);
        params.onRow?.({
          ...baseRow(settled.item, asset),
          status: 'invalid',
          errorMessage: describeError(settled.error),
        });
        return;
      }

      const { input, asset, prices } = settled.value;
      if (prices.length < 2) {
        params.onRow?.({ ...baseRow(input, asset), status: 'invalid', errorMessage: 'No price history available for this symbol.' });
        return;
      }

      const horizons = computeCorrelationHorizons(params.primaryPrices, prices, params.period);
      const anyAvailable = horizons.daily.available || horizons.weekly.available || horizons.monthly.available || horizons.longTerm.available;
      if (!anyAvailable) {
        params.onRow?.({
          ...baseRow(input, asset),
          status: 'insufficient-history',
          errorMessage: 'Not enough overlapping trading history with the primary ticker.',
          horizons,
        });
        return;
      }

      const primaryCorrelation = pickPrimaryCorrelation(horizons, params.frequency);
      const classification = primaryCorrelation !== undefined ? classifyCorrelation(primaryCorrelation) : undefined;
      const stability = classifyStability([
        horizons.daily.correlation,
        horizons.weekly.correlation,
        horizons.monthly.correlation,
        horizons.longTerm.correlation,
      ]);

      params.onRow?.({
        ...baseRow(input, asset),
        status: 'ready',
        horizons,
        category: classification?.category,
        categoryLabel: classification?.label,
        stability,
        primaryCorrelation,
        currencyNote: currencyNoteFor(params.primaryTicker, input.symbol),
        isOptionContract: looksLikeOptionSymbol(input.symbol),
      });
    },
  });
}
