import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { HeadingXSmall, LabelMedium, LabelSmall, ParagraphMedium } from 'baseui/typography';
import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Highcharts from 'highcharts/highstock';
import HighchartsReactOriginal from 'highcharts-react-official';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { PageCard, PageIntro } from '../components/common/PageChrome';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { CHART_STYLES } from '../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../utils/stockChartConfig';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HighchartsReact = HighchartsReactOriginal as any;

type DataPoint = { date: Date; nav: number };

type TableRow = {
  date: string;
  stockPrice: number;
  fxRate: number;
  localValue: number;
  targetValue: number;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  HKD: 'HK$',
  SGD: 'S$',
  KRW: '₩',
  BRL: 'R$',
  MXN: 'MX$',
  ZAR: 'R',
  RUB: '₽',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  NZD: 'NZ$',
  THB: '฿',
  IDR: 'Rp',
  MYR: 'RM',
  PHP: '₱',
  TRY: '₺',
  AED: 'د.إ',
  SAR: '﷼',
  NGN: '₦',
  TWD: 'NT$',
  CZK: 'Kč',
  HUF: 'Ft',
  PLN: 'zł',
  ILS: '₪',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  VND: '₫',
  BDT: '৳',
  PKR: '₨',
  LKR: '₨',
};

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

function formatCurrency(value: number, currencyCode: string): string {
  const sym = getCurrencySymbol(currencyCode);
  const absVal = Math.abs(value);
  let formatted: string;
  if (absVal >= 1_000_000) {
    formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (absVal >= 1) {
    formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    formatted = value.toFixed(4);
  }
  return `${sym}${formatted}`;
}

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const dateInputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  fontFamily: 'inherit',
  backgroundColor: '#fff',
  cursor: 'pointer',
};

const TABLE_HEADERS = [
  'Date',
  'Stock Price',
  'FX Rate',
  'Local Value',
  'Target Value',
];

export default function NetworthCurrencyPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  // Controlled inputs — initialise from URL so links are shareable
  const [ticker, setTicker] = useState(() => searchParams.get('ticker') ?? 'MSFT');
  const [localCurrency, setLocalCurrency] = useState(() => searchParams.get('local') ?? 'USD');
  const [targetCurrency, setTargetCurrency] = useState(() => searchParams.get('target') ?? 'INR');
  const [units, setUnits] = useState(() => searchParams.get('units') ?? '3');
  const [startDate, setStartDate] = useState(() => searchParams.get('start') ?? defaultStartDate());
  const [endDate, setEndDate] = useState(() => searchParams.get('end') ?? defaultEndDate());

  // Result state
  const [localSeries, setLocalSeries] = useState<DataPoint[]>([]);
  const [targetSeries, setTargetSeries] = useState<DataPoint[]>([]);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [currentLocal, setCurrentLocal] = useState<number | null>(null);
  const [currentTarget, setCurrentTarget] = useState<number | null>(null);
  const [fxTickerUsed, setFxTickerUsed] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedUnits = useMemo(() => {
    const n = parseFloat(units.replace(/,/g, ''));
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [units]);

  const handleLoad = useCallback(async () => {
    setError(null);
    setLocalSeries([]);
    setTargetSeries([]);
    setTableRows([]);
    setCurrentLocal(null);
    setCurrentTarget(null);

    const tickerTrimmed = ticker.trim().toUpperCase();
    const localUp = localCurrency.trim().toUpperCase();
    const targetUp = targetCurrency.trim().toUpperCase();

    if (!tickerTrimmed) {
      setError('Enter a ticker symbol (e.g. MSFT, AAPL, RELIANCE.NS).');
      return;
    }
    if (!parsedUnits) {
      setError('Units held must be a positive number.');
      return;
    }
    if (localUp.length !== 3) {
      setError('Local currency must be a 3-letter ISO code (e.g. USD, GBP, INR).');
      return;
    }
    if (targetUp.length !== 3) {
      setError('Target currency must be a 3-letter ISO code (e.g. INR, EUR, JPY).');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before or equal to end date.');
      return;
    }

    // Yahoo Finance FX ticker format: {FROM}{TO}=X  e.g. USDINR=X
    const fxTicker = `${localUp}${targetUp}=X`;
    setFxTickerUsed(fxTicker);
    setLoading(true);

    try {
      // Persist state to URL for shareability
      const params = new URLSearchParams();
      params.set('ticker', tickerTrimmed);
      params.set('local', localUp);
      params.set('target', targetUp);
      params.set('units', units);
      params.set('start', startDate);
      params.set('end', endDate);
      setSearchParams(params);

      // Fetch stock price history and FX rate history in parallel
      const [stockData, fxData] = await Promise.all([
        yahooFinanceService.fetchStockData(tickerTrimmed, { startDate, endDate }),
        yahooFinanceService.fetchStockData(fxTicker, { startDate, endDate }),
      ]);

      // Build lookup maps keyed by YYYY-MM-DD
      const stockMap = new Map<string, number>(
        stockData.map((d) => [formatDateKey(new Date(d.date)), d.nav])
      );
      // Yahoo Finance FX pairs (e.g. USDINR=X) are timestamped at 23:00 UTC,
      // causing getUTCDate() to return the previous calendar day. Shift +1 day to match
      // the date the website labels each rate under.
      const fxMap = new Map<string, number>(
        fxData.map((d) => {
          const corrected = new Date(d.date);
          corrected.setUTCDate(corrected.getUTCDate() + 1);
          return [formatDateKey(corrected), d.nav];
        })
      );

      // Sorted FX dates for nearest-neighbour lookup
      const fxDates = [...fxMap.keys()].sort();

      // For a given stock date, return the exact FX rate or the nearest
      // available one (looking back up to 7 days then forward up to 7 days).
      const getNearestFxRate = (dateStr: string): number | null => {
        if (fxMap.has(dateStr)) return fxMap.get(dateStr)!;
        const d = new Date(dateStr + 'T00:00:00Z');
        for (let i = 1; i <= 7; i++) {
          const prev = new Date(d);
          prev.setUTCDate(prev.getUTCDate() - i);
          const prevStr = formatDateKey(prev);
          if (fxMap.has(prevStr)) return fxMap.get(prevStr)!;
        }
        for (let i = 1; i <= 7; i++) {
          const next = new Date(d);
          next.setUTCDate(next.getUTCDate() + i);
          const nextStr = formatDateKey(next);
          if (fxMap.has(nextStr)) return fxMap.get(nextStr)!;
        }
        return null;
      };

      // Use all stock trading dates (ascending); skip only if no FX data nearby
      const stockDates = [...stockMap.keys()].sort();

      if (stockDates.length < 2 || fxDates.length < 2) {
        setError(
          `Not enough data for "${tickerTrimmed}" or "${fxTicker}" in this date range.`
        );
        return;
      }

      const local: DataPoint[] = [];
      const target: DataPoint[] = [];
      const rows: TableRow[] = [];

      for (const dateStr of stockDates) {
        const stockPrice = stockMap.get(dateStr)!;
        const fxRate = getNearestFxRate(dateStr);
        if (fxRate === null) continue;
        const localVal = stockPrice * parsedUnits;
        const targetVal = localVal * fxRate;

        const date = new Date(dateStr + 'T00:00:00Z');
        local.push({ date, nav: localVal });
        target.push({ date, nav: targetVal });
        rows.push({ date: dateStr, stockPrice, fxRate, localValue: localVal, targetValue: targetVal });
      }

      setLocalSeries(local);
      setTargetSeries(target);
      setTableRows(rows);

      const last = rows[rows.length - 1];
      setCurrentLocal(last.localValue);
      setCurrentTarget(last.targetValue);
    } catch (err) {
      setError((err as Error).message || 'Failed to load data. Check the ticker and currency codes.');
    } finally {
      setLoading(false);
    }
  }, [ticker, localCurrency, targetCurrency, units, parsedUnits, startDate, endDate, setSearchParams]);

  const localUp = localCurrency.trim().toUpperCase();
  const targetUp = targetCurrency.trim().toUpperCase();
  const localSym = getCurrencySymbol(localUp);
  const targetSym = getCurrencySymbol(targetUp);

  const hasResults = localSeries.length >= 2;

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="NetworthCurrencyView">
        Track a stock position and see its portfolio value in both your local currency and a
        target currency, using historical FX rates for each trading day. Useful for foreign
        investors who want to understand their returns in a different currency.
      </PageIntro>

      <PageCard>
        {/* ── Input row 1: ticker, units, currencies ── */}
        <Block display="flex" flexWrap="wrap" gridGap="scale400" marginBottom="scale500" alignItems="flex-end">
          <Block display="flex" flexDirection="column" gridGap="scale100" flex="2" minWidth="130px">
            <LabelMedium>Ticker Symbol</LabelMedium>
            <Input
              value={ticker}
              onChange={(e) => setTicker((e.target as HTMLInputElement).value.toUpperCase())}
              placeholder="MSFT"
              size="compact"
            />
          </Block>

          <Block display="flex" flexDirection="column" gridGap="scale100" flex="1" minWidth="110px">
            <LabelMedium>Units Held</LabelMedium>
            <Input
              value={units}
              onChange={(e) => setUnits((e.target as HTMLInputElement).value)}
              placeholder="3"
              size="compact"
            />
          </Block>

          <Block display="flex" flexDirection="column" gridGap="scale100" flex="1" minWidth="110px">
            <LabelMedium>Local Currency</LabelMedium>
            <Input
              value={localCurrency}
              onChange={(e) => setLocalCurrency((e.target as HTMLInputElement).value.toUpperCase().slice(0, 3))}
              placeholder="USD"
              size="compact"
            />
          </Block>

          <Block display="flex" flexDirection="column" gridGap="scale100" flex="1" minWidth="110px">
            <LabelMedium>Target Currency</LabelMedium>
            <Input
              value={targetCurrency}
              onChange={(e) => setTargetCurrency((e.target as HTMLInputElement).value.toUpperCase().slice(0, 3))}
              placeholder="INR"
              size="compact"
            />
          </Block>
        </Block>

        {/* ── Input row 2: dates, load button ── */}
        <Block display="flex" flexWrap="wrap" gridGap="scale400" marginBottom="scale500" alignItems="flex-end">
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>Start Date</LabelMedium>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={dateInputStyle}
            />
          </Block>

          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>End Date</LabelMedium>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={dateInputStyle}
            />
          </Block>

          <Button
            kind="primary"
            onClick={() => void handleLoad()}
            isLoading={loading}
            disabled={loading}
          >
            Load
          </Button>
        </Block>

        {error && (
          <ParagraphMedium color="contentNegative" marginBottom="scale400">
            {error}
          </ParagraphMedium>
        )}

        {/* ── Current value summary cards ── */}
        {hasResults && currentLocal !== null && currentTarget !== null && (
          <Block display="flex" flexWrap="wrap" gridGap="scale500" marginBottom="scale600">
            <Block
              flex="1"
              minWidth="200px"
              padding="scale600"
              backgroundColor="backgroundSecondary"
              overrides={{ Block: { style: { borderRadius: '12px', border: '1px solid #e2e8f0' } } }}
            >
              <LabelSmall color="contentSecondary" marginBottom="scale200">
                Current portfolio value ({localUp})
              </LabelSmall>
              <HeadingXSmall
                marginTop="0"
                marginBottom="scale100"
                $style={{ fontWeight: 700, fontSize: '1.6rem', letterSpacing: '-0.02em' }}
              >
                {formatCurrency(currentLocal, localUp)}
              </HeadingXSmall>
              <LabelSmall color="contentSecondary">
                {parsedUnits} × {ticker.trim().toUpperCase()} @ {localSym}
                {formatCurrency(tableRows[tableRows.length - 1]?.stockPrice ?? 0, localUp).replace(localSym, '')}
              </LabelSmall>
            </Block>

            <Block
              flex="1"
              minWidth="200px"
              padding="scale600"
              backgroundColor="backgroundSecondary"
              overrides={{ Block: { style: { borderRadius: '12px', border: '1px solid #e2e8f0' } } }}
            >
              <LabelSmall color="contentSecondary" marginBottom="scale200">
                Current portfolio value ({targetUp})
              </LabelSmall>
              <HeadingXSmall
                marginTop="0"
                marginBottom="scale100"
                $style={{ fontWeight: 700, fontSize: '1.6rem', letterSpacing: '-0.02em', color: '#1d4ed8' }}
              >
                {formatCurrency(currentTarget, targetUp)}
              </HeadingXSmall>
              <LabelSmall color="contentSecondary">
                FX rate ({fxTickerUsed}): {tableRows[tableRows.length - 1]?.fxRate.toFixed(4)}
              </LabelSmall>
            </Block>
          </Block>
        )}

        {/* ── Line charts ── */}
        {hasResults && (
          <>
            <StockPriceChart
              data={localSeries}
              ticker={`${ticker.trim().toUpperCase()} Portfolio`}
              chartTitle={`Portfolio Value in ${localUp} (${localSym})`}
              valueAxisTitle={`Value (${localUp})`}
              tooltipValueLabel={`${localUp} Value`}
            />

            <StockPriceChart
              data={targetSeries}
              ticker={`${ticker.trim().toUpperCase()} Portfolio (${targetUp})`}
              chartTitle={`Portfolio Value in ${targetUp} (${targetSym})`}
              valueAxisTitle={`Value (${targetUp})`}
              tooltipValueLabel={`${targetUp} Value`}
            />

            {/* ── Dual-axis combined chart ── */}
            <Block marginTop="1.5rem">
              <HighchartsReact
                highcharts={Highcharts}
                constructorType="stockChart"
                immutable
                options={{
                  title: { text: `Portfolio Value — ${localUp} vs ${targetUp}` },
                  credits: { enabled: false },
                  chart: {
                    backgroundColor: CHART_STYLES.colors.background,
                    borderRadius: 8,
                    spacing: [20, 20, 20, 20],
                    height: 500,
                    zooming: { mouseWheel: false },
                  },
                  xAxis: {
                    type: 'datetime',
                    title: { text: 'Date', style: CHART_STYLES.axisTitle },
                    labels: { style: CHART_STYLES.axisLabels },
                    gridLineColor: CHART_STYLES.colors.gridLine,
                    lineColor: CHART_STYLES.colors.line,
                    tickColor: CHART_STYLES.colors.tick,
                  },
                  yAxis: [
                    {
                      title: {
                        text: `${localUp} (${localSym})`,
                        style: { ...CHART_STYLES.axisTitle, color: '#2563eb' },
                      },
                      labels: {
                        formatter: function (this: { value: number }) {
                          return `${localSym}${this.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                        },
                        style: { ...CHART_STYLES.axisLabels, color: '#2563eb' },
                      },
                      gridLineColor: CHART_STYLES.colors.gridLine,
                      opposite: false,
                    },
                    {
                      title: {
                        text: `${targetUp} (${targetSym})`,
                        style: { ...CHART_STYLES.axisTitle, color: '#d97706' },
                      },
                      labels: {
                        formatter: function (this: { value: number }) {
                          return `${targetSym}${this.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                        },
                        style: { ...CHART_STYLES.axisLabels, color: '#d97706' },
                      },
                      gridLineColor: 'transparent',
                      opposite: true,
                    },
                  ],
                  rangeSelector: { enabled: false },
                  navigator: STOCK_CHART_NAVIGATOR,
                  scrollbar: STOCK_CHART_SCROLLBAR,
                  tooltip: {
                    shared: true,
                    crosshairs: true,
                    useHTML: true,
                    backgroundColor: CHART_STYLES.colors.tooltipBackground,
                    borderColor: CHART_STYLES.colors.tooltipBackground,
                    borderRadius: 6,
                    style: CHART_STYLES.tooltip,
                    formatter: function (this: { x: number; points?: Array<{ y: number; series: { name: string; color: string } }> }) {
                      const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
                      let html = `<div style="font-size:12px;color:#fff"><strong>${dateStr}</strong><br/>`;
                      (this.points ?? []).forEach((p) => {
                        html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <strong>${p.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><br/>`;
                      });
                      return html + '</div>';
                    },
                  },
                  plotOptions: {
                    series: {
                      animation: false,
                      marker: { enabled: false, states: { hover: { enabled: true, radius: 5 } } },
                    },
                  },
                  legend: {
                    enabled: true,
                    itemStyle: CHART_STYLES.legend,
                    itemHoverStyle: { color: '#1f2937' },
                  },
                  series: [
                    {
                      name: `${localUp} Value`,
                      data: localSeries.map((d) => [d.date.getTime(), d.nav]),
                      type: 'line' as const,
                      color: '#2563eb',
                      yAxis: 0,
                      showInNavigator: true,
                    },
                    {
                      name: `${targetUp} Value`,
                      data: targetSeries.map((d) => [d.date.getTime(), d.nav]),
                      type: 'line' as const,
                      color: '#d97706',
                      yAxis: 1,
                      showInNavigator: false,
                    },
                  ],
                }}
              />
            </Block>
          </>
        )}

        {/* ── Data table ── */}
        {tableRows.length > 0 && (
          <Block marginTop="scale700">
            <LabelMedium marginBottom="scale400">
              Historical Data ({tableRows.length} trading days)
            </LabelMedium>
            <Block overrides={{ Block: { style: { overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' } } }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {[
                      'Date',
                      `Stock Price (${localUp})`,
                      `FX Rate (${localUp}→${targetUp})`,
                      `Local Value (${localUp})`,
                      `Target Value (${targetUp})`,
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '10px 14px',
                          color: '#64748b',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          borderBottom: '2px solid #e2e8f0',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr
                      key={row.date}
                      style={{
                        backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <td style={{ padding: '8px 14px', color: '#374151', fontFamily: 'monospace' }}>
                        {row.date}
                      </td>
                      <td style={{ padding: '8px 14px', color: '#374151' }}>
                        {formatCurrency(row.stockPrice, localUp)}
                      </td>
                      <td style={{ padding: '8px 14px', color: '#374151' }}>
                        {row.fxRate.toFixed(4)}
                      </td>
                      <td style={{ padding: '8px 14px', color: '#374151' }}>
                        {formatCurrency(row.localValue, localUp)}
                      </td>
                      <td
                        style={{
                          padding: '8px 14px',
                          color: '#1d4ed8',
                          fontWeight: 600,
                        }}
                      >
                        {formatCurrency(row.targetValue, targetUp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
          </Block>
        )}

        {!hasResults && !loading && !error && (
          <ParagraphMedium marginTop="scale400" color="contentSecondary">
            Enter a ticker, currencies, and date range above, then click <strong>Load</strong> to
            see the portfolio value history in both currencies.
            <br />
            <br />
            <strong>Example:</strong> Ticker = MSFT · Local = USD · Target = INR · Units = 3
          </ParagraphMedium>
        )}
      </PageCard>
    </Block>
  );
}
