import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { HeadingXSmall, ParagraphSmall } from 'baseui/typography';
import React, { useEffect, useState } from 'react';
import { yahooFinanceService } from '../../services/yahooFinanceService';
import { buildCalculationAuditTable, CalculationAuditRow } from '../../utils/calculations/correlation/auditTable';
import { pearsonCorrelation } from '../../utils/calculations/correlation/pearson';
import { CorrelationFrequency, DateRange, PriceSeries } from '../../utils/calculations/correlation/types';

interface CorrelationCalculationTableProps {
  primaryTicker: string;
  primaryPrices: PriceSeries;
  candidateSymbol: string;
  frequency: CorrelationFrequency;
  dateRange: DateRange;
  onClose: () => void;
}

const FREQUENCY_LABEL: Record<CorrelationFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  longTerm: 'Long-term (monthly)',
};

function formatReturn(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(3)}%`;
}

function formatPrice(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * Shows the exact aligned adjusted-close prices and log returns behind one correlation
 * value, so a user can manually re-derive it (e.g. paste into a spreadsheet and run CORREL()).
 */
export const CorrelationCalculationTable: React.FC<CorrelationCalculationTableProps> = ({
  primaryTicker,
  primaryPrices,
  candidateSymbol,
  frequency,
  dateRange,
  onClose,
}) => {
  const [rows, setRows] = useState<CalculationAuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    (async () => {
      try {
        const candidatePrices = await yahooFinanceService.fetchStockData(candidateSymbol);
        if (cancelled) return;
        setRows(buildCalculationAuditTable(primaryPrices, candidatePrices, frequency, dateRange));
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Failed to load calculation detail.');
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryPrices, candidateSymbol, frequency, dateRange.startDate, dateRange.endDate]);

  const returnRows = (rows ?? []).filter((r) => r.primaryReturn !== null && r.candidateReturn !== null);
  const correlation =
    returnRows.length > 0
      ? pearsonCorrelation(
          returnRows.map((r) => r.primaryReturn as number),
          returnRows.map((r) => r.candidateReturn as number)
        )
      : NaN;

  return (
    <Block
      marginBottom="scale600"
      padding="scale600"
      overrides={{
        Block: { style: { border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#fafafa' } },
      }}
    >
      <Block display="flex" justifyContent="space-between" alignItems="flex-start" marginBottom="scale300" flexWrap="wrap" gridGap="scale300">
        <Block>
          <HeadingXSmall marginTop="0" marginBottom="scale100">
            Calculation detail: {primaryTicker} vs {candidateSymbol}
          </HeadingXSmall>
          <ParagraphSmall margin="0" color="contentSecondary">
            {FREQUENCY_LABEL[frequency]} · {returnRows.length} return observations
            {Number.isFinite(correlation) ? ` · Pearson correlation = ${correlation.toFixed(4)}` : ''}
          </ParagraphSmall>
        </Block>
        <Button kind="tertiary" size="compact" onClick={onClose}>
          Close
        </Button>
      </Block>

      {error && <ParagraphSmall color="negative">{error}</ParagraphSmall>}
      {!error && rows === null && <ParagraphSmall color="contentSecondary">Loading underlying data...</ParagraphSmall>}
      {rows !== null && rows.length === 0 && (
        <ParagraphSmall color="contentSecondary">No overlapping observations for this frequency.</ParagraphSmall>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <ParagraphSmall margin="0" marginBottom="scale300" color="contentTertiary">
            return[t] = ln(price[t] / price[t-1]). The first row has no prior observation, so its return is blank.
            The Pearson correlation above is calculated from the two return columns only.
          </ParagraphSmall>
          <Block
            overrides={{
              Block: {
                style: { overflowX: 'auto', maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' },
              },
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>
                    Date
                  </th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>
                    {primaryTicker} close
                  </th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>
                    {primaryTicker} return
                  </th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>
                    {candidateSymbol} close
                  </th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>
                    {candidateSymbol} return
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 10px' }}>{row.date}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPrice(row.primaryClose)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatReturn(row.primaryReturn)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatPrice(row.candidateClose)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{formatReturn(row.candidateReturn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        </>
      )}
    </Block>
  );
};
