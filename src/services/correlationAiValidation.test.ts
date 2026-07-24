import { parseTickerListResponse, validateAiTickers } from './correlationAiValidation';

describe('parseTickerListResponse', () => {
  it('splits a plain comma-separated list', () => {
    expect(parseTickerListResponse('TCS, INFY, HCLTECH, WIPRO, LTIM')).toEqual([
      'TCS',
      'INFY',
      'HCLTECH',
      'WIPRO',
      'LTIM',
    ]);
  });

  it('strips a ```-fenced block', () => {
    const raw = '```\nTCS, INFY, HCLTECH\n```';
    expect(parseTickerListResponse(raw)).toEqual(['TCS', 'INFY', 'HCLTECH']);
  });

  it('falls back to newline separation when the model ignores commas', () => {
    const raw = 'TCS\nINFY\nHCLTECH';
    expect(parseTickerListResponse(raw)).toEqual(['TCS', 'INFY', 'HCLTECH']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseTickerListResponse('')).toEqual([]);
    expect(parseTickerListResponse('   ')).toEqual([]);
  });
});

describe('validateAiTickers', () => {
  it('accepts well-formed tickers with an empty reason', () => {
    const result = validateAiTickers(['qqq'], 10);
    expect(result).toEqual([{ symbol: 'QQQ', reason: '' }]);
  });

  it('discards malformed or malicious entries', () => {
    const result = validateAiTickers(['<script>alert(1)</script>', '', 'MSFT'], 10);
    expect(result).toEqual([{ symbol: 'MSFT', reason: '' }]);
  });

  it('deduplicates symbols and caps to maxCount', () => {
    const result = validateAiTickers(['AAPL', 'AAPL', 'MSFT', 'GOOGL'], 2);
    expect(result.map((c) => c.symbol)).toEqual(['AAPL', 'MSFT']);
  });
});
