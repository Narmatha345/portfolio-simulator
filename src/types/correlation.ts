import { CorrelationCategory } from '../utils/calculations/correlation/classify';
import { CorrelationHorizons } from '../utils/calculations/correlation/types';
import { StabilityRating } from '../utils/calculations/correlation/stability';

export type UniverseAssetType = 'stock' | 'etf';

export type UniverseCategory = 'equity' | 'equity-etf' | 'diversifier' | 'international';

/** One entry in the built-in candidate universe (src/data/correlationUniverse.json). */
export interface UniverseAsset {
  symbol: string;
  name: string;
  assetType: UniverseAssetType;
  category: UniverseCategory;
}

export type AssetUniverseSelection = 'us-stocks' | 'etfs' | 'stocks-and-etfs' | 'custom';

export type AiProvider = 'gemini' | 'chatgpt' | 'claude';

/** Strict AI candidate-discovery response contract — AI may only ever suggest symbols + a rationale. */
export interface AiCandidateRaw {
  symbol: string;
  reason?: string;
}

export interface AiCandidatesResponse {
  candidates: AiCandidateRaw[];
}

/** A validated, normalized AI-suggested candidate (schema-checked, never carries a correlation value). */
export interface AiCandidate {
  symbol: string;
  reason: string;
}

export type CandidateSourceType = 'universe' | 'custom' | 'ai';

export interface CandidateInput {
  symbol: string;
  source: CandidateSourceType;
  aiReason?: string;
}

export type CandidateStatus = 'pending' | 'loading' | 'ready' | 'invalid' | 'insufficient-history' | 'error';

/** A fully-resolved candidate row: deterministic correlation results + optional AI-sourced rationale. */
export interface CorrelationCandidateRow {
  symbol: string;
  name: string;
  assetType: UniverseAssetType | 'unknown';
  source: CandidateSourceType;
  aiReason?: string;
  status: CandidateStatus;
  errorMessage?: string;
  horizons?: CorrelationHorizons;
  category?: CorrelationCategory;
  categoryLabel?: string;
  stability?: StabilityRating;
  /** Sort key: long-term correlation if available, else monthly, weekly, daily (first available horizon). */
  primaryCorrelation?: number;
  currencyNote?: string;
  isOptionContract?: boolean;
}

export interface ScanProgress {
  completed: number;
  total: number;
  currentSymbol?: string;
}
