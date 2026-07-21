import React from 'react';

const DEFAULT_TEXT =
  'Correlation does not imply causation, and relationships can weaken, strengthen, or invert during periods of market stress.';

interface CorrelationInfoTooltipProps {
  text?: string;
}

/** Native-title hover tooltip (keyboard/focusable) reminding readers correlation != causation. */
export const CorrelationInfoTooltip: React.FC<CorrelationInfoTooltipProps> = ({ text = DEFAULT_TEXT }) => (
  <span
    role="img"
    aria-label={text}
    title={text}
    tabIndex={0}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      borderRadius: '50%',
      border: '1px solid #94a3b8',
      color: '#64748b',
      fontSize: 11,
      lineHeight: '14px',
      cursor: 'help',
      userSelect: 'none',
    }}
  >
    i
  </span>
);
