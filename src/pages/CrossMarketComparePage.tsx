import React, { useState, useCallback } from 'react';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { HeadingXSmall, LabelSmall, LabelMedium, ParagraphSmall, ParagraphMedium } from 'baseui/typography';
import { useSearchParams } from 'react-router-dom';
import Highcharts from 'highcharts/highstock';
import HighchartsReactOriginal from 'highcharts-react-official';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HighchartsReact = HighchartsReactOriginal as any;

import { PageCard, PageIntro } from '../components/common/PageChrome';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { StockPriceChart as StockPriceChartOriginal } from '../components/charts/StockPriceChart';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StockPriceChart = StockPriceChartOriginal as any;
import { yahooFinanceService } from '../services/yahooFinanceService';
import { CHART_STYLES } from '../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../utils/stockChartConfig';

type DataPoint = { date: Date; nav: number };

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr', HKD: 'HK$', SGD: 'S$',
  KRW: '₩', BRL: 'R$', MXN: 'MX$', ZAR: 'R', SEK: 'kr',
  NOK: 'kr', NZD: 'NZ$', TWD: 'NT$', THB: '฿', IDR: 'Rp',
  MYR: 'RM', PHP: '₱', TRY: '₺', AED: 'د.إ', NGN: '₦',
};

const SERIES_COLORS = ['#007bff', '#28a745'] as const;

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatAmount(value: number, currency: string): string {
  const sym = getCurrencySymbol(currency);
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${sym}${(value / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sym}${(value / 1e5).toFixed(2)}L`;
  if (abs >= 1000) return `${sym}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `${sym}${value.toFixed(2)}`;
}

function formatReturn(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

// Build a Highcharts stockChart config for a comparison chart
function buildChartOptions(
  seriesA: DataPoint[],
  seriesB: DataPoint[],
  labelA: string,
  labelB: string,
  chartTitle: string,
  yAxisTitle: string,
  currency: string,
) {
  const sym = getCurrencySymbol(currency);

  const formatValue = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1e7) return `${sym}${(v / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `${sym}${(v / 1e5).toFixed(2)}L`;
    if (abs >= 1000) return `${sym}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    return `${sym}${v.toFixed(2)}`;
  };

  return {
    title: { text: chartTitle },
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
    yAxis: {
      opposite: false,
      title: {
        text: yAxisTitle,
        align: 'middle',
        rotation: -90,
        x: -10,
        style: CHART_STYLES.axisTitle,
      },
      labels: {
        formatter: function (this: { value: number }) {
          return formatValue(this.value);
        },
        style: CHART_STYLES.axisLabels,
      },
      gridLineColor: CHART_STYLES.colors.gridLine,
      lineColor: CHART_STYLES.colors.line,
    },
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
      formatter: function (
        this: { x: number; points?: Array<{ y: number; series: { name: string; color: string } }> },
      ) {
        const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
        let html = `<div style="font-size:12px;color:#ffffff;"><strong>${dateStr}</strong><br/>`;
        const pts = (this.points || []).slice().sort((a, b) => b.y - a.y);
        pts.forEach(p => {
          html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <strong>${formatValue(p.y)}</strong><br/>`;
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
        name: labelA,
        data: seriesA.map(p => [p.date.getTime(), p.nav]),
        type: 'line' as const,
        color: SERIES_COLORS[0],
        showInNavigator: true,
      },
      {
        name: labelB,
        data: seriesB.map(p => [p.date.getTime(), p.nav]),
        type: 'line' as const,
        color: SERIES_COLORS[1],
        showInNavigator: true,
      },
    ],
  };
}

interface SummaryStats {
  startDateStr: string;
  startAmountC1: number;
  startAmountC2: number;
  finalA_cur1: number;
  finalB_cur1: number;
  returnA_cur1: number;
  returnB_cur1: number;
  finalA_cur2: number;
  finalB_cur2: number;
  returnA_cur2: number;
  returnB_cur2: number;
}

interface ChartData {
  a_cur1: DataPoint[];
  b_cur1: DataPoint[];
  a_cur2: DataPoint[];
  b_cur2: DataPoint[];
}

interface LoadedMeta {
  t1: string; c1: string;
  t2: string; c2: string;
}

export default function CrossMarketComparePage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const [ticker1, setTicker1] = useState(() => searchParams.get('t1') ?? 'GLD');
  const [currency1, setCurrency1] = useState(() => searchParams.get('c1') ?? 'USD');
  const [ticker2, setTicker2] = useState(() => searchParams.get('t2') ?? 'GOLDBEES.NS');
  const [currency2, setCurrency2] = useState(() => searchParams.get('c2') ?? 'INR');
  const [startDate, setStartDate] = useState(() => searchParams.get('start') ?? defaultStartDate());
  const [endDate, setEndDate] = useState(() => searchParams.get('end') ?? defaultEndDate());
  const [initialAmount, setInitialAmount] = useState(() => searchParams.get('amount') ?? '100');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [meta, setMeta] = useState<LoadedMeta | null>(null);
  const [rawData1, setRawData1] = useState<DataPoint[]>([]);
  const [rawData2, setRawData2] = useState<DataPoint[]>([]);
  const [rawFxData, setRawFxData] = useState<DataPoint[]>([]);

  const handleLoad = useCallback(async () => {
    const t1 = ticker1.trim().toUpperCase();
    const c1 = currency1.trim().toUpperCase();
    const t2 = ticker2.trim().toUpperCase();
    const c2 = currency2.trim().toUpperCase();
    const amount = parseFloat(initialAmount.replace(/,/g, ''));

    if (!t1 || !c1 || !t2 || !c2) {
      setError('Please fill in all ticker and currency fields.');
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Invalid initial investment amount.');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setError('Start date must be before end date.');
      return;
    }

    setLoading(true);
    setError(null);
    setCharts(null);
    setSummary(null);
    setMeta(null);
    setRawData1([]);
    setRawData2([]);
    setRawFxData([]);

    try {
      const params = new URLSearchParams();
      params.set('t1', t1); params.set('c1', c1);
      params.set('t2', t2); params.set('c2', c2);
      params.set('start', startDate); params.set('end', endDate);
      params.set('amount', initialAmount);
      setSearchParams(params);

      const fxSymbol = `${c1}${c2}=X`;
      const [data1, data2, fxData] = await Promise.all([
        yahooFinanceService.fetchStockData(t1, { startDate, endDate }),
        yahooFinanceService.fetchStockData(t2, { startDate, endDate }),
        yahooFinanceService.fetchStockData(fxSymbol, { startDate, endDate }),
      ]);

      if (data1.length < 2) {
        setError(`Not enough data for ${t1}. Check the ticker and date range.`);
        return;
      }
      if (data2.length < 2) {
        setError(`Not enough data for ${t2}. Check the ticker and date range.`);
        return;
      }
      if (fxData.length < 2) {
        setError(`No FX rate data for ${fxSymbol}. Check currency codes (e.g. USD, INR).`);
        return;
      }

      // FX map with ±7-day nearest-date fallback
      const fxMap = new Map(fxData.map(d => [formatDate(d.date), d.nav]));

      function getNearestFx(dateStr: string): number | null {
        if (fxMap.has(dateStr)) return fxMap.get(dateStr)!;
        const base = new Date(dateStr + 'T00:00:00Z');
        for (let i = 1; i <= 7; i++) {
          const prev = new Date(base); prev.setUTCDate(base.getUTCDate() - i);
          const k = formatDate(prev); if (fxMap.has(k)) return fxMap.get(k)!;
        }
        for (let i = 1; i <= 7; i++) {
          const next = new Date(base); next.setUTCDate(base.getUTCDate() + i);
          const k = formatDate(next); if (fxMap.has(k)) return fxMap.get(k)!;
        }
        return null;
      }

      const map1 = new Map(data1.map(d => [formatDate(d.date), d.nav]));
      const map2 = new Map(data2.map(d => [formatDate(d.date), d.nav]));
      const commonDates = [...map1.keys()].filter(d => map2.has(d)).sort();

      if (commonDates.length < 2) {
        setError('Not enough overlapping trading dates between the two tickers. Try a wider date range.');
        return;
      }

      const startFx = getNearestFx(commonDates[0]);
      if (!startFx) {
        setError('No FX rate available near the start date.');
        return;
      }

      const price1Start = map1.get(commonDates[0])!;
      const price2Start = map2.get(commonDates[0])!;

      // Investment A: buy units of ticker1 with `amount` in c1
      const unitsA = amount / price1Start;

      // Investment B: convert `amount` c1→c2 at start-date FX rate, then buy ticker2
      const amountInC2 = amount * startFx;
      const unitsB = amountInC2 / price2Start;

      const a_cur1: DataPoint[] = [];
      const b_cur1: DataPoint[] = [];
      const a_cur2: DataPoint[] = [];
      const b_cur2: DataPoint[] = [];

      for (const dateStr of commonDates) {
        const price1 = map1.get(dateStr)!;
        const price2 = map2.get(dateStr)!;
        const fx = getNearestFx(dateStr);
        if (!fx) continue;

        const d = new Date(dateStr + 'T00:00:00Z');

        // A native in c1; converted to c2 via FX
        a_cur1.push({ date: d, nav: unitsA * price1 });
        a_cur2.push({ date: d, nav: unitsA * price1 * fx });

        // B native in c2; converted to c1 via FX
        b_cur1.push({ date: d, nav: (unitsB * price2) / fx });
        b_cur2.push({ date: d, nav: unitsB * price2 });
      }

      if (a_cur1.length < 2) {
        setError('Not enough data points with FX coverage. Try a wider date range.');
        return;
      }

      const last = a_cur1.length - 1;

      setMeta({ t1, c1, t2, c2 });
      setRawData1(data1);
      setRawData2(data2);
      setRawFxData(fxData);
      setCharts({ a_cur1, b_cur1, a_cur2, b_cur2 });
      setSummary({
        startDateStr: commonDates[0],
        startAmountC1: amount,
        startAmountC2: amountInC2,
        finalA_cur1: a_cur1[last].nav,
        finalB_cur1: b_cur1[last].nav,
        returnA_cur1: ((a_cur1[last].nav - amount) / amount) * 100,
        returnB_cur1: ((b_cur1[last].nav - amount) / amount) * 100,
        finalA_cur2: a_cur2[last].nav,
        finalB_cur2: b_cur2[last].nav,
        returnA_cur2: ((a_cur2[last].nav - amountInC2) / amountInC2) * 100,
        returnB_cur2: ((b_cur2[last].nav - amountInC2) / amountInC2) * 100,
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load data. Check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  }, [ticker1, currency1, ticker2, currency2, startDate, endDate, initialAmount, setSearchParams]);

  const hasResults = charts !== null && summary !== null && meta !== null;

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="Cross-Market Investment Compare">
        Start with the same amount, invest in two different markets, and see how currency conversion affects your returns over time.
      </PageIntro>

      <PageCard>
        {/* ── Inputs ── */}
        <Block
          display="grid"
          gridGap="scale400"
          marginBottom="scale400"
          overrides={{ Block: { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } } }}
        >
          <Block>
            <LabelSmall marginBottom="scale200">Ticker 1</LabelSmall>
            <Input
              value={ticker1}
              placeholder="GLD"
              onChange={e => setTicker1((e.target as HTMLInputElement).value)}
            />
          </Block>
          <Block>
            <LabelSmall marginBottom="scale200">Currency 1</LabelSmall>
            <Input
              value={currency1}
              placeholder="USD"
              onChange={e => setCurrency1((e.target as HTMLInputElement).value)}
            />
          </Block>
          <Block>
            <LabelSmall marginBottom="scale200">Ticker 2</LabelSmall>
            <Input
              value={ticker2}
              placeholder="GOLDBEES.NS"
              onChange={e => setTicker2((e.target as HTMLInputElement).value)}
            />
          </Block>
          <Block>
            <LabelSmall marginBottom="scale200">Currency 2</LabelSmall>
            <Input
              value={currency2}
              placeholder="INR"
              onChange={e => setCurrency2((e.target as HTMLInputElement).value)}
            />
          </Block>
        </Block>

        <Block display="flex" gridGap="scale400" marginBottom="scale400" flexWrap="wrap" alignItems="flex-end">
          <Block>
            <LabelSmall marginBottom="scale200">Start Date</LabelSmall>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Block>
          <Block>
            <LabelSmall marginBottom="scale200">End Date</LabelSmall>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </Block>
          <Block minWidth="160px">
            <LabelSmall marginBottom="scale200">
              Initial Amount ({currency1.trim().toUpperCase() || 'C1'})
            </LabelSmall>
            <Input
              value={initialAmount}
              placeholder="100"
              onChange={e => setInitialAmount((e.target as HTMLInputElement).value)}
            />
          </Block>
          <Button onClick={handleLoad} isLoading={loading}>
            Compare
          </Button>
        </Block>

        {error && <ParagraphMedium color="contentNegative">{error}</ParagraphMedium>}

        {/* ── Results ── */}
        {hasResults && (
          <>
            {/* Divider */}
            <Block
              marginTop="scale600"
              marginBottom="scale600"
              overrides={{ Block: { style: { borderTop: '1px solid #e5e7eb' } } }}
            />

            {/* Starting value notice */}
            <Block marginBottom="scale500">
              <ParagraphSmall color="contentSecondary" marginTop="0" marginBottom="0">
                Both investments started on <strong>{summary!.startDateStr}</strong> with{' '}
                <strong style={{ color: SERIES_COLORS[0] }}>{formatAmount(summary!.startAmountC1, meta!.c1)}</strong>
                {' '}({meta!.c1}) = <strong style={{ color: SERIES_COLORS[1] }}>
                  {formatAmount(summary!.startAmountC2, meta!.c2)}
                </strong> ({meta!.c2} at start-date FX rate).
              </ParagraphSmall>
            </Block>

            {/* Summary rows */}
            <Block
              display="grid"
              gridGap="scale400"
              marginBottom="scale600"
              overrides={{ Block: { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))' } } }}
            >
              <InvestmentSummary
                label={`${meta!.t1} (${meta!.c1})`}
                color={SERIES_COLORS[0]}
                rows={[
                  {
                    currency: meta!.c1,
                    initialValue: formatAmount(summary!.startAmountC1, meta!.c1),
                    finalValue: formatAmount(summary!.finalA_cur1, meta!.c1),
                    returnPct: summary!.returnA_cur1,
                  },
                  {
                    currency: meta!.c2,
                    initialValue: formatAmount(summary!.startAmountC2, meta!.c2),
                    finalValue: formatAmount(summary!.finalA_cur2, meta!.c2),
                    returnPct: summary!.returnA_cur2,
                  },
                ]}
              />
              <InvestmentSummary
                label={`${meta!.t2} (${meta!.c2})`}
                color={SERIES_COLORS[1]}
                rows={[
                  {
                    currency: meta!.c1,
                    initialValue: formatAmount(summary!.startAmountC1, meta!.c1),
                    finalValue: formatAmount(summary!.finalB_cur1, meta!.c1),
                    returnPct: summary!.returnB_cur1,
                  },
                  {
                    currency: meta!.c2,
                    initialValue: formatAmount(summary!.startAmountC2, meta!.c2),
                    finalValue: formatAmount(summary!.finalB_cur2, meta!.c2),
                    returnPct: summary!.returnB_cur2,
                  },
                ]}
              />
            </Block>

            {/* Chart 1: both in Currency 1 */}
            <LabelMedium marginBottom="scale300">
              Both investments in {meta!.c1} terms
            </LabelMedium>
            <Block marginBottom="scale600">
              <HighchartsReact
                highcharts={Highcharts}
                constructorType="stockChart"
                options={buildChartOptions(
                  charts!.a_cur1,
                  charts!.b_cur1,
                  `${meta!.t1} (${meta!.c1})`,
                  `${meta!.t2} → ${meta!.c1}`,
                  `Both Investments in ${meta!.c1} Terms`,
                  `Value (${meta!.c1})`,
                  meta!.c1,
                )}
                immutable
              />
            </Block>

            {/* Chart 2: both in Currency 2 */}
            <LabelMedium marginBottom="scale300">
              Both investments in {meta!.c2} terms
            </LabelMedium>
            <Block marginBottom="scale600">
              <HighchartsReact
                highcharts={Highcharts}
                constructorType="stockChart"
                options={buildChartOptions(
                  charts!.a_cur2,
                  charts!.b_cur2,
                  `${meta!.t1} → ${meta!.c2}`,
                  `${meta!.t2} (${meta!.c2})`,
                  `Both Investments in ${meta!.c2} Terms`,
                  `Value (${meta!.c2})`,
                  meta!.c2,
                )}
                immutable
              />
            </Block>

            {/* Chart 3: Ticker 1 raw price */}
            <LabelMedium marginBottom="scale300">
              {meta!.t1} Price ({meta!.c1})
            </LabelMedium>
            <Block marginBottom="scale600">
              <StockPriceChart
                data={rawData1}
                ticker={meta!.t1}
                chartTitle={`${meta!.t1} Price`}
                valueAxisTitle={`Price (${meta!.c1})`}
                tooltipValueLabel={`${meta!.t1} Price`}
              />
            </Block>

            {/* Chart 4: Ticker 2 raw price */}
            <LabelMedium marginBottom="scale300">
              {meta!.t2} Price ({meta!.c2})
            </LabelMedium>
            <Block marginBottom="scale600">
              <StockPriceChart
                data={rawData2}
                ticker={meta!.t2}
                chartTitle={`${meta!.t2} Price`}
                valueAxisTitle={`Price (${meta!.c2})`}
                tooltipValueLabel={`${meta!.t2} Price`}
              />
            </Block>

            {/* Chart 5: FX rate — 4 decimal places */}
            <LabelMedium marginBottom="scale300">
              {meta!.c1}/{meta!.c2} Exchange Rate
            </LabelMedium>
            <Block>
              <HighchartsReact
                highcharts={Highcharts}
                constructorType="stockChart"
                options={{
                  title: { text: `${meta!.c1}/${meta!.c2} Exchange Rate` },
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
                  yAxis: {
                    opposite: false,
                    title: {
                      text: `${meta!.c2} per ${meta!.c1}`,
                      align: 'middle',
                      rotation: -90,
                      x: -10,
                      style: CHART_STYLES.axisTitle,
                    },
                    labels: {
                      formatter: function (this: { value: number }) {
                        return this.value.toFixed(4);
                      },
                      style: CHART_STYLES.axisLabels,
                    },
                    gridLineColor: CHART_STYLES.colors.gridLine,
                    lineColor: CHART_STYLES.colors.line,
                  },
                  rangeSelector: { enabled: false },
                  navigator: STOCK_CHART_NAVIGATOR,
                  scrollbar: STOCK_CHART_SCROLLBAR,
                  tooltip: {
                    shared: false,
                    crosshairs: true,
                    useHTML: true,
                    backgroundColor: CHART_STYLES.colors.tooltipBackground,
                    borderColor: CHART_STYLES.colors.tooltipBackground,
                    borderRadius: 6,
                    style: CHART_STYLES.tooltip,
                    formatter: function (this: { x: number; y: number }) {
                      const dateStr = Highcharts.dateFormat('%e %b %Y', this.x);
                      return `<div style="font-size:12px;color:#ffffff;"><strong>${dateStr}</strong><br/><span style="color:#007bff">●</span> ${meta!.c1}/${meta!.c2}: <strong>${this.y.toFixed(4)}</strong></div>`;
                    },
                  },
                  plotOptions: {
                    series: {
                      animation: false,
                      marker: { enabled: false, states: { hover: { enabled: true, radius: 5 } } },
                    },
                  },
                  legend: { enabled: false },
                  series: [{
                    name: `${meta!.c1}/${meta!.c2}`,
                    data: rawFxData.map(p => [p.date.getTime(), p.nav]),
                    type: 'line' as const,
                    color: '#007bff',
                    showInNavigator: true,
                  }],
                }}
                immutable
              />
            </Block>
          </>
        )}
      </PageCard>
    </Block>
  );
}

interface SummaryRow {
  currency: string;
  initialValue: string;
  finalValue: string;
  returnPct: number;
}

function InvestmentSummary({
  label,
  color,
  rows,
}: {
  label: string;
  color: string;
  rows: SummaryRow[];
}): React.ReactElement {
  return (
    <Block
      padding="scale500"
      overrides={{
        Block: {
          style: ({ $theme }) => ({
            borderRadius: $theme.borders.radius300,
            border: `2px solid ${color}`,
            backgroundColor: $theme.colors.backgroundSecondary,
          }),
        },
      }}
    >
      {/* Header */}
      <Block display="flex" alignItems="center" gridGap="scale200" marginBottom="scale400">
        <Block
          width="12px"
          height="12px"
          overrides={{ Block: { style: { borderRadius: '50%', backgroundColor: color, flexShrink: 0 } } }}
        />
        <HeadingXSmall marginTop="0" marginBottom="0" $style={{ color, fontWeight: 700 }}>
          {label}
        </HeadingXSmall>
      </Block>

      {/* Table: currency | initial | final | return */}
      <Block
        overrides={{
          Block: {
            style: {
              display: 'grid',
              gridTemplateColumns: 'auto 1fr 1fr auto',
              columnGap: '16px',
              rowGap: '6px',
              alignItems: 'baseline',
            },
          },
        }}
      >
        {/* Column headers */}
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600 }}></LabelSmall>
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600, textAlign: 'right' }}>Initial</LabelSmall>
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600, textAlign: 'right' }}>Final</LabelSmall>
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600, textAlign: 'right' }}>Return</LabelSmall>

        {rows.map(row => (
          <div key={row.currency} style={{ display: 'contents' }}>
            <LabelSmall color="contentSecondary">{row.currency}</LabelSmall>
            <LabelSmall $style={{ textAlign: 'right' }}>{row.initialValue}</LabelSmall>
            <LabelSmall $style={{ fontWeight: 700, textAlign: 'right' }}>{row.finalValue}</LabelSmall>
            <LabelSmall
              $style={{
                fontWeight: 700,
                textAlign: 'right',
                color: row.returnPct >= 0 ? '#16a34a' : '#dc2626',
              }}
            >
              {formatReturn(row.returnPct)}
            </LabelSmall>
          </div>
        ))}
      </Block>
    </Block>
  );
}
