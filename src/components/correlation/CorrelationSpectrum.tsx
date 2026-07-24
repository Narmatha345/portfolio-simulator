import { Block } from 'baseui/block';
import { LabelSmall, LabelXSmall, ParagraphSmall } from 'baseui/typography';
import React from 'react';
import { CorrelationCandidateRow } from '../../types/correlation';
import { correlationToColor } from './correlationColor';
import { CorrelationInfoTooltip } from './CorrelationInfoTooltip';

interface CorrelationSpectrumProps {
  primaryTicker: string;
  rows: CorrelationCandidateRow[];
  selectedSymbol?: string | null;
  onSelect: (symbol: string) => void;
  heading?: string;
}

const TICKS = [-1, -0.7, -0.3, 0, 0.3, 0.7, 1];
const LANES = 3;

function laneFor(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return hash % LANES;
}

function valueToPercent(value: number): number {
  return ((Math.max(-1, Math.min(1, value)) + 1) / 2) * 100;
}

export const CorrelationSpectrum: React.FC<CorrelationSpectrumProps> = ({
  primaryTicker,
  rows,
  selectedSymbol,
  onSelect,
  heading = 'Correlation spectrum',
}) => {
  const ready = rows.filter((r) => r.status === 'ready' && r.primaryCorrelation !== undefined);

  return (
    <Block marginBottom="scale600">
      <Block display="flex" alignItems="baseline" gridGap="scale200" marginBottom="scale400">
        <LabelSmall $style={{ fontWeight: 700 }}>{heading}</LabelSmall>
        <ParagraphSmall color="contentSecondary" margin="0">
          vs <strong>{primaryTicker}</strong> — click a point to open its detail view
        </ParagraphSmall>
        <CorrelationInfoTooltip />
      </Block>
      <ParagraphSmall margin="0" marginBottom="scale300" color="contentTertiary">
        Only horizontal position is meaningful (each dot's correlation value). Vertical position is just
        jitter to keep overlapping dots readable — it doesn&apos;t represent anything.
      </ParagraphSmall>

      <Block position="relative" height={`${LANES * 26 + 40}px`} paddingTop="scale300">
        {/* Track */}
        <Block
          position="absolute"
          top={`${LANES * 26 / 2 + 4}px`}
          left="0"
          width="100%"
          height="2px"
          backgroundColor="borderOpaque"
        />

        {/* Ticks */}
        {TICKS.map((t) => (
          <Block key={t} position="absolute" top="0" left={`${valueToPercent(t)}%`} $style={{ transform: 'translateX(-50%)' }}>
            <Block width="1px" height={`${LANES * 26 + 8}px`} backgroundColor="borderOpaque" $style={{ opacity: 0.4 }} />
            <LabelXSmall color="contentTertiary" $style={{ position: 'absolute', top: `${LANES * 26 + 10}px`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
              {t > 0 ? `+${t.toFixed(1)}` : t.toFixed(1)}
            </LabelXSmall>
          </Block>
        ))}

        {/* Candidate points */}
        {ready.map((row) => {
          const value = row.primaryCorrelation!;
          const lane = laneFor(row.symbol);
          const isSelected = row.symbol === selectedSymbol;
          return (
            <button
              key={row.symbol}
              type="button"
              onClick={() => onSelect(row.symbol)}
              aria-label={`${row.symbol}: correlation ${value.toFixed(2)} (${row.categoryLabel ?? ''})`}
              title={`${row.symbol} — ${value.toFixed(2)} (${row.categoryLabel ?? ''})`}
              style={{
                position: 'absolute',
                left: `${valueToPercent(value)}%`,
                top: `${lane * 26 + 2}px`,
                transform: 'translateX(-50%)',
                width: isSelected ? 14 : 10,
                height: isSelected ? 14 : 10,
                borderRadius: '50%',
                background: correlationToColor(value),
                border: isSelected ? '2px solid #0f172a' : '1px solid rgba(0,0,0,0.15)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          );
        })}
      </Block>
    </Block>
  );
};
