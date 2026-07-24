import { AiCandidate } from '../types/correlation';
import { isValidSymbolFormat } from './correlationUniverseService';

/**
 * Splits a raw AI response into candidate ticker strings. Tolerates a ```-fenced block or stray
 * prose around the list since providers do not always honor "comma-separated only" strictly, and
 * accepts newline-separated symbols as a fallback in case the model ignores the comma format.
 */
export function parseTickerListResponse(raw: string): string[] {
  const withoutFences = raw
    .trim()
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '');
  return withoutFences
    .split(/[,\n]/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
}

/**
 * Validates raw ticker strings against the Yahoo Finance symbol shape, dedupes them, and caps the
 * result to `maxCount`. Never carries a correlation value — the AI only ever supplies a symbol.
 */
export function validateAiTickers(tickers: string[], maxCount: number): AiCandidate[] {
  const seen = new Set<string>();
  const out: AiCandidate[] = [];
  for (const raw of tickers) {
    const symbol = raw.trim().toUpperCase();
    if (!symbol || !isValidSymbolFormat(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol, reason: '' });
    if (out.length >= maxCount) break;
  }
  return out;
}
