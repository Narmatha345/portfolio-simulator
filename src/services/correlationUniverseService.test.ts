import { buildCandidateInputs, correlationUniverse, parseCustomSymbols } from './correlationUniverseService';

describe('correlationUniverse data', () => {
  it('has between 200 and 300 assets', () => {
    expect(correlationUniverse.length).toBeGreaterThanOrEqual(200);
    expect(correlationUniverse.length).toBeLessThanOrEqual(300);
  });

  it('has no duplicate symbols', () => {
    const symbols = correlationUniverse.map((a) => a.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});

describe('parseCustomSymbols', () => {
  it('splits, trims, uppercases, and dedupes comma-separated symbols', () => {
    expect(parseCustomSymbols('aapl, MSFT ,aapl,, tsla')).toEqual(['AAPL', 'MSFT', 'TSLA']);
  });

  it('discards malformed symbols', () => {
    expect(parseCustomSymbols('AAPL, not a symbol!, <script>')).toEqual(['AAPL']);
  });
});

describe('buildCandidateInputs', () => {
  it('removes the primary ticker from the universe', () => {
    const inputs = buildCandidateInputs({
      primaryTicker: 'AAPL',
      universeSelection: 'stocks-and-etfs',
      customSymbols: [],
    });
    expect(inputs.find((c) => c.symbol === 'AAPL')).toBeUndefined();
  });

  it('filters the built-in universe by asset type', () => {
    const stocksOnly = buildCandidateInputs({
      primaryTicker: 'VGT',
      universeSelection: 'us-stocks',
      customSymbols: [],
    });
    expect(stocksOnly.every((c) => c.symbol !== 'SPY')).toBe(true); // SPY is an ETF

    const etfsOnly = buildCandidateInputs({
      primaryTicker: 'VGT',
      universeSelection: 'etfs',
      customSymbols: [],
    });
    expect(etfsOnly.some((c) => c.symbol === 'SPY')).toBe(true);
    expect(etfsOnly.every((c) => c.symbol !== 'AAPL')).toBe(true);
  });

  it('custom universe selection uses only custom symbols, ignoring the built-in list', () => {
    const inputs = buildCandidateInputs({
      primaryTicker: 'VGT',
      universeSelection: 'custom',
      customSymbols: ['AAPL', 'MSFT'],
    });
    expect(inputs.map((c) => c.symbol).sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('deduplicates across custom, AI, and universe sources (custom/AI take precedence)', () => {
    const inputs = buildCandidateInputs({
      primaryTicker: 'VGT',
      universeSelection: 'stocks-and-etfs',
      customSymbols: ['AAPL'],
      aiCandidates: [{ symbol: 'AAPL', reason: 'duplicate of custom' }, { symbol: 'MSFT', reason: 'tech giant' }],
    });
    const aaplEntries = inputs.filter((c) => c.symbol === 'AAPL');
    expect(aaplEntries).toHaveLength(1);
    expect(aaplEntries[0].source).toBe('custom');
    const msft = inputs.find((c) => c.symbol === 'MSFT');
    expect(msft?.source).toBe('ai');
    expect(msft?.aiReason).toBe('tech giant');
  });

  it('drops invalid custom symbols', () => {
    const inputs = buildCandidateInputs({
      primaryTicker: 'VGT',
      universeSelection: 'custom',
      customSymbols: ['AAPL', '<script>alert(1)</script>', ''],
    });
    expect(inputs.map((c) => c.symbol)).toEqual(['AAPL']);
  });
});
