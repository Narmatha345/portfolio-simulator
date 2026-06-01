import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import xirr from 'xirr';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import {
  HeadingXSmall,
  LabelSmall,
  LabelMedium,
  ParagraphMedium,
} from 'baseui/typography';
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
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';
import { CHART_STYLES } from '../constants';
import { STOCK_CHART_NAVIGATOR, STOCK_CHART_SCROLLBAR } from '../utils/stockChartConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

type PricePoint = { date: Date; nav: number };
type ValuePoint = { date: Date; value: number };

interface PortfolioEntry {
  id: string;
  ticker: string;
  // amount is in the shared investCurrency (e.g. USD 100/mo)
  amount: string;
  // native trading currency of the ticker (e.g. INR for GOLDBEES.NS, USD for AAPL)
  currency: string;
}

interface PortfolioDef {
  id: string;
  name: string;
  entries: PortfolioEntry[];
}

interface TickerBuyDetail {
  ticker: string;
  buyDate: string;        // actual first trading day used for price lookup
  buyPrice: number;       // price in native currency
  nativeCurrency: string;
  nativeAmount: number;   // user-entered monthly amount in tc
  usdCashFlow: number;    // negative USD equivalent (XIRR outflow)
  sellDate: string;       // month-end date when portfolio was valued
  sellPrice: number;      // price in native currency at month-end
}
interface XirrRow {
  month: string;
  investDateXirr: string; // calendar 1st — date used in XIRR cash flow
  buys: TickerBuyDetail[];
  invested: number;       // total USD outflow this month
  cumInvested: number;
  portValue: number;      // month-end portfolio value in USD
}

interface ResultData {
  a_val: ValuePoint[];
  b_val: ValuePoint[];
  secValsByCurrency: Record<string, { a: ValuePoint[]; b: ValuePoint[] }>;
  summaryRowsA: SummaryRow[];
  summaryRowsB: SummaryRow[];
  totalInvestedA: number;
  totalInvestedB: number;
  finalA: number;
  finalB: number;
  returnA: number;
  returnB: number;
  xirrA: number | null;
  xirrB: number | null;
  monthlyBreakdownA: XirrRow[];
  monthlyBreakdownB: XirrRow[];
}

// ─── Ticker → currency inference ─────────────────────────────────────────────

function inferCurrency(ticker: string, ic: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith('.NS') || t.endsWith('.BO')) return 'INR';
  if (t.endsWith('.L')) return 'GBP';
  if (t.endsWith('.T')) return 'JPY';
  if (t.endsWith('.HK')) return 'HKD';
  if (t.endsWith('.AX')) return 'AUD';
  if (t.endsWith('.TO') || t.endsWith('.V')) return 'CAD';
  if (t.endsWith('.SW')) return 'CHF';
  if (t.endsWith('.ST')) return 'SEK';
  if (t.endsWith('.OL')) return 'NOK';
  if (t.endsWith('.CO')) return 'DKK';
  if (t.endsWith('.NZ')) return 'NZD';
  if (t.endsWith('.SA')) return 'BRL';
  if (t.endsWith('.MX')) return 'MXN';
  if (t.endsWith('.JK')) return 'IDR';
  if (t.endsWith('.BK')) return 'THB';
  if (t.endsWith('.KL')) return 'MYR';
  if (t.endsWith('.PS')) return 'PHP';
  if (t.endsWith('.IS')) return 'TRY';
  if (t.endsWith('.JO')) return 'ZAR';
  if (t.endsWith('.TA')) return 'ILS';
  if (t.endsWith('.SR')) return 'SAR';
  if (t.endsWith('.QA')) return 'QAR';
  if (t.endsWith('.AE') || t.endsWith('.AD')) return 'AED';
  if (t.endsWith('.WA')) return 'PLN';
  if (t.endsWith('.PR')) return 'CZK';
  if (t.endsWith('.BD')) return 'HUF';
  if (t.endsWith('.BA')) return 'ARS';
  if (t.endsWith('.SN')) return 'CLP';
  if (t.endsWith('.LM')) return 'PEN';
  if (t.endsWith('.CR')) return 'COP';
  if (t.endsWith('.NG')) return 'NGN';
  if (t.endsWith('.EG') || t.endsWith('.CA')) return 'EGP';
  if (
    t.endsWith('.DE') || t.endsWith('.PA') || t.endsWith('.AS') ||
    t.endsWith('.MI') || t.endsWith('.MC') || t.endsWith('.BR') ||
    t.endsWith('.HE') || t.endsWith('.AT') || t.endsWith('.LS') ||
    t.endsWith('.VI') || t.endsWith('.IR') || t.endsWith('.F')  ||
    t.endsWith('.BE') || t.endsWith('.DU') || t.endsWith('.MU') ||
    t.endsWith('.TI') || t.endsWith('.NX')
  ) return 'EUR';
  if (t.endsWith('.SI')) return 'SGD';
  if (t.endsWith('.KS') || t.endsWith('.KQ')) return 'KRW';
  if (t.endsWith('.TW')) return 'TWD';
  if (t.endsWith('.SZ') || t.endsWith('.SS')) return 'CNY';
  return ic;
}

// ─── Currency helpers ─────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',    EUR: '€',    GBP: '£',    INR: '₹',    JPY: '¥',    CNY: '¥',
  AUD: 'A$',   CAD: 'C$',   CHF: 'Fr',   HKD: 'HK$',  SGD: 'S$',   NZD: 'NZ$',
  KRW: '₩',   BRL: 'R$',   MXN: 'MX$',  ZAR: 'R',    TWD: 'NT$',  SEK: 'kr',
  NOK: 'kr',   DKK: 'kr',   THB: '฿',   IDR: 'Rp',   MYR: 'RM',   PHP: '₱',
  TRY: '₺',   NGN: '₦',   ILS: '₪',   PLN: 'zł',   CZK: 'Kč',  HUF: 'Ft',
  SAR: '﷼',   QAR: '﷼',   AED: 'د.إ', ARS: 'ARS',  CLP: 'CLP',  PEN: 'PEN',
  COP: 'COP',  EGP: 'E£',   KES: 'KSh',
};

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
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
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function defaultStartMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 23);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function defaultEndMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

function monthToStartDate(m: string): string {
  return `${m}-01`;
}

function monthToEndDate(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
}

function localMonthEndDateTime(monthStr: string): Date {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, new Date(y, m, 0).getDate(), 23, 59, 59, 999);
}

// Returns the first available trading-day price on or after dateStr.
// Used for month-end valuation so weekends/holidays roll to the next open day.
function getNextAvailablePrice(data: PricePoint[], dateStr: string): number {
  for (const p of data) {
    if (formatDate(p.date) >= dateStr) return p.nav;
  }
  return data[data.length - 1].nav;
}

// Returns both price and actual trading date for the next available price on or after dateStr.
function getNextAvailablePriceWithDate(data: PricePoint[], dateStr: string): { price: number; date: string } {
  for (const p of data) {
    if (formatDate(p.date) >= dateStr) return { price: p.nav, date: formatDate(p.date) };
  }
  const last = data[data.length - 1];
  return { price: last.nav, date: formatDate(last.date) };
}

function parseSyntheticTicker(ticker: string): { rate: number } | null {
  const t = ticker.trim().toUpperCase();
  if (!t.startsWith('~')) return null;
  if (t === '~TARGET_RATE') return { rate: 0.12 };
  const m1 = t.match(/^~TARGET_RATE:(\d+(?:\.\d+)?)$/);
  if (m1) return { rate: parseFloat(m1[1]) / 100 };
  const m2 = t.match(/^~(\d+(?:\.\d+)?)$/);
  if (m2) return { rate: parseFloat(m2[1]) / 100 };
  return null;
}

function generateSyntheticPriceData(startDateStr: string, endDateStr: string, rate: number): PricePoint[] {
  const start = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T23:59:59Z');
  const result: PricePoint[] = [];
  const msPerDay = 86400000;
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setTime(d.getTime() + msPerDay)) {
    const years = (d.getTime() - start.getTime()) / msPerDay / 365.25;
    result.push({
      date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
      nav: Math.pow(1 + rate, years),
    });
  }
  return result;
}

// ─── UI constants ─────────────────────────────────────────────────────────────

const PORTFOLIO_COLORS = ['#6366f1', '#ec4899'] as const;
const CHART_COLORS = ['#007bff', '#28a745'] as const;

const dateInputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  fontFamily: 'inherit',
  backgroundColor: '#fff',
};

// ─── PortfolioSection ─────────────────────────────────────────────────────────
// Row layout: Ticker | Ticker Currency | {tickerCcySym}/mo | Amount | Remove

function PortfolioSection({
  portfolio,
  borderColor,
  onUpdate,
  onAddRow,
  onRemoveRow,
}: {
  portfolio: PortfolioDef;
  borderColor: string;
  onUpdate: (id: string, field: 'ticker' | 'amount' | 'currency', value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
}) {
  return (
    <Block
      padding="scale500"
      marginBottom="scale400"
      overrides={{
        Block: {
          style: {
            borderLeft: `4px solid ${borderColor}`,
            borderRadius: '8px',
            backgroundColor: '#fafafa',
          },
        },
      }}
    >
      <LabelMedium marginBottom="scale300" $style={{ fontWeight: 600 }}>
        {portfolio.name}
      </LabelMedium>

      <Block display="flex" flexDirection="column" gridGap="scale300">
        {portfolio.entries.map((entry) => (
          <Block
            key={entry.id}
            display="flex"
            alignItems="center"
            gridGap="scale300"
            $style={{ flexWrap: 'wrap' }}
          >
            <Input
              value={entry.ticker}
              onChange={(e) => onUpdate(entry.id, 'ticker', (e.target as HTMLInputElement).value)}
              placeholder="Ticker (e.g. AAPL)"
              size="compact"
              overrides={{ Root: { style: { width: '130px', minWidth: '110px' } } }}
            />
            <Input
              value={entry.currency}
              onChange={(e) => onUpdate(entry.id, 'currency', (e.target as HTMLInputElement).value)}
              placeholder="CCY (auto)"
              size="compact"
              overrides={{ Root: { style: { width: '95px', minWidth: '80px' } } }}
            />
            <LabelMedium marginBottom="0" marginTop="0">
              {getCurrencySymbol(
                entry.currency.trim().toUpperCase() ||
                inferCurrency(entry.ticker.trim().toUpperCase(), 'USD')
              )}/mo
            </LabelMedium>
            <Input
              value={entry.amount}
              onChange={(e) =>
                onUpdate(entry.id, 'amount', (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, ''))
              }
              placeholder="Monthly"
              size="compact"
              overrides={{ Root: { style: { width: '100px', minWidth: '80px' } } }}
            />
            <Button
              kind="tertiary"
              size="mini"
              onClick={() => onRemoveRow(entry.id)}
              disabled={portfolio.entries.length <= 1}
            >
              Remove
            </Button>
          </Block>
        ))}
        <Button kind="secondary" size="compact" onClick={onAddRow}>
          + Add stock
        </Button>
      </Block>
    </Block>
  );
}

// ─── PortfolioSummaryCard ─────────────────────────────────────────────────────

interface SummaryRow { label: string; currency: string; invested: number; finalValue: number; returnPct: number }

function PortfolioSummaryCard({
  label,
  color,
  rows,
  xirrVal,
}: {
  label: string;
  color: string;
  rows: SummaryRow[];
  xirrVal: number | null;
}) {
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
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600 }}></LabelSmall>
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600, textAlign: 'right' }}>Invested</LabelSmall>
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600, textAlign: 'right' }}>Final Value</LabelSmall>
        <LabelSmall color="contentSecondary" $style={{ fontWeight: 600, textAlign: 'right' }}>Return</LabelSmall>

        {rows.flatMap((row) => [
          <LabelSmall key={`${row.label}-ccy`} color="contentSecondary">{row.label}</LabelSmall>,
          <LabelSmall key={`${row.label}-inv`} $style={{ textAlign: 'right' }}>{formatAmount(row.invested, row.currency)}</LabelSmall>,
          <LabelSmall key={`${row.label}-fin`} $style={{ fontWeight: 700, textAlign: 'right' }}>{formatAmount(row.finalValue, row.currency)}</LabelSmall>,
          <LabelSmall
            key={`${row.label}-ret`}
            $style={{ fontWeight: 700, textAlign: 'right', color: row.returnPct >= 0 ? '#16a34a' : '#dc2626' }}
          >
            {formatReturn(row.returnPct)}
          </LabelSmall>,
        ])}
      </Block>

      {xirrVal != null && (
        <Block marginTop="scale300">
          <LabelSmall $style={{ color: xirrVal >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
            XIRR: {formatReturn(xirrVal * 100)}
          </LabelSmall>
        </Block>
      )}
    </Block>
  );
}

// ─── Chart builders ───────────────────────────────────────────────────────────

function buildChartOptions(
  seriesA: ValuePoint[],
  seriesB: ValuePoint[],
  labelA: string,
  labelB: string,
  chartTitle: string,
  currency: string,
) {
  const sym = getCurrencySymbol(currency);
  const fmt = (v: number) => {
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
      title: { text: 'Month', style: CHART_STYLES.axisTitle },
      labels: { style: CHART_STYLES.axisLabels },
      gridLineColor: CHART_STYLES.colors.gridLine,
      lineColor: CHART_STYLES.colors.line,
      tickColor: CHART_STYLES.colors.tick,
    },
    yAxis: {
      opposite: false,
      title: {
        text: `Value (${currency})`,
        align: 'middle',
        rotation: -90,
        x: -10,
        style: CHART_STYLES.axisTitle,
      },
      labels: {
        formatter: function (this: { value: number }) { return fmt(this.value); },
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
        const dateStr = Highcharts.dateFormat('%b %Y', this.x);
        let html = `<div style="font-size:12px;color:#ffffff;"><strong>${dateStr}</strong><br/>`;
        (this.points || [])
          .slice()
          .sort((a, b) => b.y - a.y)
          .forEach((p) => {
            html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <strong>${fmt(p.y)}</strong><br/>`;
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
        data: seriesA.map((p) => [p.date.getTime(), p.value]),
        type: 'line' as const,
        color: CHART_COLORS[0],
        showInNavigator: true,
      },
      {
        name: labelB,
        data: seriesB.map((p) => [p.date.getTime(), p.value]),
        type: 'line' as const,
        color: CHART_COLORS[1],
        showInNavigator: true,
      },
    ],
  };
}

function buildFxChartOptions(fxData: PricePoint[], c1: string, c2: string) {
  return {
    title: { text: `${c1}/${c2} Exchange Rate` },
    credits: { enabled: false },
    chart: {
      backgroundColor: CHART_STYLES.colors.background,
      borderRadius: 8,
      spacing: [20, 20, 20, 20],
      height: 400,
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
        text: `${c2} per ${c1}`,
        align: 'middle',
        rotation: -90,
        x: -10,
        style: CHART_STYLES.axisTitle,
      },
      labels: {
        formatter: function (this: { value: number }) { return this.value.toFixed(4); },
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
        return `<div style="font-size:12px;color:#ffffff;"><strong>${dateStr}</strong><br/><span style="color:#007bff">●</span> ${c1}/${c2}: <strong>${this.y.toFixed(4)}</strong></div>`;
      },
    },
    plotOptions: {
      series: {
        animation: false,
        marker: { enabled: false, states: { hover: { enabled: true, radius: 5 } } },
      },
    },
    legend: { enabled: false },
    series: [
      {
        name: `${c1}/${c2}`,
        data: fxData.map((p) => [p.date.getTime(), p.nav]),
        type: 'line' as const,
        color: '#007bff',
        showInNavigator: true,
      },
    ],
  };
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function parseEntriesFromUrl(s: string | null): PortfolioEntry[] {
  const blank = (): PortfolioEntry => ({
    id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
    ticker: '',
    amount: '',
    currency: '',
  });
  if (!s?.trim()) return [blank()];
  const parsed = s.split(',').map((part) => {
    const [t, a, c] = part.split(':');
    return {
      id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
      ticker: (t ?? '').toUpperCase(),
      amount: (a ?? '').replace(/[^0-9.]/g, ''),
      currency: (c ?? '').toUpperCase(),
    };
  }).filter((e) => e.ticker || e.amount);
  return parsed.length ? parsed : [blank()];
}

// ─── XIRR helper ──────────────────────────────────────────────────────────────

function calcXirr(
  transactions: Array<{ amount: number; when: Date }>,
  finalValue: number,
  endDate: Date,
): number | null {
  if (transactions.length === 0 || finalValue <= 0) return null;
  const grouped = new Map<string, number>();
  transactions.forEach((t) => {
    const k = t.when.toISOString().slice(0, 10);
    grouped.set(k, (grouped.get(k) ?? 0) + t.amount);
  });
  const rows = [
    ...Array.from(grouped.entries()).map(([d, amt]) => ({ amount: amt, when: new Date(d) })),
    { amount: finalValue, when: endDate },
  ].sort((a, b) => a.when.getTime() - b.when.getTime());
  try {
    return xirr(rows);
  } catch {
    return null;
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

const INITIAL_PORTFOLIOS: PortfolioDef[] = [
  { id: 'A', name: 'Portfolio A', entries: [{ id: '1', ticker: '', amount: '', currency: '' }] },
  { id: 'B', name: 'Portfolio B', entries: [{ id: '2', ticker: '', amount: '', currency: '' }] },
];

export default function SipCrossMarketComparePage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const [portfolios, setPortfolios] = useState<PortfolioDef[]>(() => {
    const pa = searchParams.get('pa');
    const pb = searchParams.get('pb');
    if (!pa && !pb) {
      return INITIAL_PORTFOLIOS.map((p) => ({
        ...p,
        entries: p.entries.map((e) => ({ ...e, id: crypto.randomUUID?.() ?? String(Date.now()) })),
      }));
    }
    return [
      { id: 'A', name: 'Portfolio A', entries: parseEntriesFromUrl(pa) },
      { id: 'B', name: 'Portfolio B', entries: parseEntriesFromUrl(pb) },
    ];
  });

  const [startMonth, setStartMonth] = useState(() => searchParams.get('startMonth') ?? defaultStartMonth());
  const [endMonth, setEndMonth] = useState(() => searchParams.get('endMonth') ?? defaultEndMonth());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [loadedMeta, setLoadedMeta] = useState<{ ic: string } | null>(null);
  const [rawPriceData, setRawPriceData] = useState<Record<string, PricePoint[]>>({});
  // foreignCurrency → fx price series for that investCurrency/foreignCurrency pair
  const [fxDataMap, setFxDataMap] = useState<Record<string, PricePoint[]>>({});
  const [tickersA, setTickersA] = useState<string[]>([]);
  const [tickersB, setTickersB] = useState<string[]>([]);
  const [tickerCurrencyMap, setTickerCurrencyMap] = useState<Record<string, string>>({});

  const isRangeInvalid = startMonth > endMonth;

  const handleAddRow = (portfolioId: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              entries: [
                ...p.entries,
                { id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '', currency: '' },
              ],
            }
          : p,
      ),
    );
  };

  const handleRemoveRow = (portfolioId: string, entryId: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId && p.entries.length > 1
          ? { ...p, entries: p.entries.filter((e) => e.id !== entryId) }
          : p,
      ),
    );
  };

  const handleUpdateEntry = (
    portfolioId: string,
    entryId: string,
    field: 'ticker' | 'amount' | 'currency',
    value: string,
  ) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              entries: p.entries.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      [field]: field === 'amount' ? value.replace(/[^0-9.]/g, '') : value.toUpperCase(),
                    }
                  : e,
              ),
            }
          : p,
      ),
    );
  };

  const handlePlot = useCallback(async () => {
    if (isRangeInvalid) {
      setError('Start month must be before end month.');
      return;
    }

    // currency is optional — inferred from ticker suffix if blank (e.g. .NS → INR)
    const validA = portfolios[0].entries.filter(
      (e) => e.ticker.trim() && parseFloat(e.amount) > 0,
    );
    const validB = portfolios[1].entries.filter(
      (e) => e.ticker.trim() && parseFloat(e.amount) > 0,
    );

    if (validA.length === 0 && validB.length === 0) {
      setError('Add at least one stock with a ticker and amount to each portfolio.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadedMeta(null);
    setRawPriceData({});
    setFxDataMap({});
    setTickersA([]);
    setTickersB([]);
    setTickerCurrencyMap({});

    try {
      const startDateStr = monthToStartDate(startMonth);
      const endDateStr = monthToEndDate(endMonth);

      // Build ticker → native trading currency map; infer from ticker suffix if field is blank
      const newTickerCurrencyMap: Record<string, string> = {};
      [...validA, ...validB].forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const tc = e.currency.trim().toUpperCase() || inferCurrency(ticker, 'USD');
        newTickerCurrencyMap[ticker] = tc;
      });

      // All calculations and summary always in USD; native currencies shown in secondary charts
      const ic = 'USD';

      // Fetch all stock prices
      const allTickers = [...new Set([
        ...validA.map((e) => e.ticker.trim().toUpperCase()),
        ...validB.map((e) => e.ticker.trim().toUpperCase()),
      ])];
      const realTickers = allTickers.filter((t) => !parseSyntheticTicker(t));
      const syntheticTickers = allTickers
        .map((t) => ({ ticker: t, parsed: parseSyntheticTicker(t) }))
        .filter((x): x is { ticker: string; parsed: { rate: number } } => x.parsed != null);

      // byTicker: forward-filled (used for SIP price lookups — needs a price for every date)
      // byTickerRaw: exact Yahoo Finance data only (used for chart display — no phantom weekend bars)
      const byTicker: Record<string, PricePoint[]> = {};
      const byTickerRaw: Record<string, PricePoint[]> = {};
      if (realTickers.length > 0) {
        const fetched = await Promise.allSettled(
          realTickers.map((t) =>
            yahooFinanceService.fetchStockData(t, { startDate: startDateStr, endDate: endDateStr }),
          ),
        );
        fetched.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.length > 0) {
            byTickerRaw[realTickers[i]] = r.value;
            byTicker[realTickers[i]] = fillMissingNavDates(r.value);
          }
        });
      }
      syntheticTickers.forEach(({ ticker, parsed }) => {
        byTicker[ticker] = generateSyntheticPriceData(startDateStr, endDateStr, parsed.rate);
        byTickerRaw[ticker] = byTicker[ticker];
      });

      // Fetch FX pairs: ic → each unique ticker currency that differs from ic
      // Yahoo format: USDINR=X gives INR per 1 USD (i.e. foreignCurrency per 1 ic)
      const foreignCurrencies = [
        ...new Set(
          Object.values(newTickerCurrencyMap).filter((c) => c && c !== ic),
        ),
      ];
      const newFxDataMap: Record<string, PricePoint[]> = {};
      await Promise.allSettled(
        foreignCurrencies.map(async (fc) => {
          try {
            const data = await yahooFinanceService.fetchStockData(`${ic}${fc}=X`, {
              startDate: startDateStr,
              endDate: endDateStr,
            });
            if (data.length > 0) newFxDataMap[fc] = data;
          } catch {
            // proceed with 1:1 fallback for this pair
          }
        }),
      );

      const fxMaps: Record<string, Map<string, number>> = {};
      for (const [fc, data] of Object.entries(newFxDataMap)) {
        fxMaps[fc] = new Map(data.map((d) => [formatDate(d.date), d.nav]));
      }

      // fc per 1 ic at dateStr, searching forward first then backward ±7 days
      function getNearestFxForward(fc: string, dateStr: string): number {
        if (fc === ic) return 1;
        const fxMap = fxMaps[fc];
        if (!fxMap) return 1;
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

      const months = getMonthsBetween(startMonth, endMonth);
      const endDate = new Date(endDateStr + 'T23:59:59Z');

      // ── Portfolio A SIP ────────────────────────────────────────────────────
      const cumUnitsA: Record<string, number> = {};
      let totalInvestedA = 0;
      const investedByTcA: Record<string, number> = {};
      const investedByTcA_usd: Record<string, number> = {};
      const buyDetailsA: Record<string, TickerBuyDetail[]> = {};
      const txA: Array<{ amount: number; when: Date }> = [];
      const a_val: ValuePoint[] = [];

      months.forEach((monthStr) => {
        const investDate = new Date(monthStr + '-01T12:00:00Z');
        const lastDay = localMonthEndDateTime(monthStr);
        const investDateStr = monthToStartDate(monthStr);
        const endDateStrM = monthToEndDate(monthStr);

        validA.forEach((e) => {
          const ticker = e.ticker.trim().toUpperCase();
          const tc = newTickerCurrencyMap[ticker] ?? ic;
          const monthly = parseFloat(e.amount) || 0; // amount is in tc (ticker's native currency)
          const data = byTickerRaw[ticker];
          if (!data || data.length === 0 || monthly <= 0) return;
          const fxBuy = getNearestFxForward(tc, investDateStr); // tc per 1 ic
          const monthlyInIc = monthly / fxBuy; // convert tc → ic for display/XIRR (fxBuy=1 when tc=ic)
          const price = getNextAvailablePrice(data, investDateStr);
          if (price > 0) {
            cumUnitsA[ticker] = (cumUnitsA[ticker] ?? 0) + monthly / price;
            totalInvestedA += monthlyInIc;
            txA.push({ amount: -monthlyInIc, when: investDate });
            investedByTcA[tc] = (investedByTcA[tc] ?? 0) + monthly;
            investedByTcA_usd[tc] = (investedByTcA_usd[tc] ?? 0) + monthlyInIc;
            const actualBuyDateA = data.find((p) => formatDate(p.date) >= investDateStr);
            const { price: sellPriceA, date: actualSellDateA } = getNextAvailablePriceWithDate(data, endDateStrM);
            if (!buyDetailsA[monthStr]) buyDetailsA[monthStr] = [];
            buyDetailsA[monthStr].push({
              ticker,
              buyDate: actualBuyDateA ? formatDate(actualBuyDateA.date) : investDateStr,
              buyPrice: price,
              nativeCurrency: tc,
              nativeAmount: monthly,
              usdCashFlow: -monthlyInIc,
              sellDate: actualSellDateA,
              sellPrice: sellPriceA,
            });
          }
        });

        const valIC = Object.entries(cumUnitsA).reduce((sum, [ticker, units]) => {
          const data = byTickerRaw[ticker];
          if (!data) return sum;
          const tc = newTickerCurrencyMap[ticker] ?? ic;
          const price = getNextAvailablePrice(data, endDateStrM);
          const fxSell = getNearestFxForward(tc, endDateStrM);
          return sum + (units * price) / fxSell;
        }, 0);

        a_val.push({ date: lastDay, value: valIC });
      });

      // ── Portfolio B SIP ────────────────────────────────────────────────────
      const cumUnitsB: Record<string, number> = {};
      let totalInvestedB = 0;
      const investedByTcB: Record<string, number> = {};
      const investedByTcB_usd: Record<string, number> = {};
      const buyDetailsB: Record<string, TickerBuyDetail[]> = {};
      const txB: Array<{ amount: number; when: Date }> = [];
      const b_val: ValuePoint[] = [];

      months.forEach((monthStr) => {
        const investDate = new Date(monthStr + '-01T12:00:00Z');
        const lastDay = localMonthEndDateTime(monthStr);
        const investDateStr = monthToStartDate(monthStr);
        const endDateStrM = monthToEndDate(monthStr);

        validB.forEach((e) => {
          const ticker = e.ticker.trim().toUpperCase();
          const tc = newTickerCurrencyMap[ticker] ?? ic;
          const monthly = parseFloat(e.amount) || 0; // amount is in tc (ticker's native currency)
          const data = byTickerRaw[ticker];
          if (!data || data.length === 0 || monthly <= 0) return;
          const fxBuy = getNearestFxForward(tc, investDateStr); // tc per 1 ic
          const monthlyInIc = monthly / fxBuy; // convert tc → ic for display/XIRR (fxBuy=1 when tc=ic)
          const price = getNextAvailablePrice(data, investDateStr);
          if (price > 0) {
            cumUnitsB[ticker] = (cumUnitsB[ticker] ?? 0) + monthly / price;
            totalInvestedB += monthlyInIc;
            txB.push({ amount: -monthlyInIc, when: investDate });
            investedByTcB[tc] = (investedByTcB[tc] ?? 0) + monthly;
            investedByTcB_usd[tc] = (investedByTcB_usd[tc] ?? 0) + monthlyInIc;
            const actualBuyDateB = data.find((p) => formatDate(p.date) >= investDateStr);
            const { price: sellPriceB, date: actualSellDateB } = getNextAvailablePriceWithDate(data, endDateStrM);
            if (!buyDetailsB[monthStr]) buyDetailsB[monthStr] = [];
            buyDetailsB[monthStr].push({
              ticker,
              buyDate: actualBuyDateB ? formatDate(actualBuyDateB.date) : investDateStr,
              buyPrice: price,
              nativeCurrency: tc,
              nativeAmount: monthly,
              usdCashFlow: -monthlyInIc,
              sellDate: actualSellDateB,
              sellPrice: sellPriceB,
            });
          }
        });

        const valIC = Object.entries(cumUnitsB).reduce((sum, [ticker, units]) => {
          const data = byTickerRaw[ticker];
          if (!data) return sum;
          const tc = newTickerCurrencyMap[ticker] ?? ic;
          const price = getNextAvailablePrice(data, endDateStrM);
          const fxSell = getNearestFxForward(tc, endDateStrM);
          return sum + (units * price) / fxSell;
        }, 0);

        b_val.push({ date: lastDay, value: valIC });
      });

      const finalA = a_val.at(-1)?.value ?? 0;
      const finalB = b_val.at(-1)?.value ?? 0;
      const returnA = totalInvestedA > 0 ? ((finalA - totalInvestedA) / totalInvestedA) * 100 : 0;
      const returnB = totalInvestedB > 0 ? ((finalB - totalInvestedB) / totalInvestedB) * 100 : 0;
      const xirrA = calcXirr(txA, finalA, endDate);
      const xirrB = calcXirr(txB, finalB, endDate);

      // Build per-currency comparison series + invested totals for all foreign currencies
      const secValsByCurrency: Record<string, { a: ValuePoint[]; b: ValuePoint[] }> = {};
      for (const fc of foreignCurrencies) {
        if (!newFxDataMap[fc]) continue;
        const aVals: ValuePoint[] = [];
        const bVals: ValuePoint[] = [];
        months.forEach((monthStr, idx) => {
          const fx = getNearestFxForward(fc, monthToEndDate(monthStr));
          aVals.push({ date: a_val[idx].date, value: a_val[idx].value * fx });
          bVals.push({ date: b_val[idx].date, value: b_val[idx].value * fx });
        });
        secValsByCurrency[fc] = { a: aVals, b: bVals };
      }

      // Per-currency final values in USD: cumUnits × sell price ÷ FX rate
      const lastEndDateStr = monthToEndDate(endMonth);
      const finalByTcA_usd: Record<string, number> = {};
      Object.entries(cumUnitsA).forEach(([ticker, units]) => {
        const data = byTickerRaw[ticker];
        if (!data) return;
        const tc = newTickerCurrencyMap[ticker] ?? ic;
        const priceNative = units * getNextAvailablePrice(data, lastEndDateStr);
        const fxSell = getNearestFxForward(tc, lastEndDateStr); // tc per 1 USD (returns 1 when tc=USD)
        finalByTcA_usd[tc] = (finalByTcA_usd[tc] ?? 0) + priceNative / fxSell;
      });
      const finalByTcB_usd: Record<string, number> = {};
      Object.entries(cumUnitsB).forEach(([ticker, units]) => {
        const data = byTickerRaw[ticker];
        if (!data) return;
        const tc = newTickerCurrencyMap[ticker] ?? ic;
        const priceNative = units * getNextAvailablePrice(data, lastEndDateStr);
        const fxSell = getNearestFxForward(tc, lastEndDateStr);
        finalByTcB_usd[tc] = (finalByTcB_usd[tc] ?? 0) + priceNative / fxSell;
      });

      // Build summary rows: label = native currency, currency = USD, all values in USD
      const buildSummaryRows = (
        invUsd: Record<string, number>,
        finUsd: Record<string, number>,
      ): SummaryRow[] =>
        [...new Set([...Object.keys(invUsd), ...Object.keys(finUsd)])]
          .sort((a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b)))
          .map((tc) => {
            const inv = invUsd[tc] ?? 0;
            const fin = finUsd[tc] ?? 0;
            return { label: tc, currency: 'USD', invested: inv, finalValue: fin, returnPct: inv > 0 ? ((fin - inv) / inv) * 100 : 0 };
          });

      const summaryRowsA = buildSummaryRows(investedByTcA_usd, finalByTcA_usd);
      const summaryRowsB = buildSummaryRows(investedByTcB_usd, finalByTcB_usd);

      // XIRR monthly breakdown — per-ticker buy details + month-end portfolio value
      const buildBreakdown = (
        txList: Array<{ amount: number; when: Date }>,
        vals: ValuePoint[],
        monthList: string[],
        buyDetails: Record<string, TickerBuyDetail[]>,
      ): XirrRow[] => {
        let cumInvested = 0;
        return monthList.map((monthStr, idx) => {
          const prefix = monthStr + '-';
          const invested = -txList
            .filter((t) => formatDate(t.when).startsWith(prefix))
            .reduce((s, t) => s + t.amount, 0);
          cumInvested += invested;
          return {
            month: monthStr,
            investDateXirr: monthStr + '-01',
            buys: buyDetails[monthStr] ?? [],
            invested,
            cumInvested,
            portValue: vals[idx]?.value ?? 0,
          };
        });
      };
      const monthlyBreakdownA = buildBreakdown(txA, a_val, months, buyDetailsA);
      const monthlyBreakdownB = buildBreakdown(txB, b_val, months, buyDetailsB);

      // Persist to URL
      const entriesToStr = (entries: PortfolioEntry[]) =>
        entries
          .filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0)
          .map((e) => `${e.ticker}:${e.amount}:${e.currency}`)
          .join(',');
      const params = new URLSearchParams();
      const paStr = entriesToStr(portfolios[0].entries);
      const pbStr = entriesToStr(portfolios[1].entries);
      if (paStr) params.set('pa', paStr);
      if (pbStr) params.set('pb', pbStr);
      params.set('ic', ic);
      params.set('startMonth', startMonth);
      params.set('endMonth', endMonth);
      setSearchParams(params, { replace: true });

      setTickerCurrencyMap(newTickerCurrencyMap);
      setRawPriceData(byTickerRaw);
      setFxDataMap(newFxDataMap);
      setTickersA(validA.map((e) => e.ticker.trim().toUpperCase()));
      setTickersB(validB.map((e) => e.ticker.trim().toUpperCase()));
      setLoadedMeta({ ic });
      setResult({
        a_val, b_val, secValsByCurrency,
        totalInvestedA, totalInvestedB,
        finalA, finalB, returnA, returnB,
        xirrA, xirrB,
        summaryRowsA, summaryRowsB,
        monthlyBreakdownA, monthlyBreakdownB,
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load data. Check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  }, [portfolios, startMonth, endMonth, isRangeInvalid, setSearchParams]);

  const hasResults = result !== null && loadedMeta !== null;

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="SIP Cross-Market Compare">
        Invest a monthly amount across two portfolios in different markets. The <strong>Ticker CCY</strong> auto-detects from the ticker suffix (e.g. GOLDBEES.NS → INR, AAPL → USD) — enter your monthly amount in that currency. Override CCY only if needed.
      </PageIntro>

      <PageCard>
        {/* Portfolio sections */}
        <Block
          display="flex"
          flexDirection={['column', 'column', 'row']}
          gridGap="scale600"
          $style={{ flexWrap: 'wrap' }}
        >
          {portfolios.map((portfolio, idx) => (
            <Block
              key={portfolio.id}
              flex="1"
              overrides={{ Block: { style: { minWidth: '280px' } } }}
            >
              <PortfolioSection
                portfolio={portfolio}
                borderColor={PORTFOLIO_COLORS[idx]}
                onUpdate={(id, field, value) => handleUpdateEntry(portfolio.id, id, field, value)}
                onAddRow={() => handleAddRow(portfolio.id)}
                onRemoveRow={(id) => handleRemoveRow(portfolio.id, id)}
              />
            </Block>
          ))}
        </Block>

        {/* Date range + Plot */}
        <Block
          display="flex"
          alignItems="center"
          gridGap="scale300"
          marginTop="scale400"
          $style={{ flexWrap: 'wrap' }}
        >
          <LabelMedium marginBottom="0" marginTop="0">Start month</LabelMedium>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            style={dateInputStyle}
          />
          <LabelMedium marginBottom="0" marginTop="0">End month</LabelMedium>
          <input
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            style={dateInputStyle}
          />
          <Button kind="primary" onClick={handlePlot} isLoading={loading} disabled={isRangeInvalid}>
            Plot
          </Button>
          {isRangeInvalid && (
            <LabelMedium
              marginBottom="0"
              marginTop="0"
              overrides={{ Block: { style: ({ $theme }) => ({ color: $theme.colors.negative }) } }}
            >
              Start month must be before end month
            </LabelMedium>
          )}
        </Block>

        {error && (
          <ParagraphMedium color="contentNegative" marginTop="scale400">
            {error}
          </ParagraphMedium>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {hasResults && (
          <>
            <Block
              marginTop="scale600"
              marginBottom="scale600"
              overrides={{ Block: { style: { borderTop: '1px solid #e5e7eb' } } }}
            />

            {/* Summary cards — one row per native currency, no FX conversion */}
            <Block
              display="grid"
              gridGap="scale400"
              marginBottom="scale600"
              overrides={{
                Block: { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))' } },
              }}
            >
              <PortfolioSummaryCard
                label="Portfolio A"
                color={CHART_COLORS[0]}
                rows={result!.summaryRowsA}
                xirrVal={result!.xirrA}
              />
              <PortfolioSummaryCard
                label="Portfolio B"
                color={CHART_COLORS[1]}
                rows={result!.summaryRowsB}
                xirrVal={result!.xirrB}
              />
            </Block>

            {/* Comparison chart — investment currency */}
            <Block marginBottom="scale600">
              <LabelMedium marginBottom="scale300">
                Portfolio A vs Portfolio B — valued in {loadedMeta!.ic}
              </LabelMedium>
              <HighchartsReact
                highcharts={Highcharts}
                constructorType="stockChart"
                options={buildChartOptions(
                  result!.a_val,
                  result!.b_val,
                  'Portfolio A',
                  'Portfolio B',
                  `SIP Cross-Market Comparison (${loadedMeta!.ic})`,
                  loadedMeta!.ic,
                )}
                immutable
              />
            </Block>

            {/* Comparison charts — one per foreign currency (INR, JPY, GBP, etc.) */}
            {Object.entries(result!.secValsByCurrency).map(([fc, { a, b }]) =>
              a.length > 0 ? (
                <Block key={`sec-${fc}`} marginBottom="scale600">
                  <LabelMedium marginBottom="scale300">
                    Portfolio A vs Portfolio B — valued in {fc}
                  </LabelMedium>
                  <HighchartsReact
                    highcharts={Highcharts}
                    constructorType="stockChart"
                    options={buildChartOptions(
                      a, b,
                      'Portfolio A', 'Portfolio B',
                      `SIP Cross-Market Comparison (${fc})`,
                      fc,
                    )}
                    immutable
                  />
                </Block>
              ) : null
            )}

            {/* Portfolio A individual stock price charts */}
            {tickersA.filter((t) => rawPriceData[t]?.length > 0).map((ticker) => {
              const cur = tickerCurrencyMap[ticker] ?? loadedMeta!.ic;
              return (
                <Block key={`a-price-${ticker}`} marginBottom="scale600">
                  <LabelMedium marginBottom="scale300">{ticker} Price ({cur})</LabelMedium>
                  <StockPriceChart
                    data={rawPriceData[ticker]}
                    ticker={ticker}
                    chartTitle={`${ticker} Price`}
                    valueAxisTitle={`Price (${cur})`}
                    tooltipValueLabel={`${ticker} Price`}
                  />
                </Block>
              );
            })}

            {/* Portfolio B individual stock price charts */}
            {tickersB.filter((t) => rawPriceData[t]?.length > 0).map((ticker) => {
              const cur = tickerCurrencyMap[ticker] ?? loadedMeta!.ic;
              return (
                <Block key={`b-price-${ticker}`} marginBottom="scale600">
                  <LabelMedium marginBottom="scale300">{ticker} Price ({cur})</LabelMedium>
                  <StockPriceChart
                    data={rawPriceData[ticker]}
                    ticker={ticker}
                    chartTitle={`${ticker} Price`}
                    valueAxisTitle={`Price (${cur})`}
                    tooltipValueLabel={`${ticker} Price`}
                  />
                </Block>
              );
            })}

            {/* FX charts — one per foreign currency */}
            {Object.entries(fxDataMap)
              .filter(([, data]) => data.length > 1)
              .map(([fc, data]) => (
                <Block key={`fx-${fc}`} marginBottom="scale600">
                  <LabelMedium marginBottom="scale300">
                    {loadedMeta!.ic}/{fc} Exchange Rate
                  </LabelMedium>
                  <HighchartsReact
                    highcharts={Highcharts}
                    constructorType="stockChart"
                    options={buildFxChartOptions(data, loadedMeta!.ic, fc)}
                    immutable
                  />
                </Block>
              ))}

            {/* XIRR Breakdown Table — transaction dates, amounts, cash flows, portfolio values */}
            {(['A', 'B'] as const).map((which) => {
              const rows  = which === 'A' ? result!.monthlyBreakdownA : result!.monthlyBreakdownB;
              const xirr  = which === 'A' ? result!.xirrA : result!.xirrB;
              const final = which === 'A' ? result!.finalA : result!.finalB;
              const color = which === 'A' ? CHART_COLORS[0] : CHART_COLORS[1];

              const th = (extra?: React.CSSProperties): React.CSSProperties => ({
                padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#6b7280',
                borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', ...extra,
              });
              const td = (extra?: React.CSSProperties): React.CSSProperties => ({
                padding: '4px 10px', fontSize: 11, borderBottom: '1px solid #f3f4f6',
                whiteSpace: 'nowrap', textAlign: 'right', ...extra,
              });
              const sepRow: React.CSSProperties = {
                backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0',
              };

              return (
                <Block key={`xirr-${which}`} marginBottom="scale600">
                  <LabelMedium marginBottom="scale300" $style={{ color }}>
                    Portfolio {which} — XIRR Cash Flow Breakdown
                  </LabelMedium>
                  <Block overrides={{ Block: { style: { overflowX: 'auto' } } }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                          <th style={th({ textAlign: 'left' })}>XIRR Date</th>
                          <th style={th({ textAlign: 'left' })}>Ticker</th>
                          <th style={th({ textAlign: 'left' })}>Actual Buy Date</th>
                          <th style={th()}>Buy Price</th>
                          <th style={th({ textAlign: 'left' })}>Actual Sell Date</th>
                          <th style={th()}>Sell Price</th>
                          <th style={th()}>Amount (Native)</th>
                          <th style={th()}>Cash Flow (USD) ↓</th>
                          <th style={th()}>Port. Value (USD)</th>
                          <th style={th()}>Cumul. Invested</th>
                          <th style={th()}>Gain / Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.flatMap((r) => {
                          const isLastBuy = (i: number) => i === r.buys.length - 1;
                          const gainPct = r.cumInvested > 0
                            ? ((r.portValue - r.cumInvested) / r.cumInvested) * 100 : 0;

                          const buyRows = r.buys.map((b, i) => (
                            <tr key={`${r.month}-${b.ticker}`}>
                              <td style={td({ textAlign: 'left', color: '#6b7280' })}>
                                {i === 0 ? r.investDateXirr : ''}
                              </td>
                              <td style={td({ textAlign: 'left', fontWeight: 600 })}>{b.ticker}</td>
                              <td style={td({ textAlign: 'left' })}>{b.buyDate}</td>
                              <td style={td()}>
                                {getCurrencySymbol(b.nativeCurrency)}{b.buyPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                              </td>
                              <td style={td({ textAlign: 'left' })}>{b.sellDate}</td>
                              <td style={td()}>
                                {getCurrencySymbol(b.nativeCurrency)}{b.sellPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                              </td>
                              <td style={td()}>{formatAmount(b.nativeAmount, b.nativeCurrency)}</td>
                              <td style={td({ color: '#dc2626', fontWeight: 600 })}>
                                −{formatAmount(Math.abs(b.usdCashFlow), 'USD')}
                              </td>
                              <td style={td({ fontWeight: isLastBuy(i) ? 700 : 400, color: isLastBuy(i) ? '#111827' : '#d1d5db' })}>
                                {isLastBuy(i) ? formatAmount(r.portValue, 'USD') : '—'}
                              </td>
                              <td style={td({ color: isLastBuy(i) ? '#374151' : '#d1d5db' })}>
                                {isLastBuy(i) ? formatAmount(r.cumInvested, 'USD') : '—'}
                              </td>
                              <td style={td({
                                fontWeight: isLastBuy(i) ? 700 : 400,
                                color: isLastBuy(i)
                                  ? (gainPct >= 0 ? '#16a34a' : '#dc2626')
                                  : '#d1d5db',
                              })}>
                                {isLastBuy(i) ? formatReturn(gainPct) : '—'}
                              </td>
                            </tr>
                          ));

                          const sepRowEl = (
                            <tr key={`${r.month}-sep`} style={sepRow}>
                              <td colSpan={11} style={{ padding: 0, height: 4 }} />
                            </tr>
                          );

                          return [...buyRows, sepRowEl];
                        })}

                        {/* Final positive cash flow row */}
                        <tr style={{ backgroundColor: '#f0fdf4', fontWeight: 700 }}>
                          <td style={td({ textAlign: 'left', fontWeight: 700 })}>{formatDate(new Date())}</td>
                          <td style={td({ textAlign: 'left', fontWeight: 700 })}>Final (close)</td>
                          <td style={td({ textAlign: 'left' })}>—</td>
                          <td style={td()}>—</td>
                          <td style={td({ textAlign: 'left' })}>—</td>
                          <td style={td()}>—</td>
                          <td style={td()}>—</td>
                          <td style={td({ color: '#16a34a', fontWeight: 700 })}>
                            +{formatAmount(final, 'USD')}
                          </td>
                          <td style={td({ fontWeight: 700 })}>{formatAmount(final, 'USD')}</td>
                          <td style={td()}>—</td>
                          <td style={td()}>—</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#eff6ff' }}>
                          <td colSpan={11} style={{
                            padding: '8px 12px', fontSize: 13, fontWeight: 700,
                            color: xirr != null ? (xirr >= 0 ? '#16a34a' : '#dc2626') : '#374151',
                          }}>
                            XIRR (annualised): {xirr != null ? formatReturn(xirr * 100) : '—'}
                            &nbsp;&nbsp;|&nbsp;&nbsp;
                            Total Invested: {formatAmount(rows.at(-1)?.cumInvested ?? 0, 'USD')}
                            &nbsp;&nbsp;|&nbsp;&nbsp;
                            Final Value: {formatAmount(final, 'USD')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </Block>
                </Block>
              );
            })}
          </>
        )}
      </PageCard>
    </Block>
  );
}
