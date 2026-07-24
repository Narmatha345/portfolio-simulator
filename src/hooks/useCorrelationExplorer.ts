import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { runCorrelationScan } from './correlation/runCorrelationScan';
import { fetchAiCandidates } from '../services/correlationAiService';
import { buildCandidateInputs, lookupUniverseAsset, parseCustomSymbols } from '../services/correlationUniverseService';
import { yahooFinanceService } from '../services/yahooFinanceService';
import {
  AiCandidate,
  AiProvider,
  AssetUniverseSelection,
  CorrelationCandidateRow,
  ScanProgress,
} from '../types/correlation';
import { CorrelationFrequency, PriceSeries } from '../utils/calculations/correlation/types';
import { retryAsync } from '../utils/browser/retryAsync';

const DEFAULT_TICKER = 'VGT';
const DEFAULT_FREQUENCY: CorrelationFrequency = 'daily';
const DEFAULT_UNIVERSE: AssetUniverseSelection = 'stocks-and-etfs';
const SCAN_CONCURRENCY = 6;
const DEFAULT_AI_CANDIDATE_COUNT = 12;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateString(v: string | null): v is string {
  return !!v && DATE_PATTERN.test(v) && !Number.isNaN(Date.parse(v));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return toIsoDate(new Date());
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return toIsoDate(d);
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

export interface UseCorrelationExplorerResult {
  primaryTicker: string;
  setPrimaryTicker: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
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
  aiInstructions: string;
  setAiInstructions: (v: string) => void;

  isScanning: boolean;
  progress: ScanProgress | null;
  rows: CorrelationCandidateRow[];
  primaryPrices: PriceSeries | null;
  error: string | null;
  aiWarning: string | null;
  aiSuggestedTickers: AiCandidate[];

  runScan: () => Promise<void>;
  cancelScan: () => void;
  shareUrl: () => string;
}

export function useCorrelationExplorer(): UseCorrelationExplorerResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const [primaryTicker, setPrimaryTicker] = useState(() => (searchParams.get('ticker') || DEFAULT_TICKER).toUpperCase());
  const [startDate, setStartDate] = useState<string>(() => {
    const s = searchParams.get('start');
    return isDateString(s) ? s : defaultStartDate();
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const e = searchParams.get('end');
    return isDateString(e) ? e : defaultEndDate();
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
    return isAiProvider(p) ? p : 'chatgpt';
  });
  const [aiApiKey, setAiApiKey] = useState(''); // never persisted to the URL or beyond this session
  const [aiInstructions, setAiInstructions] = useState(() => searchParams.get('aiInstructions') ?? '');

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [rows, setRows] = useState<CorrelationCandidateRow[]>([]);
  const [primaryPrices, setPrimaryPrices] = useState<PriceSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiSuggestedTickers, setAiSuggestedTickers] = useState<AiCandidate[]>([]);

  const cancelledRef = useRef(false);

  const syncUrl = useCallback(() => {
    const next = new URLSearchParams();
    next.set('ticker', primaryTicker.trim().toUpperCase());
    next.set('start', startDate);
    next.set('end', endDate);
    next.set('frequency', frequency);
    next.set('universe', universeSelection);
    if (customSymbolsInput.trim()) next.set('custom', customSymbolsInput.trim());
    if (useAi) {
      next.set('ai', '1');
      next.set('aiProvider', aiProvider);
      if (aiInstructions.trim()) next.set('aiInstructions', aiInstructions.trim());
    }
    setSearchParams(next);
  }, [primaryTicker, startDate, endDate, frequency, universeSelection, customSymbolsInput, useAi, aiProvider, aiInstructions, setSearchParams]);

  const shareUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = '';
    const params = new URLSearchParams();
    params.set('ticker', primaryTicker.trim().toUpperCase());
    params.set('start', startDate);
    params.set('end', endDate);
    params.set('frequency', frequency);
    params.set('universe', universeSelection);
    if (customSymbolsInput.trim()) params.set('custom', customSymbolsInput.trim());
    if (useAi) {
      params.set('ai', '1');
      params.set('aiProvider', aiProvider);
      if (aiInstructions.trim()) params.set('aiInstructions', aiInstructions.trim());
    }
    return `${url.origin}${url.pathname}?${params.toString()}`;
  }, [primaryTicker, startDate, endDate, frequency, universeSelection, customSymbolsInput, useAi, aiProvider, aiInstructions]);

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
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before or equal to end date.');
      return;
    }

    cancelledRef.current = false;
    setIsScanning(true);
    setError(null);
    setAiWarning(null);
    setRows([]);
    setProgress(null);
    setPrimaryPrices(null);
    setAiSuggestedTickers([]);
    syncUrl();

    try {
      const primary = await retryAsync(() => yahooFinanceService.fetchStockData(ticker), { attempts: 3, baseDelayMs: 800 });
      if (cancelledRef.current) return;
      if (primary.length < 2) {
        setError(`Not enough price history for "${ticker}".`);
        return;
      }
      setPrimaryPrices(primary);

      let aiCandidates: AiCandidate[] = [];
      if (useAi) {
        try {
          aiCandidates = await fetchAiCandidates({
            provider: aiProvider,
            primaryTicker: ticker,
            startDate,
            endDate,
            frequency,
            instructions: aiInstructions.trim() || undefined,
            count: DEFAULT_AI_CANDIDATE_COUNT,
            apiKey: aiApiKey || undefined,
          });
        } catch (aiError) {
          setAiWarning((aiError as Error).message || 'AI candidate discovery failed.');
        }
        if (cancelledRef.current) return;
        setAiSuggestedTickers(aiCandidates);
      }

      const candidateInputs = buildCandidateInputs({
        primaryTicker: ticker,
        universeSelection,
        customSymbols: parseCustomSymbols(customSymbolsInput),
        aiCandidates,
      });

      if (candidateInputs.length === 0) {
        setError(
          useAi
            ? 'No candidates to scan. The AI did not return any usable ticker symbols — try adjusting your AI instructions, provider, or API key, or add custom symbols / choose a built-in universe.'
            : 'No candidates to scan. Add custom symbols or choose a built-in universe.'
        );
        return;
      }

      await runCorrelationScan(
        {
          primaryTicker: ticker,
          primaryPrices: primary,
          candidates: candidateInputs,
          dateRange: { startDate, endDate },
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
  }, [primaryTicker, startDate, endDate, frequency, universeSelection, customSymbolsInput, useAi, aiProvider, aiApiKey, aiInstructions, syncUrl]);

  return useMemo(
    () => ({
      primaryTicker,
      setPrimaryTicker,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
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
      aiInstructions,
      setAiInstructions,
      isScanning,
      progress,
      rows,
      primaryPrices,
      error,
      aiWarning,
      aiSuggestedTickers,
      runScan,
      cancelScan,
      shareUrl,
    }),
    [
      primaryTicker,
      startDate,
      endDate,
      frequency,
      universeSelection,
      customSymbolsInput,
      useAi,
      aiProvider,
      aiApiKey,
      aiInstructions,
      isScanning,
      progress,
      rows,
      primaryPrices,
      error,
      aiWarning,
      aiSuggestedTickers,
      runScan,
      cancelScan,
      shareUrl,
    ]
  );
}
