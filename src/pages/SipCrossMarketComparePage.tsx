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

interface ResultData {
  a_val: ValuePoint[];
  b_val: ValuePoint[];
  a_val_sec: ValuePoint[];
  b_val_sec: ValuePoint[];
  secCurrency: string | null;
  totalInvestedA: number;
  totalInvestedB: number;
  totalInvestedA_sec: number; // invested total in secCurrency (sum of monthly FX conversions)
  totalInvestedB_sec: number;
  finalA: number;
  finalB: number;
  returnA: number;
  returnB: number;
  returnA_sec: number;
  returnB_sec: number;
  xirrA: number | null;
  xirrB: number | null;
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

// ─── Currency helpers ─────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr', HKD: 'HK$', SGD: 'S$',
  KRW: '₩', BRL: 'R$', MXN: 'MX$', ZAR: 'R', TWD: 'NT$',
  THB: '฿', IDR: 'Rp', MYR: 'RM', PHP: '₱', TRY: '₺', NGN: '₦',
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
// Row layout: Ticker | Ticker Currency | {icSym}/mo | Amount | Remove

function PortfolioSection({
  portfolio,
  borderColor,
  icSym,
  onUpdate,
  onAddRow,
  onRemoveRow,
}: {
  portfolio: PortfolioDef;
  borderColor: string;
  icSym: string;
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
            <LabelMedium marginBottom="0" marginTop="0">{icSym}/mo</LabelMedium>
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

function PortfolioSummaryCard({
  label,
  color,
  currency,
  invested,
  finalValue,
  returnPct,
  xirrVal,
  secCurrency,
  finalValueSec,
  investedSec,
  returnPctSec,
}: {
  label: string;
  color: string;
  currency: string;
  invested: number;
  finalValue: number;
  returnPct: number;
  xirrVal: number | null;
  secCurrency?: string;
  finalValueSec?: number;
  investedSec?: number;
  returnPctSec?: number;
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

        <LabelSmall color="contentSecondary">{currency}</LabelSmall>
        <LabelSmall $style={{ textAlign: 'right' }}>{formatAmount(invested, currency)}</LabelSmall>
        <LabelSmall $style={{ fontWeight: 700, textAlign: 'right' }}>{formatAmount(finalValue, currency)}</LabelSmall>
        <LabelSmall
          $style={{
            fontWeight: 700,
            textAlign: 'right',
            color: returnPct >= 0 ? '#16a34a' : '#dc2626',
          }}
        >
          {formatReturn(returnPct)}
        </LabelSmall>

        {secCurrency != null && finalValueSec != null && (
          <>
            <LabelSmall color="contentSecondary">{secCurrency}</LabelSmall>
            <LabelSmall $style={{ textAlign: 'right' }}>
              {investedSec != null ? formatAmount(investedSec, secCurrency) : '—'}
            </LabelSmall>
            <LabelSmall $style={{ fontWeight: 700, textAlign: 'right' }}>
              {formatAmount(finalValueSec, secCurrency)}
            </LabelSmall>
            <LabelSmall
              $style={{
                fontWeight: 700,
                textAlign: 'right',
                color: returnPctSec != null
                  ? returnPctSec >= 0 ? '#16a34a' : '#dc2626'
                  : '#9ca3af',
              }}
            >
              {returnPctSec != null ? formatReturn(returnPctSec) : '—'}
            </LabelSmall>
          </>
        )}
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

export default function SipCrossMarketComparePage({
  defaultInvestCurrency = 'USD',
}: {
  defaultInvestCurrency?: string;
} = {}): React.ReactElement {
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

  const [investCurrency, setInvestCurrency] = useState(
    () => searchParams.get('ic') ?? defaultInvestCurrency,
  );
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

    const ic = investCurrency.trim().toUpperCase() || 'USD';

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
        const tc = e.currency.trim().toUpperCase() || inferCurrency(ticker, ic);
        newTickerCurrencyMap[ticker] = tc;
      });

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

      // Determine secondary display currency before loops so we can track sec invested
      const secCurrency = foreignCurrencies.length > 0 ? foreignCurrencies[0] : null;

      // ── Portfolio A SIP ────────────────────────────────────────────────────
      const cumUnitsA: Record<string, number> = {};
      let totalInvestedA = 0;
      let totalInvestedA_sec = 0; // sum of monthly investments converted to secCurrency at buy date
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
          const monthly = parseFloat(e.amount) || 0;
          const data = byTickerRaw[ticker];
          if (!data || data.length === 0 || monthly <= 0) return;
          const fxBuy = getNearestFxForward(tc, investDateStr);
          const monthlyInTc = monthly * fxBuy;
          const price = getNextAvailablePrice(data, investDateStr);
          if (price > 0) {
            cumUnitsA[ticker] = (cumUnitsA[ticker] ?? 0) + monthlyInTc / price;
            totalInvestedA += monthly;
            txA.push({ amount: -monthly, when: investDate });
            if (secCurrency) {
              totalInvestedA_sec += monthly * getNearestFxForward(secCurrency, investDateStr);
            }
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
      let totalInvestedB_sec = 0;
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
          const monthly = parseFloat(e.amount) || 0;
          const data = byTickerRaw[ticker];
          if (!data || data.length === 0 || monthly <= 0) return;
          const fxBuy = getNearestFxForward(tc, investDateStr);
          const monthlyInTc = monthly * fxBuy;
          const price = getNextAvailablePrice(data, investDateStr);
          if (price > 0) {
            cumUnitsB[ticker] = (cumUnitsB[ticker] ?? 0) + monthlyInTc / price;
            totalInvestedB += monthly;
            txB.push({ amount: -monthly, when: investDate });
            if (secCurrency) {
              totalInvestedB_sec += monthly * getNearestFxForward(secCurrency, investDateStr);
            }
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

      // Secondary currency series (e.g. INR): ic value × fx at month-end
      const a_val_sec: ValuePoint[] = [];
      const b_val_sec: ValuePoint[] = [];
      if (secCurrency && newFxDataMap[secCurrency]) {
        months.forEach((monthStr, idx) => {
          const fx = getNearestFxForward(secCurrency, monthToEndDate(monthStr));
          a_val_sec.push({ date: a_val[idx].date, value: a_val[idx].value * fx });
          b_val_sec.push({ date: b_val[idx].date, value: b_val[idx].value * fx });
        });
      }

      const finalA_sec = a_val_sec.at(-1)?.value ?? 0;
      const finalB_sec = b_val_sec.at(-1)?.value ?? 0;
      const returnA_sec = totalInvestedA_sec > 0 ? ((finalA_sec - totalInvestedA_sec) / totalInvestedA_sec) * 100 : 0;
      const returnB_sec = totalInvestedB_sec > 0 ? ((finalB_sec - totalInvestedB_sec) / totalInvestedB_sec) * 100 : 0;

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
        a_val, b_val, a_val_sec, b_val_sec, secCurrency,
        totalInvestedA, totalInvestedB,
        totalInvestedA_sec, totalInvestedB_sec,
        finalA, finalB, returnA, returnB,
        returnA_sec, returnB_sec,
        xirrA, xirrB,
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load data. Check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  }, [portfolios, investCurrency, startMonth, endMonth, isRangeInvalid, setSearchParams]);

  const hasResults = result !== null && loadedMeta !== null;
  const icSym = getCurrencySymbol(investCurrency.trim().toUpperCase() || 'USD');

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="SIP Cross-Market Compare">
        Invest the same monthly amount across two portfolios in different markets. Enter a shared <strong>Investment Currency</strong> (e.g. USD). The <strong>Ticker CCY</strong> field auto-detects from the ticker suffix (e.g. GOLDBEES.NS → INR, AAPL → USD) — override only if needed. FX conversion is applied automatically.
      </PageIntro>

      <PageCard>
        {/* Shared investment currency */}
        <Block marginBottom="scale600">
          <LabelSmall marginBottom="scale200">Investment Currency</LabelSmall>
          <Block display="flex" alignItems="center" gridGap="scale300">
            <Input
              value={investCurrency}
              placeholder="USD"
              onChange={(e) => setInvestCurrency((e.target as HTMLInputElement).value.toUpperCase())}
              overrides={{ Root: { style: { maxWidth: '120px' } } }}
            />
            <LabelSmall $style={{ color: '#9ca3af' }}>
              The amount per row is in this currency. Ticker Currency = the stock&apos;s native market (e.g. INR for BSE/NSE, USD for NYSE/NASDAQ).
            </LabelSmall>
          </Block>
        </Block>

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
                icSym={icSym}
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

            {/* Summary cards */}
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
                currency={loadedMeta!.ic}
                invested={result!.totalInvestedA}
                finalValue={result!.finalA}
                returnPct={result!.returnA}
                xirrVal={result!.xirrA}
                secCurrency={result!.secCurrency ?? undefined}
                finalValueSec={result!.a_val_sec.at(-1)?.value}
                investedSec={result!.totalInvestedA_sec > 0 ? result!.totalInvestedA_sec : undefined}
                returnPctSec={result!.secCurrency ? result!.returnA_sec : undefined}
              />
              <PortfolioSummaryCard
                label="Portfolio B"
                color={CHART_COLORS[1]}
                currency={loadedMeta!.ic}
                invested={result!.totalInvestedB}
                finalValue={result!.finalB}
                returnPct={result!.returnB}
                xirrVal={result!.xirrB}
                secCurrency={result!.secCurrency ?? undefined}
                finalValueSec={result!.b_val_sec.at(-1)?.value}
                investedSec={result!.totalInvestedB_sec > 0 ? result!.totalInvestedB_sec : undefined}
                returnPctSec={result!.secCurrency ? result!.returnB_sec : undefined}
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

            {/* Comparison chart — secondary currency (e.g. INR) */}
            {result!.secCurrency && result!.a_val_sec.length > 0 && (
              <Block marginBottom="scale600">
                <LabelMedium marginBottom="scale300">
                  Portfolio A vs Portfolio B — valued in {result!.secCurrency}
                </LabelMedium>
                <HighchartsReact
                  highcharts={Highcharts}
                  constructorType="stockChart"
                  options={buildChartOptions(
                    result!.a_val_sec,
                    result!.b_val_sec,
                    'Portfolio A',
                    'Portfolio B',
                    `SIP Cross-Market Comparison (${result!.secCurrency})`,
                    result!.secCurrency,
                  )}
                  immutable
                />
              </Block>
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
          </>
        )}
      </PageCard>
    </Block>
  );
}
