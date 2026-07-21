import correlationUniverseData from '../data/correlationUniverse.json';
import { AssetUniverseSelection, CandidateInput, UniverseAsset } from '../types/correlation';

export const correlationUniverse: UniverseAsset[] = correlationUniverseData as UniverseAsset[];

const universeBySymbol = new Map<string, UniverseAsset>(correlationUniverse.map((a) => [a.symbol, a]));

export function lookupUniverseAsset(symbol: string): UniverseAsset | undefined {
  return universeBySymbol.get(symbol.trim().toUpperCase());
}

/** Yahoo Finance symbol shape: letters/digits plus the handful of separators Yahoo actually uses. */
const VALID_SYMBOL_PATTERN = /^[A-Z0-9.\-=^]{1,15}$/;

export function isValidSymbolFormat(symbol: string): boolean {
  return VALID_SYMBOL_PATTERN.test(symbol.trim().toUpperCase());
}

export function parseCustomSymbols(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0 && isValidSymbolFormat(s))
    )
  );
}

function universeForSelection(selection: AssetUniverseSelection): UniverseAsset[] {
  if (selection === 'us-stocks') return correlationUniverse.filter((a) => a.assetType === 'stock');
  if (selection === 'etfs') return correlationUniverse.filter((a) => a.assetType === 'etf');
  if (selection === 'stocks-and-etfs') return correlationUniverse;
  return [];
}

/**
 * Builds the candidate list for a scan: built-in universe (filtered by asset-type selection),
 * plus any custom symbols, plus validated AI-suggested symbols. Removes the primary ticker and
 * de-duplicates (custom/AI take precedence over the built-in universe entry for the same symbol).
 */
export function buildCandidateInputs(options: {
  primaryTicker: string;
  universeSelection: AssetUniverseSelection;
  customSymbols: string[];
  aiCandidates?: Array<{ symbol: string; reason: string }>;
}): CandidateInput[] {
  const primary = options.primaryTicker.trim().toUpperCase();
  const seen = new Set<string>([primary]);
  const out: CandidateInput[] = [];

  for (const symbol of options.customSymbols) {
    const s = symbol.trim().toUpperCase();
    if (!s || seen.has(s) || !isValidSymbolFormat(s)) continue;
    seen.add(s);
    out.push({ symbol: s, source: 'custom' });
  }

  for (const c of options.aiCandidates ?? []) {
    const s = c.symbol.trim().toUpperCase();
    if (!s || seen.has(s) || !isValidSymbolFormat(s)) continue;
    seen.add(s);
    out.push({ symbol: s, source: 'ai', aiReason: c.reason });
  }

  if (options.universeSelection !== 'custom') {
    for (const asset of universeForSelection(options.universeSelection)) {
      if (seen.has(asset.symbol)) continue;
      seen.add(asset.symbol);
      out.push({ symbol: asset.symbol, source: 'universe' });
    }
  }

  return out;
}
