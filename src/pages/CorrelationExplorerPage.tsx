import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { ParagraphSmall } from 'baseui/typography';
import { toaster } from 'baseui/toast';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CandidateDetailPanel } from '../components/correlation/CandidateDetailPanel';
import { CorrelationCalculationTable } from '../components/correlation/CorrelationCalculationTable';
import { CorrelationControls } from '../components/correlation/CorrelationControls';
import { CorrelationHeatmap } from '../components/correlation/CorrelationHeatmap';
import { CorrelationRankedGroups } from '../components/correlation/CorrelationRankedGroups';
import { CorrelationScanSkeleton } from '../components/correlation/CorrelationScanSkeleton';
import { CorrelationSpectrum } from '../components/correlation/CorrelationSpectrum';
import { PageCard, PageIntro } from '../components/common/PageChrome';
import { useCorrelationExplorer } from '../hooks/useCorrelationExplorer';
import { buildCsv, downloadCsv } from '../utils/browser/downloadCsv';
import { CorrelationFrequency } from '../utils/calculations/correlation/types';

export default function CorrelationExplorerPage(): React.ReactElement {
  const explorer = useCorrelationExplorer();
  const navigate = useNavigate();

  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);
  const [auditCell, setAuditCell] = useState<{ symbol: string; frequency: CorrelationFrequency } | null>(null);

  const toggleSelect = (symbol: string) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const readyRows = useMemo(() => explorer.rows.filter((r) => r.status === 'ready'), [explorer.rows]);
  const problemRows = useMemo(
    () => explorer.rows.filter((r) => r.status === 'invalid' || r.status === 'insufficient-history'),
    [explorer.rows]
  );
  const detailRow = detailSymbol ? explorer.rows.find((r) => r.symbol === detailSymbol) : undefined;

  const handleExportCsv = () => {
    const headers = ['Symbol', 'Name', 'Asset Type', 'Category', 'Daily', 'Weekly', 'Monthly', 'Long-term', 'Observations (daily)', 'Start', 'End', 'Stability', 'Source', 'AI Reason'];
    const rows = readyRows.map((r) => [
      r.symbol,
      r.name,
      r.assetType,
      r.categoryLabel ?? '',
      r.horizons?.daily.correlation?.toFixed(4) ?? '',
      r.horizons?.weekly.correlation?.toFixed(4) ?? '',
      r.horizons?.monthly.correlation?.toFixed(4) ?? '',
      r.horizons?.longTerm.correlation?.toFixed(4) ?? '',
      r.horizons?.daily.observations ?? '',
      r.horizons?.daily.startDate ?? '',
      r.horizons?.daily.endDate ?? '',
      r.stability ?? '',
      r.source,
      r.aiReason ?? '',
    ]);
    downloadCsv(`correlation-${explorer.primaryTicker}.csv`, buildCsv(headers, rows));
  };

  const handleSendToSimulator = async () => {
    if (selectedSymbols.size === 0) {
      toaster.warning('Select at least one candidate first.', { autoHideDuration: 3000 });
      return;
    }
    const pa = Array.from(selectedSymbols)
      .map((s) => `${s}:100`)
      .join(',');
    navigate(`/stock-price?pa=${encodeURIComponent(pa)}`);
  };

  const handleCopySymbols = async () => {
    if (selectedSymbols.size === 0) {
      toaster.warning('Select at least one candidate first.', { autoHideDuration: 3000 });
      return;
    }
    const text = Array.from(selectedSymbols).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      toaster.positive('Symbols copied to clipboard.', { autoHideDuration: 3000 });
    } catch {
      toaster.warning(text, { autoHideDuration: 8000 });
    }
  };

  return (
    <Block position="relative">
      <PageIntro title="Stock Correlation Explorer">
        Enter a stock or ETF, choose a date range and candidate universe, and calculate correlations from adjusted
        market-price returns. AI can optionally suggest candidate symbols to test, but every correlation value shown here is
        computed deterministically from market data — never from AI.
      </PageIntro>

      <PageCard>
        <CorrelationControls {...explorer} />

        {explorer.error && (
          <ParagraphSmall color="negative" marginBottom="scale400">
            {explorer.error}
          </ParagraphSmall>
        )}
        {explorer.aiWarning && (
          <ParagraphSmall color="warning" marginBottom="scale400">
            {explorer.aiWarning}
          </ParagraphSmall>
        )}
        {explorer.isScanning && explorer.progress && (
          <>
            <ParagraphSmall marginBottom="scale300">
              Calculating {explorer.progress.completed} of {explorer.progress.total} assets
              {explorer.progress.currentSymbol ? ` (${explorer.progress.currentSymbol})` : ''}...
            </ParagraphSmall>
            <CorrelationScanSkeleton rowCount={Math.min(5, Math.max(1, explorer.progress.total - explorer.progress.completed))} />
          </>
        )}

        {readyRows.length > 0 && (
          <>
            <CorrelationSpectrum
              primaryTicker={explorer.primaryTicker}
              rows={explorer.rows}
              selectedSymbol={detailSymbol}
              onSelect={setDetailSymbol}
            />

            <Block display="flex" gridGap="scale300" flexWrap="wrap" marginBottom="scale500">
              <Button kind="secondary" size="compact" onClick={handleExportCsv}>
                Export CSV
              </Button>
              <Button kind="secondary" size="compact" onClick={handleCopySymbols} disabled={selectedSymbols.size === 0}>
                Copy selected symbols
              </Button>
              <Button kind="primary" size="compact" onClick={() => void handleSendToSimulator()} disabled={selectedSymbols.size === 0}>
                Send selected to Portfolio Simulator ({selectedSymbols.size})
              </Button>
            </Block>

            {detailRow && (
              <CandidateDetailPanel
                row={detailRow}
                primaryTicker={explorer.primaryTicker}
                primaryPrices={explorer.primaryPrices!}
                frequency={explorer.frequency}
                dateRange={{ startDate: explorer.startDate, endDate: explorer.endDate }}
                onClose={() => setDetailSymbol(null)}
              />
            )}

            <CorrelationHeatmap
              rows={explorer.rows}
              onCellClick={(symbol, cellFrequency) => setAuditCell({ symbol, frequency: cellFrequency })}
            />

            {auditCell && (
              <CorrelationCalculationTable
                primaryTicker={explorer.primaryTicker}
                primaryPrices={explorer.primaryPrices!}
                candidateSymbol={auditCell.symbol}
                frequency={auditCell.frequency}
                dateRange={{ startDate: explorer.startDate, endDate: explorer.endDate }}
                onClose={() => setAuditCell(null)}
              />
            )}

            <CorrelationRankedGroups
              rows={explorer.rows}
              frequency={explorer.frequency}
              selectedSymbols={selectedSymbols}
              onToggleSelect={toggleSelect}
              onOpenDetail={setDetailSymbol}
            />

            {problemRows.length > 0 && (
              <Block marginTop="scale400">
                <ParagraphSmall color="contentTertiary">
                  {problemRows.length} symbol{problemRows.length === 1 ? '' : 's'} excluded (invalid, delisted, or insufficient
                  overlapping history): {problemRows.map((r) => r.symbol).join(', ')}
                </ParagraphSmall>
              </Block>
            )}
          </>
        )}

        {!explorer.isScanning && explorer.rows.length === 0 && !explorer.error && (
          <ParagraphSmall color="contentSecondary">
            Choose your settings and click &quot;Find correlations&quot; to scan the candidate universe.
          </ParagraphSmall>
        )}
      </PageCard>
    </Block>
  );
}
