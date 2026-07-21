import React from 'react';
import { CorrelationHorizons } from '../../utils/calculations/correlation/types';
import { correlationToColor } from './correlationColor';

interface MultiHorizonBarsProps {
  horizons?: CorrelationHorizons;
  width?: number;
  height?: number;
}

const ORDER: Array<{ key: keyof CorrelationHorizons; label: string }> = [
  { key: 'daily', label: 'D' },
  { key: 'weekly', label: 'W' },
  { key: 'monthly', label: 'M' },
  { key: 'longTerm', label: 'L' },
];

/**
 * Compact 4-bar comparison (Daily/Weekly/Monthly/Long-term) so a relationship that looks
 * strong in one horizon but weak in another is visible at a glance.
 */
export const MultiHorizonBars: React.FC<MultiHorizonBarsProps> = ({ horizons, width = 84, height = 32 }) => {
  if (!horizons) return null;
  const barWidth = width / ORDER.length;
  const midY = height / 2;

  return (
    <svg width={width} height={height + 12} role="img" aria-label="Multi-horizon correlation comparison">
      <line x1={0} y1={midY} x2={width} y2={midY} stroke="#cbd5e1" strokeWidth={1} />
      {ORDER.map(({ key, label }, i) => {
        const h = horizons[key];
        const x = i * barWidth + barWidth * 0.2;
        const barW = barWidth * 0.6;
        if (!h.available || h.correlation === null) {
          return (
            <g key={key}>
              <rect x={x} y={midY - 1} width={barW} height={2} fill="#e2e8f0" />
              <text x={x + barW / 2} y={height + 10} fontSize={8} textAnchor="middle" fill="#94a3b8">
                {label}
              </text>
            </g>
          );
        }
        const v = h.correlation;
        const barH = Math.abs(v) * (midY - 2);
        const y = v >= 0 ? midY - barH : midY;
        return (
          <g key={key}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} fill={correlationToColor(v)} rx={1} />
            <text x={x + barW / 2} y={height + 10} fontSize={8} textAnchor="middle" fill="#64748b">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
