import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Input } from 'baseui/input';
import { LabelSmall } from 'baseui/typography';
import { toaster } from 'baseui/toast';
import React from 'react';
import { UseCorrelationExplorerResult } from '../../hooks/useCorrelationExplorer';
import { AiProvider, AssetUniverseSelection } from '../../types/correlation';
import { CorrelationFrequency } from '../../utils/calculations/correlation/types';

const selectStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  fontFamily: 'inherit',
  backgroundColor: '#fff',
};

const dateInputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  fontFamily: 'inherit',
  backgroundColor: '#fff',
};

const FREQUENCY_OPTIONS: Array<{ value: CorrelationFrequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'longTerm', label: 'Long term' },
];

const UNIVERSE_OPTIONS: Array<{ value: AssetUniverseSelection; label: string }> = [
  { value: 'us-stocks', label: 'US stocks' },
  { value: 'etfs', label: 'ETFs' },
  { value: 'stocks-and-etfs', label: 'Stocks + ETFs' },
  { value: 'custom', label: 'Custom symbols' },
];

const AI_PROVIDER_OPTIONS: Array<{ value: AiProvider; label: string }> = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
];

type Props = Pick<
  UseCorrelationExplorerResult,
  | 'primaryTicker'
  | 'setPrimaryTicker'
  | 'startDate'
  | 'setStartDate'
  | 'endDate'
  | 'setEndDate'
  | 'frequency'
  | 'setFrequency'
  | 'universeSelection'
  | 'setUniverseSelection'
  | 'customSymbolsInput'
  | 'setCustomSymbolsInput'
  | 'useAi'
  | 'setUseAi'
  | 'aiProvider'
  | 'setAiProvider'
  | 'aiApiKey'
  | 'setAiApiKey'
  | 'isScanning'
  | 'runScan'
  | 'cancelScan'
  | 'shareUrl'
>;

export const CorrelationControls: React.FC<Props> = (props) => {
  const [showApiKey, setShowApiKey] = React.useState(false);

  return (
    <Block marginBottom="scale500">
      <Block display="grid" gridGap="scale400" marginBottom="scale400" overrides={{ Block: { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' } } }}>
        <Block>
          <LabelSmall marginBottom="scale200">Primary ticker</LabelSmall>
          <Input
            value={props.primaryTicker}
            onChange={(e) => props.setPrimaryTicker((e.target as HTMLInputElement).value.toUpperCase())}
            placeholder="VGT"
            size="compact"
          />
        </Block>
        <Block>
          <LabelSmall marginBottom="scale200">Start date</LabelSmall>
          <input
            type="date"
            value={props.startDate}
            max={props.endDate}
            onChange={(e) => props.setStartDate(e.target.value)}
            style={dateInputStyle}
          />
        </Block>
        <Block>
          <LabelSmall marginBottom="scale200">End date</LabelSmall>
          <input
            type="date"
            value={props.endDate}
            min={props.startDate}
            onChange={(e) => props.setEndDate(e.target.value)}
            style={dateInputStyle}
          />
        </Block>
        <Block>
          <LabelSmall marginBottom="scale200">Frequency</LabelSmall>
          <select value={props.frequency} onChange={(e) => props.setFrequency(e.target.value as CorrelationFrequency)} style={selectStyle}>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Block>
        <Block>
          <LabelSmall marginBottom="scale200">Asset universe</LabelSmall>
          <select
            value={props.universeSelection}
            onChange={(e) => props.setUniverseSelection(e.target.value as AssetUniverseSelection)}
            style={selectStyle}
          >
            {UNIVERSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Block>
      </Block>

      <Block marginBottom="scale400">
        <LabelSmall marginBottom="scale200">
          Custom symbols {props.universeSelection !== 'custom' && '(added on top of the built-in universe)'}
        </LabelSmall>
        <Input
          value={props.customSymbolsInput}
          onChange={(e) => props.setCustomSymbolsInput((e.target as HTMLInputElement).value)}
          placeholder="e.g. AAPL, MSFT, GOOGL"
          size="compact"
        />
      </Block>

      <Block display="flex" flexWrap="wrap" gridGap="scale400" alignItems="flex-end" marginBottom="scale400">
        <Checkbox checked={props.useAi} onChange={(e) => props.setUseAi((e.target as HTMLInputElement).checked)}>
          Use AI for candidate ideas
        </Checkbox>
        {props.useAi && (
          <>
            <Block>
              <LabelSmall marginBottom="scale200">AI provider</LabelSmall>
              <select value={props.aiProvider} onChange={(e) => props.setAiProvider(e.target.value as AiProvider)} style={selectStyle}>
                {AI_PROVIDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Block>
            <Block flex="1" minWidth="220px">
              <LabelSmall marginBottom="scale200">
                {AI_PROVIDER_OPTIONS.find((o) => o.value === props.aiProvider)?.label} API key{' '}
                <span style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}>(optional — overrides env key, kept only for this session)</span>
              </LabelSmall>
              <Block display="flex" gridGap="scale200" alignItems="center">
                <Input
                  value={props.aiApiKey}
                  onChange={(e) => props.setAiApiKey((e.target as HTMLInputElement).value)}
                  size="compact"
                  type={showApiKey ? 'text' : 'password'}
                  overrides={{ Root: { style: { flex: '1' } } }}
                />
                <Button kind="tertiary" size="compact" onClick={() => setShowApiKey((v) => !v)}>
                  {showApiKey ? 'Hide' : 'Show'}
                </Button>
              </Block>
            </Block>
          </>
        )}
      </Block>

      <Block display="flex" gridGap="scale300" flexWrap="wrap">
        <Button kind="primary" onClick={() => void props.runScan()} isLoading={props.isScanning} disabled={props.isScanning}>
          Find correlations
        </Button>
        <Button kind="secondary" onClick={props.cancelScan} disabled={!props.isScanning}>
          Cancel scan
        </Button>
        <Button
          kind="tertiary"
          onClick={async () => {
            const url = props.shareUrl();
            try {
              await navigator.clipboard.writeText(url);
              toaster.positive('Link copied to clipboard.', { autoHideDuration: 3000 });
            } catch {
              toaster.warning(url, { autoHideDuration: 8000 });
            }
          }}
        >
          Share URL
        </Button>
      </Block>
    </Block>
  );
};
