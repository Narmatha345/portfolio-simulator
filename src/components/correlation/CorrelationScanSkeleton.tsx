import { Block } from 'baseui/block';
import React from 'react';

const SHIMMER_STYLE = `
@keyframes correlation-skeleton-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
.correlation-skeleton-bar {
  background: linear-gradient(90deg, #eef1f5 25%, #e2e8f0 37%, #eef1f5 63%);
  background-size: 400px 100%;
  animation: correlation-skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: 6px;
}
`;

interface CorrelationScanSkeletonProps {
  rowCount?: number;
}

/** Placeholder rows shown while a scan is in flight, alongside the "Calculating N of M" progress text. */
export const CorrelationScanSkeleton: React.FC<CorrelationScanSkeletonProps> = ({ rowCount = 5 }) => (
  <Block marginBottom="scale500" aria-hidden="true">
    <style>{SHIMMER_STYLE}</style>
    {Array.from({ length: rowCount }).map((_, i) => (
      <Block key={i} display="flex" alignItems="center" gridGap="scale400" marginBottom="scale300">
        <div className="correlation-skeleton-bar" style={{ width: 64, height: 14 }} />
        <div className="correlation-skeleton-bar" style={{ width: `${140 + (i % 3) * 30}px`, height: 14 }} />
        <div className="correlation-skeleton-bar" style={{ width: 220, height: 14, flex: '1', maxWidth: 320 }} />
      </Block>
    ))}
  </Block>
);
