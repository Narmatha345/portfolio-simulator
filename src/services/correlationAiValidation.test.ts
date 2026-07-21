import { extractJsonPayload, validateAiCandidates } from './correlationAiValidation';

describe('extractJsonPayload', () => {
  it('parses plain JSON', () => {
    const payload = extractJsonPayload('{"candidates":[{"symbol":"QQQ","reason":"Tech ETF"}]}');
    expect(payload).toEqual({ candidates: [{ symbol: 'QQQ', reason: 'Tech ETF' }] });
  });

  it('extracts JSON from a ```json fenced block', () => {
    const raw = 'Sure, here you go:\n```json\n{"candidates":[{"symbol":"SPY"}]}\n```\nLet me know if you need more.';
    expect(extractJsonPayload(raw)).toEqual({ candidates: [{ symbol: 'SPY' }] });
  });

  it('extracts the outermost JSON object from surrounding prose', () => {
    const raw = 'Here are some ideas: {"candidates":[{"symbol":"GLD"}]} Hope that helps!';
    expect(extractJsonPayload(raw)).toEqual({ candidates: [{ symbol: 'GLD' }] });
  });

  it('throws when no JSON can be found', () => {
    expect(() => extractJsonPayload('I cannot help with that request.')).toThrow();
  });
});

describe('validateAiCandidates', () => {
  it('accepts well-formed candidates', () => {
    const result = validateAiCandidates(
      { candidates: [{ symbol: 'qqq', reason: 'Technology-heavy ETF' }] },
      10
    );
    expect(result).toEqual([{ symbol: 'QQQ', reason: 'Technology-heavy ETF' }]);
  });

  it('discards entries with a missing or malformed symbol', () => {
    const result = validateAiCandidates(
      {
        candidates: [
          { reason: 'no symbol field' },
          { symbol: 123, reason: 'symbol is not a string' },
          { symbol: '<script>alert(1)</script>', reason: 'malicious symbol' },
          { symbol: 'MSFT', reason: 'valid' },
        ],
      },
      10
    );
    expect(result).toEqual([{ symbol: 'MSFT', reason: 'valid' }]);
  });

  it('never accepts a correlation value even if the AI includes one', () => {
    const result = validateAiCandidates(
      { candidates: [{ symbol: 'AAPL', reason: 'valid', correlation: 0.95 }] },
      10
    );
    expect(result).toEqual([{ symbol: 'AAPL', reason: 'valid' }]);
    expect((result[0] as any).correlation).toBeUndefined();
  });

  it('deduplicates symbols and caps to the requested count', () => {
    const result = validateAiCandidates(
      {
        candidates: [
          { symbol: 'AAPL', reason: 'one' },
          { symbol: 'AAPL', reason: 'duplicate' },
          { symbol: 'MSFT', reason: 'two' },
          { symbol: 'GOOGL', reason: 'three' },
        ],
      },
      2
    );
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('defaults reason to an empty string when missing, and truncates long reasons', () => {
    const noReason = validateAiCandidates({ candidates: [{ symbol: 'AAPL' }] }, 10);
    expect(noReason[0].reason).toBe('');

    const longReason = 'x'.repeat(500);
    const truncated = validateAiCandidates({ candidates: [{ symbol: 'AAPL', reason: longReason }] }, 10);
    expect(truncated[0].reason.length).toBe(240);
  });

  it('returns an empty array for a malformed top-level payload', () => {
    expect(validateAiCandidates(null, 10)).toEqual([]);
    expect(validateAiCandidates({}, 10)).toEqual([]);
    expect(validateAiCandidates({ candidates: 'not an array' }, 10)).toEqual([]);
    expect(validateAiCandidates([{ symbol: 'AAPL' }], 10)).toEqual([]);
  });
});
