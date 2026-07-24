import { Block } from 'baseui/block';
import { LabelSmall, ParagraphSmall } from 'baseui/typography';
import Highcharts from 'highcharts/esm/highcharts';
// Side-effect import: the ESM build auto-registers the heatmap series type on import,
// unlike the UMD /modules/heatmap build which expects a global `_Highcharts` and crashes
// under Vite/ESM when called as a factory function.
import 'highcharts/esm/modules/heatmap';
import HighchartsReact from 'highcharts-react-official';
import React, { useMemo, useState } from 'react';
import { CorrelationCandidateRow } from '../../types/correlation';
import {
  CORRELATION_CATEGORY_ORDER,
  CORRELATION_CATEGORY_TITLES,
  CorrelationCategory,
} from '../../utils/calculations/correlation/classify';
import { CORRELATION_COLOR_STOPS } from './correlationColor';

const HORIZON_COLUMNS: Array<{ key: 'daily' | 'weekly' | 'monthly' | 'longTerm'; label: string }> = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'longTerm', label: 'Long-term' },
];

const MAX_ROWS = 40;

interface CorrelationHeatmapProps {
  rows: CorrelationCandidateRow[];
  onCellClick?: (symbol: string, frequency: 'daily' | 'weekly' | 'monthly' | 'longTerm') => void;
  heading?: string;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ rows, onCellClick, heading = 'Correlation heatmap' }) => {
  const [categoryFilter, setCategoryFilter] = useState<CorrelationCategory | 'all'>('all');

  const ready = useMemo(() => rows.filter((r) => r.status === 'ready'), [rows]);

  const filtered = useMemo(() => {
    const base = categoryFilter === 'all' ? ready : ready.filter((r) => r.category === categoryFilter);
    return base
      .slice()
      .sort((a, b) => Math.abs(b.primaryCorrelation ?? 0) - Math.abs(a.primaryCorrelation ?? 0))
      .slice(0, MAX_ROWS);
  }, [ready, categoryFilter]);

  if (ready.length === 0) return null;

  const data: Array<[number, number, number | null]> = [];
  filtered.forEach((row, rowIndex) => {
    HORIZON_COLUMNS.forEach((col, colIndex) => {
      const h = row.horizons?.[col.key];
      data.push([colIndex, rowIndex, h?.available ? h.correlation : null]);
    });
  });

  const options: Highcharts.Options = {
    chart: {
      type: 'heatmap',
      height: Math.max(220, filtered.length * 26 + 80),
      backgroundColor: '#ffffff',
    },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: { categories: HORIZON_COLUMNS.map((c) => c.label), opposite: true },
    yAxis: {
      categories: filtered.map((r) => r.symbol),
      title: { text: undefined },
      reversed: true,
      labels: { style: { fontSize: '11px' } },
    },
    colorAxis: {
      min: -1,
      max: 1,
      stops: CORRELATION_COLOR_STOPS,
    },
    legend: { align: 'right', layout: 'vertical', verticalAlign: 'middle' },
    tooltip: {
      formatter: function (this: any) {
        const row = filtered[this.point.y];
        const col = HORIZON_COLUMNS[this.point.x];
        const v = this.point.value;
        return `<strong>${row?.symbol}</strong><br/>${col?.label}: ${v === null || v === undefined ? 'unavailable' : v.toFixed(2)}`;
      },
    },
    series: [
      {
        type: 'heatmap',
        data,
        nullColor: '#e2e8f0',
        cursor: onCellClick ? 'pointer' : undefined,
        point: {
          events: {
            click: function (this: any) {
              const row = filtered[this.y];
              const col = HORIZON_COLUMNS[this.x];
              if (row && col) onCellClick?.(row.symbol, col.key);
            },
          },
        },
        dataLabels: {
          enabled: true,
          color: '#0f172a',
          style: { fontSize: '10px', textOutline: 'none' },
          formatter: function (this: any) {
            const v = this.point.value;
            return v === null || v === undefined ? '' : v.toFixed(2);
          },
        },
      },
    ],
  };

  return (
    <Block marginBottom="scale600">
      <Block display="flex" alignItems="center" gridGap="scale300" marginBottom="scale300" flexWrap="wrap">
        <LabelSmall $style={{ fontWeight: 700 }}>{heading}</LabelSmall>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CorrelationCategory | 'all')}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          <option value="all">All categories</option>
          {CORRELATION_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CORRELATION_CATEGORY_TITLES[c]}
            </option>
          ))}
        </select>
        {ready.length > filtered.length && (
          <ParagraphSmall margin="0" color="contentTertiary">
            Showing top {filtered.length} of {ready.length} by strength.
          </ParagraphSmall>
        )}
      </Block>
      <ParagraphSmall margin="0" marginBottom="scale300" color="contentTertiary">
        A blank cell means there isn&apos;t enough overlapping price history for that frequency yet — minimum
        126 daily, 52 weekly, 24 monthly, or 36 months for long-term. It's never filled in with a shorter,
        less reliable window.
        {onCellClick && ' Click any cell to see the underlying prices and returns used to calculate it.'}
      </ParagraphSmall>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </Block>
  );
};
