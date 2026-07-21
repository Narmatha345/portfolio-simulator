import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { runCorrelationScan } from './correlation/runCorrelationScan';
import { fetchAiCandidates } from '../services/correlationAiService';
import { buildCandidateInputs, lookupUniverseAsset, parseCustomSymbols } from '../services/correlationUniverseService';
import { yahooFinanceService } from '../services/yahooFinanceService';
import {
  AiProvider,
  AssetUniverseSelection,
  CorrelationCandidateRow,
  ScanProgress,
  UniverseAssetType,
} from '../types/correlation';
import { AnalysisPeriod, CorrelationFrequency, PriceSeries } from '../utils/calculations/correlation/types';
import { retryAsync } from '../utils/browser/retryAsync';

const DEFAULT_TICKER = 'VGT';
const DEFAULT_PERIOD: AnalysisPeriod = '5y';
const DEFAULT_FREQUENCY: CorrelationFrequency = 'daily';
const DEFAULT_UNIVERSE: AssetUniverseSelection = 'stocks-and-etfs';
const SCAN_CONCURRENCY = 6;
const DEFAULT_AI_CANDIDATE_COUNT = 12;

function isPeriod(v: string | null): v is AnalysisPeriod {
  return v === '1y' || v === '3y' || v === '5y' || v === '10y' || v === 'max';
}

function isFrequency(v: string | null): v is CorrelationFrequency {
  return v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'longTerm';
}

function isUniverse(v: string | null): v is AssetUniverseSelection {
  return v === 'us-stocks' || v === 'etfs' || v === 'stocks-and-etfs' || v === 'custom';
}

function isAiProvider(v: string | null): v is AiProvider {
  return v === 'gemini' || v === 'chatgpt' || v === 'claude';
}

function assetTypesForUniverse(selection: AssetUniverseSelection): UniverseAssetType[] {
  if (selection === 'us-stocks') return ['stock'];
  if (selection === 'etfs') return ['etf'];
  return ['stock', 'etf'];
}

export interface UseCorrelationExplorerResult {
  primaryTicker: string;
  setPrimaryTicker: (v: string) => void;
  period: AnalysisPeriod;
  setPeriod: (v: AnalysisPeriod) => void;
  frequency: CorrelationFrequency;
  setFrequency: (v: CorrelationFrequency) => void;
  universeSelection: AssetUniverseSelection;
  setUniverseSelection: (v: AssetUniverseSelection) => void;
  customSymbolsInput: string;
  setCustomSymbolsInput: (v: string) => void;
  useAi: boolean;
  setUseAi: (v: boolean) => void;
  aiProvider: AiProvider;
  setAiProvider: (v: AiProvider) => void;
  aiApiKey: string;
  setAiApiKey: (v: string) => void;

  isScanning: boolean;
  progress: ScanProgress | null;
  rows: CorrelationCandidateRow[];
  primaryPrices: PriceSeries | null;
  error: string | null;
  aiWarning: string | null;

  runScan: () => Promise<void>;
  cancelScan: () => void;
  shareUrl: () => string;
}

export function useCorrelationExplorer(): UseCorrelationExplorerResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const [primaryTicker, setPrimaryTicker] = useState(() => (searchParams.get('ticker') || DEFAULT_TICKER).toUpperCase());
  const [period, setPeriod] = useState<AnalysisPeriod>(() => {
    const p = searchParams.get('period');
    return isPeriod(p) ? p : DEFAULT_PERIOD;
  });
  const [frequency, setFrequency] = useState<CorrelationFrequency>(() => {
    const f = searchParams.get('frequency');
    return isFrequency(f) ? f : DEFAULT_FREQUENCY;
  });
  const [universeSelection, setUniverseSelection] = useState<AssetUniverseSelection>(() => {
    const u = searchParams.get('universe');
    return isUniverse(u) ? u : DEFAULT_UNIVERSE;
  });
  const [customSymbolsInput, setCustomSymbolsInput] = useState(() => searchParams.get('custom') ?? '');
  const [useAi, setUseAi] = useState(() => searchParams.get('ai') === '1');
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => {
    const p = searchParams.get('aiProvider');
    return isAiProvider(p) ? p : 'gemini';
  });
  const [aiApiKey, setAiApiKey] = useState(''); // never persisted to the URL or beyond this session

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [rows, setRows] = useState<CorrelationCandidateRow[]>([]);
  const [primaryPrices, setPrimaryPrices] = useState<PriceSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  const cancelledRef = useRef(false);

  const syncUrl = useCallback(() => {
    const next = new URLSearchParams();
    next.set('ticker', primaryTicker.trim().toUpperCase());
    next.set('period', period);
    next.set('frequency', frequency);
    next.set('universe', universeSelection);
    if (customSymbolsInput.trim()) next.set('custom', customSymbolsInput.trim());
    if (useAi) {
      next.set('ai', '1');
      next.set('aiProvider', aiProvider);
    }
    setSearchParams(next);
  }, [primaryTicker, period, frequency, universeSelection, customSymbolsInput, useAi, aiProvider, setSearchParams]);

  const shareUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = '';
    const params = new URLSearchParams();
    params.set('ticker', primaryTicker.trim().toUpperCase());
    params.set('period', period);
    params.set('frequency', frequency);
    params.set('universe', universeSelection);
    if (customSymbolsInput.trim()) params.set('custom', customSymbolsInput.trim());
    if (useAi) {
      params.set('ai', '1');
      params.set('aiProvider', aiProvider);
    }
    return `${url.origin}${url.pathname}?${params.toString()}`;
  }, [primaryTicker, period, frequency, universeSelection, customSymbolsInput, useAi, aiProvider]);

  const cancelScan = useCallback(() => {
    cancelledRef.current = true;
    setIsScanning(false);
  }, []);

  const runScan = useCallback(async () => {
    const ticker = primaryTicker.trim().toUpperCase();
    if (!ticker) {
      setError('Enter a primary ticker.');
      return;
    }

    cancelledRef.current = false;
    setIsScanning(true);
    setError(null);
    setAiWarning(null);
    setRows([]);
    setProgress(null);
    setPrimaryPrices(null);
    syncUrl();

    try {
      const primary = await retryAsync(() => yahooFinanceService.fetchStockData(ticker), { attempts: 3, baseDelayMs: 800 });
      if (cancelledRef.current) return;
      if (primary.length < 2) {
        setError(`Not enough price history for "${ticker}".`);
        return;
      }
      setPrimaryPrices(primary);

      let aiCandidates: Array<{ symbol: string; reason: string }> = [];
      if (useAi) {
        try {
          aiCandidates = await fetchAiCandidates({
            provider: aiProvider,
            primaryTicker: ticker,
            allowedAssetTypes: assetTypesForUniverse(universeSelection === 'custom' ? 'stocks-and-etfs' : universeSelection),
            count: DEFAULT_AI_CANDIDATE_COUNT,
            apiKey: aiApiKey || undefined,
          });
        } catch (aiError) {
          setAiWarning((aiError as Error).message || 'AI candidate discovery failed; continuing with the built-in universe only.');
        }
      }
      if (cancelledRef.current) return;

      const candidateInputs = buildCandidateInputs({
        primaryTicker: ticker,
        universeSelection,
        customSymbols: parseCustomSymbols(customSymbolsInput),
        aiCandidates,
      });

      if (candidateInputs.length === 0) {
        setError('No candidates to scan. Add custom symbols or choose a built-in universe.');
        return;
      }

      await runCorrelationScan(
        {
          primaryTicker: ticker,
          primaryPrices: primary,
          candidates: candidateInputs,
          period,
          frequency,
          onProgress: (p) => setProgress(p),
          onRow: (row) =>
            setRows((prev) => {
              const idx = prev.findIndex((r) => r.symbol === row.symbol);
              if (idx === -1) return [...prev, row];
              const copy = prev.slice();
              copy[idx] = row;
              return copy;
            }),
        },
        {
          fetchPriceData: (symbol) =>
            retryAsync(() => yahooFinanceService.fetchStockData(symbol), { attempts: 3, baseDelayMs: 600 }),
          lookupAsset: lookupUniverseAsset,
          isCancelled: () => cancelledRef.current,
          concurrency: SCAN_CONCURRENCY,
        }
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to run the correlation scan.');
    } finally {
      setIsScanning(false);
    }
  }, [primaryTicker, period, frequency, universeSelection, customSymbolsInput, useAi, aiProvider, aiApiKey, syncUrl]);

  return useMemo(
    () => ({
      primaryTicker,
      setPrimaryTicker,
      period,
      setPeriod,
      frequency,
      setFrequency,
      universeSelection,
      setUniverseSelection,
      customSymbolsInput,
      setCustomSymbolsInput,
      useAi,
      setUseAi,
      aiProvider,
      setAiProvider,
      aiApiKey,
      setAiApiKey,
      isScanning,
      progress,
      rows,
      primaryPrices,
      error,
      aiWarning,
      runScan,
      cancelScan,
      shareUrl,
    }),
    [
      primaryTicker,
      period,
      frequency,
      universeSelection,
      customSymbolsInput,
      useAi,
      aiProvider,
      aiApiKey,
      isScanning,
      progress,
      rows,
      primaryPrices,
      error,
      aiWarning,
      runScan,
      cancelScan,
      shareUrl,
    ]
  );
}
