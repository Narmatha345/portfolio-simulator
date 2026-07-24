import { Block } from 'baseui/block';
import { Checkbox } from 'baseui/checkbox';
import { HeadingXSmall, LabelSmall, LabelXSmall, ParagraphSmall } from 'baseui/typography';
import React, { useMemo, useState } from 'react';
import { CorrelationCandidateRow } from '../../types/correlation';
import {
  CORRELATION_CATEGORY_ORDER,
  CORRELATION_CATEGORY_TITLES,
  CorrelationCategory,
} from '../../utils/calculations/correlation/classify';
import { CorrelationFrequency } from '../../utils/calculations/correlation/types';
import { CorrelationInfoTooltip } from './CorrelationInfoTooltip';
import { MultiHorizonBars } from './MultiHorizonBars';
import { correlationToColor } from './correlationColor';

type SortColumn = 'symbol' | 'daily' | 'weekly' | 'monthly' | 'longTerm' | 'observations' | 'stability';
type SortDir = 'asc' | 'desc';

const FREQUENCY_LABELS: Record<CorrelationFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  longTerm: 'Long-term',
};

interface CorrelationRankedGroupsProps {
  rows: CorrelationCandidateRow[];
  frequency: CorrelationFrequency;
  selectedSymbols: Set<string>;
  onToggleSelect: (symbol: string) => void;
  onOpenDetail: (symbol: string) => void;
  heading?: string;
}

function correlationCell(row: CorrelationCandidateRow, freq: CorrelationFrequency): React.ReactElement {
  const h = row.horizons?.[freq];
  if (!h || !h.available || h.correlation === null) {
    return <span style={{ color: '#94a3b8' }}>—</span>;
  }
  return <span style={{ color: correlationToColor(h.correlation), fontWeight: 600 }}>{h.correlation.toFixed(2)}</span>;
}

function sortValue(row: CorrelationCandidateRow, column: SortColumn, frequency: CorrelationFrequency): number | string {
  if (column === 'symbol') return row.symbol;
  if (column === 'stability') return row.stability ?? '';
  if (column === 'observations') return row.horizons?.[frequency]?.observations ?? -1;
  const h = row.horizons?.[column];
  return h?.correlation ?? -Infinity;
}

export const CorrelationRankedGroups: React.FC<CorrelationRankedGroupsProps> = ({
  rows,
  frequency,
  selectedSymbols,
  onToggleSelect,
  onOpenDetail,
  heading = 'Ranked results',
}) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>(frequency === 'longTerm' ? 'longTerm' : frequency);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const ready = useMemo(() => rows.filter((r) => r.status === 'ready'), [rows]);

  const grouped = useMemo(() => {
    const map = new Map<CorrelationCategory, CorrelationCandidateRow[]>();
    CORRELATION_CATEGORY_ORDER.forEach((c) => map.set(c, []));
    for (const row of ready) {
      if (!row.category) continue;
      map.get(row.category)!.push(row);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const va = sortValue(a, sortColumn, frequency);
        const vb = sortValue(b, sortColumn, frequency);
        const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : (va as number) - (vb as number);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return map;
  }, [ready, sortColumn, sortDir]);

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir('desc');
    }
  };

  const columns: Array<{ key: SortColumn; label: string }> = [
    { key: 'symbol', label: 'Symbol' },
    { key: frequency, label: FREQUENCY_LABELS[frequency] },
    { key: 'observations', label: 'Obs.' },
    { key: 'stability', label: 'Stability' },
  ];

  if (ready.length === 0) return null;

  return (
    <Block marginBottom="scale600">
      <Block display="flex" alignItems="center" gridGap="scale200" marginBottom="scale300">
        <LabelSmall $style={{ fontWeight: 700 }}>{heading}</LabelSmall>
        <CorrelationInfoTooltip />
      </Block>
      {CORRELATION_CATEGORY_ORDER.map((category) => {
        const list = grouped.get(category) ?? [];
        if (list.length === 0) return null;
        return (
          <Block key={category} marginBottom="scale600">
            <HeadingXSmall marginTop="0" marginBottom="scale300">
              {CORRELATION_CATEGORY_TITLES[category]} ({list.length})
            </HeadingXSmall>
            <Block overrides={{ Block: { style: { overflowX: 'auto' } } }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') handleSort(col.key);
                        }}
                        style={{ textAlign: 'left', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', userSelect: 'none' }}
                      >
                        {col.label}
                        {sortColumn === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e2e8f0' }}>Horizons</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e2e8f0' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.symbol} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px' }}>
                        <Checkbox
                          checked={selectedSymbols.has(row.symbol)}
                          onChange={() => onToggleSelect(row.symbol)}
                          aria-label={`Select ${row.symbol}`}
                        />
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <button
                          type="button"
                          onClick={() => onOpenDetail(row.symbol)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                        >
                          <LabelSmall $style={{ fontWeight: 700, color: '#1d4ed8' }}>{row.symbol}</LabelSmall>
                          <br />
                          <LabelXSmall color="contentTertiary">{row.name}</LabelXSmall>
                        </button>
                      </td>
                      <td style={{ padding: '6px 10px' }}>{correlationCell(row, frequency)}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <LabelXSmall>{row.horizons?.[frequency]?.observations ?? '—'}</LabelXSmall>
                        <br />
                        <LabelXSmall color="contentTertiary">
                          {row.horizons?.[frequency]?.startDate
                            ? `${row.horizons[frequency].startDate} → ${row.horizons[frequency].endDate}`
                            : ''}
                        </LabelXSmall>
                      </td>
                      <td style={{ padding: '6px 10px' }}>{row.stability ?? '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <MultiHorizonBars horizons={row.horizons} />
                      </td>
                      <td style={{ padding: '6px 10px', maxWidth: 220 }}>
                        {row.aiReason ? <ParagraphSmall margin="0">{row.aiReason}</ParagraphSmall> : null}
                        {row.currencyNote ? (
                          <ParagraphSmall margin="0" color="contentTertiary" $style={{ fontStyle: 'italic' }}>
                            {row.currencyNote}
                          </ParagraphSmall>
                        ) : null}
                        {row.isOptionContract ? (
                          <ParagraphSmall margin="0" color="negative">
                            Option contract — limited history/leverage can dominate correlation.
                          </ParagraphSmall>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
          </Block>
        );
      })}
    </Block>
  );
};
