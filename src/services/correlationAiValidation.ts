import { AiCandidate, AiCandidatesResponse } from '../types/correlation';
import { isValidSymbolFormat } from './correlationUniverseService';

/**
 * Extracts a JSON object from a raw model response, tolerating a ```json fenced block
 * or surrounding prose, since providers do not always honor "JSON only" strictly.
 */
export function extractJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fence/object extraction
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    try {
      return JSON.parse(trimmed.slice(braceStart, braceEnd + 1));
    } catch {
      // fall through
    }
  }
  throw new Error('AI response was not valid JSON.');
}

/**
 * Validates the strict { candidates: [{ symbol, reason }] } schema, normalizes symbols,
 * discards invalid entries, and caps the result to `maxCount`. Never trusts a correlation
 * value from AI — this schema has no field for one, and any extra fields (e.g. a smuggled
 * "correlation") are silently dropped since only `symbol`/`reason` are ever read.
 */
export function validateAiCandidates(payload: unknown, maxCount: number): AiCandidate[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const candidatesRaw = (payload as Partial<AiCandidatesResponse>).candidates;
  if (!Array.isArray(candidatesRaw)) return [];

  const seen = new Set<string>();
  const out: AiCandidate[] = [];
  for (const entry of candidatesRaw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const symbolRaw = (entry as { symbol?: unknown }).symbol;
    if (typeof symbolRaw !== 'string') continue;
    const symbol = symbolRaw.trim().toUpperCase();
    if (!symbol || !isValidSymbolFormat(symbol) || seen.has(symbol)) continue;

    const reasonRaw = (entry as { reason?: unknown }).reason;
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 240) : '';

    seen.add(symbol);
    out.push({ symbol, reason });
    if (out.length >= maxCount) break;
  }
  return out;
}
