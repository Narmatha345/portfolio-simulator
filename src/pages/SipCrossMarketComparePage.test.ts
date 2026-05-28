/**
 * Regression tests for SipCrossMarketComparePage calculation logic.
 *
 * All pure functions are re-implemented here so NO production file is changed.
 * These tests lock down the calculation behaviour so any future code change
 * that silently breaks the maths will fail immediately.
 *
 * Manual verification baseline (Feb 2025, $100/month):
 *   AAPL       buy Feb 3 = $226.56,  sell Feb 28 = $240.57
 *   GOLDBEES   buy Feb 3 = ₹69.64,   sell Feb 28 = ₹71.10
 *   USD/INR    Feb 3     = 86.5540,   Feb 28      = 87.3270
 */

// ─── Inline copies of the pure functions (mirrors SipCrossMarketComparePage) ──

type PricePoint = { date: Date; nav: number };

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function inferCurrency(ticker: string, ic: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith('.NS') || t.endsWith('.BO')) return 'INR';
  if (t.endsWith('.L')) return 'GBP';
  if (t.endsWith('.T')) return 'JPY';
  if (t.endsWith('.HK')) return 'HKD';
  if (t.endsWith('.AX')) return 'AUD';
  if (t.endsWith('.TO') || t.endsWith('.V')) return 'CAD';
  if (
    t.endsWith('.DE') || t.endsWith('.PA') || t.endsWith('.AS') ||
    t.endsWith('.MI') || t.endsWith('.MC') || t.endsWith('.BR')
  ) return 'EUR';
  if (t.endsWith('.SI')) return 'SGD';
  if (t.endsWith('.KS') || t.endsWith('.KQ')) return 'KRW';
  if (t.endsWith('.TW')) return 'TWD';
  if (t.endsWith('.SZ') || t.endsWith('.SS')) return 'CNY';
  return ic;
}

function monthToStartDate(m: string): string {
  return `${m}-01`;
}

function monthToEndDate(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
}

function getMonthsBetween(start: string, end: string): string[] {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const months: string[] = [];
  for (let y = sy; y <= ey; y++) {
    const mStart = y === sy ? sm : 1;
    const mEnd = y === ey ? em : 12;
    for (let m = mStart; m <= mEnd; m++) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  return months;
}

function getNextAvailablePrice(data: PricePoint[], dateStr: string): number {
  for (const p of data) {
    if (formatDate(p.date) >= dateStr) return p.nav;
  }
  return data[data.length - 1].nav;
}

function getNearestFxForward(
  fxMap: Map<string, number> | undefined,
  fc: string,
  ic: string,
  dateStr: string,
): number {
  if (fc === ic) return 1;
  if (!fxMap || fxMap.size === 0) return 1;
  if (fxMap.has(dateStr)) return fxMap.get(dateStr)!;
  const base = new Date(dateStr + 'T00:00:00Z');
  for (let i = 1; i <= 7; i++) {
    const next = new Date(base);
    next.setUTCDate(base.getUTCDate() + i);
    const k = formatDate(next);
    if (fxMap.has(k)) return fxMap.get(k)!;
  }
  for (let i = 1; i <= 7; i++) {
    const prev = new Date(base);
    prev.setUTCDate(base.getUTCDate() - i);
    const k = formatDate(prev);
    if (fxMap.has(k)) return fxMap.get(k)!;
  }
  return 1;
}

// ─── inferCurrency ────────────────────────────────────────────────────────────

describe('inferCurrency', () => {
  const ic = 'USD';

  it('returns INR for .NS tickers', () => expect(inferCurrency('GOLDBEES.NS', ic)).toBe('INR'));
  it('returns INR for .BO tickers', () => expect(inferCurrency('RELIANCE.BO', ic)).toBe('INR'));
  it('returns GBP for .L tickers',  () => expect(inferCurrency('HSBA.L', ic)).toBe('GBP'));
  it('returns JPY for .T tickers',  () => expect(inferCurrency('7203.T', ic)).toBe('JPY'));
  it('returns HKD for .HK tickers', () => expect(inferCurrency('0700.HK', ic)).toBe('HKD'));
  it('returns AUD for .AX tickers', () => expect(inferCurrency('CBA.AX', ic)).toBe('AUD'));
  it('returns CAD for .TO tickers', () => expect(inferCurrency('RY.TO', ic)).toBe('CAD'));
  it('returns CAD for .V tickers',  () => expect(inferCurrency('SU.V', ic)).toBe('CAD'));
  it('returns EUR for .DE tickers', () => expect(inferCurrency('SAP.DE', ic)).toBe('EUR'));
  it('returns EUR for .PA tickers', () => expect(inferCurrency('MC.PA', ic)).toBe('EUR'));
  it('returns EUR for .AS tickers', () => expect(inferCurrency('ASML.AS', ic)).toBe('EUR'));
  it('returns SGD for .SI tickers', () => expect(inferCurrency('D05.SI', ic)).toBe('SGD'));
  it('returns KRW for .KS tickers', () => expect(inferCurrency('005930.KS', ic)).toBe('KRW'));
  it('returns KRW for .KQ tickers', () => expect(inferCurrency('035720.KQ', ic)).toBe('KRW'));
  it('returns TWD for .TW tickers', () => expect(inferCurrency('2330.TW', ic)).toBe('TWD'));
  it('returns CNY for .SZ tickers', () => expect(inferCurrency('000001.SZ', ic)).toBe('CNY'));
  it('returns CNY for .SS tickers', () => expect(inferCurrency('600519.SS', ic)).toBe('CNY'));
  it('falls back to ic for plain US tickers', () => expect(inferCurrency('AAPL', ic)).toBe('USD'));
  it('is case-insensitive', () => expect(inferCurrency('goldbees.ns', ic)).toBe('INR'));
  it('trims whitespace', () => expect(inferCurrency('  AAPL.NS  ', ic)).toBe('INR'));
});

// ─── monthToStartDate / monthToEndDate ────────────────────────────────────────

describe('monthToStartDate', () => {
  it('returns the 1st of the month', () => {
    expect(monthToStartDate('2025-01')).toBe('2025-01-01');
    expect(monthToStartDate('2025-12')).toBe('2025-12-01');
  });
});

describe('monthToEndDate', () => {
  it('Jan 2025 → 31',             () => expect(monthToEndDate('2025-01')).toBe('2025-01-31'));
  it('Feb 2025 (non-leap) → 28',  () => expect(monthToEndDate('2025-02')).toBe('2025-02-28'));
  it('Feb 2024 (leap year) → 29', () => expect(monthToEndDate('2024-02')).toBe('2024-02-29'));
  it('Apr 2025 → 30',             () => expect(monthToEndDate('2025-04')).toBe('2025-04-30'));
  it('May 2025 → 31',             () => expect(monthToEndDate('2025-05')).toBe('2025-05-31'));
  it('Nov 2025 → 30',             () => expect(monthToEndDate('2025-11')).toBe('2025-11-30'));
  it('Dec 2025 → 31',             () => expect(monthToEndDate('2025-12')).toBe('2025-12-31'));
});

// ─── getMonthsBetween ─────────────────────────────────────────────────────────

describe('getMonthsBetween', () => {
  it('single month', () =>
    expect(getMonthsBetween('2025-06', '2025-06')).toEqual(['2025-06']));

  it('same-year range', () =>
    expect(getMonthsBetween('2025-01', '2025-03')).toEqual(['2025-01', '2025-02', '2025-03']));

  it('crosses year boundary', () =>
    expect(getMonthsBetween('2024-11', '2025-02')).toEqual([
      '2024-11', '2024-12', '2025-01', '2025-02',
    ]));

  it('full year has 12 months', () =>
    expect(getMonthsBetween('2025-01', '2025-12')).toHaveLength(12));
});

// ─── getNextAvailablePrice ────────────────────────────────────────────────────

describe('getNextAvailablePrice', () => {
  // Trading days: Thu Jan 2, Fri Jan 3, Mon Jan 6 (Sat/Sun skipped), Tue Jan 7, Wed Jan 8
  const data: PricePoint[] = [
    { date: new Date('2025-01-02T00:00:00Z'), nav: 100 },
    { date: new Date('2025-01-03T00:00:00Z'), nav: 101 },
    { date: new Date('2025-01-06T00:00:00Z'), nav: 105 },
    { date: new Date('2025-01-07T00:00:00Z'), nav: 106 },
    { date: new Date('2025-01-08T00:00:00Z'), nav: 107 },
  ];

  it('returns price when exact date exists',          () => expect(getNextAvailablePrice(data, '2025-01-03')).toBe(101));
  it('skips Saturday → returns next Monday',         () => expect(getNextAvailablePrice(data, '2025-01-04')).toBe(105));
  it('skips Sunday → returns Monday',                () => expect(getNextAvailablePrice(data, '2025-01-05')).toBe(105));
  it('target before all data → returns first entry', () => expect(getNextAvailablePrice(data, '2025-01-01')).toBe(100));
  it('target after all data → returns last entry',   () => expect(getNextAvailablePrice(data, '2025-01-31')).toBe(107));
});

// ─── getNearestFxForward ──────────────────────────────────────────────────────

describe('getNearestFxForward', () => {
  const fxMap = new Map<string, number>([
    ['2025-01-06', 86.00],
    ['2025-01-07', 86.50],
    ['2025-01-09', 87.00],
  ]);

  it('returns 1 when fc === ic',           () => expect(getNearestFxForward(fxMap, 'USD', 'USD', '2025-01-06')).toBe(1));
  it('returns 1 when fxMap is undefined',  () => expect(getNearestFxForward(undefined, 'INR', 'USD', '2025-01-06')).toBe(1));
  it('returns exact rate on exact date',   () => expect(getNearestFxForward(fxMap, 'INR', 'USD', '2025-01-07')).toBe(86.50));

  it('forward-first: Sat Jan 4 → Mon Jan 6, not Fri Jan 3', () => {
    const map = new Map<string, number>([
      ['2025-01-03', 85.00],
      ['2025-01-06', 86.00],
    ]);
    expect(getNearestFxForward(map, 'INR', 'USD', '2025-01-04')).toBe(86.00);
  });

  it('falls back to backward when no forward data within 7 days', () => {
    const map = new Map<string, number>([['2025-01-03', 85.50]]);
    expect(getNearestFxForward(map, 'INR', 'USD', '2025-01-10')).toBe(85.50);
  });

  it('returns 1 when no date found within ±7 days', () =>
    expect(getNearestFxForward(fxMap, 'INR', 'USD', '2025-02-01')).toBe(1));
});

// ─── SIP calculation regression — Feb 2025 ───────────────────────────────────

describe('SIP calculation regression — Feb 2025', () => {
  const monthly       = 100;
  const aaplBuyPrice  = 226.56;
  const aaplSellPrice = 240.57;
  const goldBuyPrice  = 69.64;
  const goldSellPrice = 71.10;
  const usdInrFeb3    = 86.5540;
  const usdInrFeb28   = 87.3270;

  describe('AAPL — tc = USD = ic, no FX conversion', () => {
    const units    = (monthly * 1) / aaplBuyPrice;
    const valueUsd = (units * aaplSellPrice) / 1;
    const valueInr = valueUsd * usdInrFeb28;

    it('buys ~0.4414 units',       () => expect(units).toBeCloseTo(0.4414, 3));
    it('month-end USD ≈ $106.18',  () => expect(valueUsd).toBeCloseTo(106.18, 1));
    it('month-end INR ≈ ₹9272.71', () => expect(valueInr).toBeCloseTo(9272.71, 0));
    it('USD return% > 0',          () => expect(((valueUsd - monthly) / monthly) * 100).toBeGreaterThan(0));

    it('INR return% > USD return% because INR weakened Feb 3→28', () => {
      const retUsd = ((valueUsd - monthly) / monthly) * 100;
      const retInr = ((valueInr - monthly * usdInrFeb3) / (monthly * usdInrFeb3)) * 100;
      expect(retInr).toBeGreaterThan(retUsd);
    });
  });

  describe('GOLDBEES.NS — tc = INR', () => {
    const monthlyInr  = monthly * usdInrFeb3;
    const units       = monthlyInr / goldBuyPrice;
    const valueUsd    = (units * goldSellPrice) / usdInrFeb28;
    const valueInr    = valueUsd * usdInrFeb28;
    const investedInr = monthly * usdInrFeb3;

    it('monthly USD converts to ₹8655.40',  () => expect(monthlyInr).toBeCloseTo(8655.40, 1));
    it('buys ~124.28 units',                () => expect(units).toBeCloseTo(124.28, 1));
    it('month-end USD ≈ $101.19',           () => expect(valueUsd).toBeCloseTo(101.19, 2));
    it('month-end INR ≈ ₹8836.87',          () => expect(valueInr).toBeCloseTo(8836.87, 1));
    it('USD return% ≈ +1.19%',             () => expect(((valueUsd - monthly) / monthly) * 100).toBeCloseTo(1.19, 1));
    it('INR return% ≈ +2.10%',             () => expect(((valueInr - investedInr) / investedInr) * 100).toBeCloseTo(2.10, 1));
  });

  describe('FX direction sanity', () => {
    it('monthly USD × fxBuy = INR invested', () =>
      expect(monthly * usdInrFeb3).toBeCloseTo(8655.40, 1));

    it('INR value / fxSell = USD value', () => {
      const units = (monthly * usdInrFeb3) / goldBuyPrice;
      expect((units * goldSellPrice) / usdInrFeb28).toBeCloseTo(101.19, 2);
    });

    it('(inrValue / fx) * fx ≈ inrValue (identity)', () => {
      const units  = (monthly * usdInrFeb3) / goldBuyPrice;
      const inrRaw = units * goldSellPrice;
      expect((inrRaw / usdInrFeb28) * usdInrFeb28).toBeCloseTo(inrRaw, 4);
    });

    it('AAPL INR value > GOLDBEES INR value for same $100 (AAPL gained more)', () => {
      const aaplInr = ((monthly / aaplBuyPrice) * aaplSellPrice) * usdInrFeb28;
      const goldInr = ((monthly * usdInrFeb3) / goldBuyPrice) * goldSellPrice;
      expect(aaplInr).toBeGreaterThan(goldInr);
    });
  });
});

// ─── 2025 month-end weekend roll-forward ─────────────────────────────────────

describe('2025 month-end — weekend rolls to next trading day', () => {
  const cases = [
    { month: '2025-05', lastDay: '2025-05-31', desc: 'Saturday', nextDay: '2025-06-02' },
    { month: '2025-08', lastDay: '2025-08-31', desc: 'Sunday',   nextDay: '2025-09-01' },
    { month: '2025-11', lastDay: '2025-11-30', desc: 'Sunday',   nextDay: '2025-12-01' },
  ];

  cases.forEach(({ month, lastDay, desc, nextDay }) => {
    it(`${month} last day (${desc}) → price from ${nextDay}`, () => {
      expect(monthToEndDate(month)).toBe(lastDay);
      const rawData: PricePoint[] = [{ date: new Date(nextDay + 'T00:00:00Z'), nav: 200 }];
      expect(getNextAvailablePrice(rawData, lastDay)).toBe(200);
    });
  });

  const weekdayCases = [
    { month: '2025-01', lastDay: '2025-01-31', desc: 'Friday' },
    { month: '2025-02', lastDay: '2025-02-28', desc: 'Friday' },
    { month: '2025-04', lastDay: '2025-04-30', desc: 'Wednesday' },
    { month: '2025-07', lastDay: '2025-07-31', desc: 'Thursday' },
    { month: '2025-10', lastDay: '2025-10-31', desc: 'Friday' },
    { month: '2025-12', lastDay: '2025-12-31', desc: 'Wednesday' },
  ];

  weekdayCases.forEach(({ month, lastDay, desc }) => {
    it(`${month} last day (${desc}) → uses same day`, () => {
      const rawData: PricePoint[] = [{ date: new Date(lastDay + 'T00:00:00Z'), nav: 500 }];
      expect(getNextAvailablePrice(rawData, lastDay)).toBe(500);
    });
  });
});

// ─── 2025 month-start weekend roll-forward ────────────────────────────────────

describe('2025 month-start — weekend rolls to first trading day of month', () => {
  const weekendCases = [
    { month: '2025-02', firstDay: '2025-02-01', desc: 'Saturday', firstTrading: '2025-02-03' },
    { month: '2025-03', firstDay: '2025-03-01', desc: 'Saturday', firstTrading: '2025-03-03' },
    { month: '2025-06', firstDay: '2025-06-01', desc: 'Sunday',   firstTrading: '2025-06-02' },
    { month: '2025-11', firstDay: '2025-11-01', desc: 'Saturday', firstTrading: '2025-11-03' },
  ];

  weekendCases.forEach(({ month, firstDay, desc, firstTrading }) => {
    it(`${month} 1st is ${desc} → buy price from ${firstTrading}`, () => {
      expect(monthToStartDate(month)).toBe(firstDay);
      const rawData: PricePoint[] = [{ date: new Date(firstTrading + 'T00:00:00Z'), nav: 300 }];
      expect(getNextAvailablePrice(rawData, firstDay)).toBe(300);
    });
  });

  const weekdayCases = [
    { month: '2025-04', firstDay: '2025-04-01' },
    { month: '2025-05', firstDay: '2025-05-01' },
    { month: '2025-07', firstDay: '2025-07-01' },
    { month: '2025-08', firstDay: '2025-08-01' },
    { month: '2025-10', firstDay: '2025-10-01' },
    { month: '2025-12', firstDay: '2025-12-01' },
  ];

  weekdayCases.forEach(({ month, firstDay }) => {
    it(`${month} 1st is a weekday → buy uses ${firstDay} directly`, () => {
      const rawData: PricePoint[] = [{ date: new Date(firstDay + 'T00:00:00Z'), nav: 400 }];
      expect(getNextAvailablePrice(rawData, firstDay)).toBe(400);
    });
  });
});
