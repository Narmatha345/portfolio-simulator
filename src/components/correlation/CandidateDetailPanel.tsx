import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { HeadingXSmall, LabelSmall, ParagraphSmall } from 'baseui/typography';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import React from 'react';
import { useCandidateDetail } from '../../hooks/correlation/useCandidateDetail';
import { CorrelationCandidateRow } from '../../types/correlation';
import { AnalysisPeriod, CorrelationFrequency, PriceSeries } from '../../utils/calculations/correlation/types';
import { correlationToColor } from './correlationColor';
import { MultiHorizonBars } from './MultiHorizonBars';

interface CandidateDetailPanelProps {
  row: CorrelationCandidateRow;
  primaryTicker: string;
  primaryPrices: PriceSeries;
  frequency: CorrelationFrequency;
  period: AnalysisPeriod;
  onClose: () => void;
}

const FREQUENCY_LABEL: Record<CorrelationFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  longTerm: 'Long-term (monthly)',
};

export const CandidateDetailPanel: React.FC<CandidateDetailPanelProps> = ({
  row,
  primaryTicker,
  primaryPrices,
  frequency,
  period,
  onClose,
}) => {
  const detail = useCandidateDetail(primaryPrices, row.symbol, frequency, period);

  const scatterOptions: Highcharts.Options = {
    chart: { type: 'scatter', height: 340 },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: { title: { text: `${primaryTicker} return` } },
    yAxis: { title: { text: `${row.symbol} return` }, plotLines: [{ value: 0, color: '#cbd5e1', width: 1 }] },
    legend: { enabled: true },
    tooltip: {
      formatter: function (this: any) {
        return `${primaryTicker}: ${(this.x * 100).toFixed(2)}%<br/>${row.symbol}: ${(this.y * 100).toFixed(2)}%`;
      },
    },
    series: [
      {
        type: 'scatter',
        name: `${primaryTicker} vs ${row.symbol}`,
        data: detail.scatter.map((p) => [p.x, p.y]),
        color: 'rgba(37, 99, 235, 0.55)',
        marker: { radius: 3 },
      },
      ...(detail.regression && detail.scatter.length > 0
        ? [
            (() => {
              const xs = detail.scatter.map((p) => p.x);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              return {
                type: 'line' as const,
                name: 'Regression line',
                data: [
                  [minX, detail.regression!.slope * minX + detail.regression!.intercept],
                  [maxX, detail.regression!.slope * maxX + detail.regression!.intercept],
                ],
                color: '#b91c1c',
                marker: { enabled: false },
                enableMouseTracking: false,
              };
            })(),
          ]
        : []),
    ],
  };

  const rollingOptions: Highcharts.Options = {
    chart: { type: 'line', height: 300 },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: { type: 'datetime', title: { text: 'Date' } },
    yAxis: {
      title: { text: 'Rolling correlation' },
      min: -1,
      max: 1,
      plotLines: [{ value: 0, color: '#94a3b8', width: 1, zIndex: 5 }],
    },
    legend: { enabled: false },
    tooltip: {
      formatter: function (this: any) {
        return `${Highcharts.dateFormat('%e %b %Y', this.x)}<br/>Rolling correlation: ${this.y.toFixed(2)}`;
      },
    },
    series: [
      {
        type: 'line',
        name: 'Rolling correlation',
        data: detail.rolling.map((p) => [p.date.getTime(), p.correlation]),
        color: '#0369a1',
        marker: { enabled: false },
      },
    ],
  };

  return (
    <Block
      marginBottom="scale600"
      padding="scale600"
      overrides={{
        Block: {
          style: {
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            backgroundColor: '#fafafa',
          },
        },
      }}
    >
      <Block display="flex" justifyContent="space-between" alignItems="flex-start" marginBottom="scale400">
        <Block>
          <HeadingXSmall marginTop="0" marginBottom="scale100">
            {row.symbol} — {row.name}
          </HeadingXSmall>
          <ParagraphSmall margin="0" color="contentSecondary">
            vs {primaryTicker} · {FREQUENCY_LABEL[frequency]} view · {detail.observations} overlapping observations
          </ParagraphSmall>
        </Block>
        <Button kind="tertiary" size="compact" onClick={onClose}>
          Close
        </Button>
      </Block>

      {row.currencyNote && (
        <ParagraphSmall color="contentTertiary" $style={{ fontStyle: 'italic' }}>
          {row.currencyNote}
        </ParagraphSmall>
      )}

      <Block display="flex" gridGap="scale600" flexWrap="wrap" marginBottom="scale400">
        <Block>
          <LabelSmall marginBottom="scale200">Correlation by horizon</LabelSmall>
          <MultiHorizonBars horizons={row.horizons} width={140} height={50} />
        </Block>
        <Block>
          <LabelSmall marginBottom="scale200">Stability</LabelSmall>
          <ParagraphSmall margin="0">{row.stability ?? '—'}</ParagraphSmall>
        </Block>
        {row.primaryCorrelation !== undefined && (
          <Block>
            <LabelSmall marginBottom="scale200">Selected horizon correlation</LabelSmall>
            <ParagraphSmall margin="0" $style={{ color: correlationToColor(row.primaryCorrelation), fontWeight: 700 }}>
              {row.primaryCorrelation.toFixed(2)} ({row.categoryLabel})
            </ParagraphSmall>
          </Block>
        )}
      </Block>

      {detail.error && <ParagraphSmall color="negative">{detail.error}</ParagraphSmall>}

      {!detail.error && (
        <>
          <LabelSmall marginBottom="scale200">Scatter plot ({FREQUENCY_LABEL[frequency]} returns) with regression line</LabelSmall>
          <Block marginBottom="scale500">
            <HighchartsReact highcharts={Highcharts} options={scatterOptions} />
          </Block>

          <LabelSmall marginBottom="scale200">
            Rolling correlation (window: {detail.rollingWindow} {frequency === 'daily' ? 'trading days' : frequency === 'weekly' ? 'weeks' : 'months'})
          </LabelSmall>
          <Block>
            <HighchartsReact highcharts={Highcharts} options={rollingOptions} />
          </Block>
        </>
      )}

      <ParagraphSmall marginTop="scale400" color="contentTertiary" $style={{ fontStyle: 'italic' }}>
        Correlation does not imply causation, and relationships can change sharply during market stress.
      </ParagraphSmall>
    </Block>
  );
};
