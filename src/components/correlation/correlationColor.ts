/**
 * Accessible diverging palette (colorblind-safe blue/orange, not red/green) for correlation values in [-1, 1].
 * -1 -> blue, 0 -> neutral gray, +1 -> orange.
 */
const NEGATIVE = { r: 33, g: 102, b: 172 }; // #2166AC
const NEUTRAL = { r: 153, g: 153, b: 153 }; // #999999
const POSITIVE = { r: 179, g: 88, b: 6 }; // #B35806

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function correlationToColor(value: number): string {
  const v = Math.max(-1, Math.min(1, value));
  const from = v < 0 ? NEGATIVE : POSITIVE;
  const t = Math.abs(v);
  const r = lerp(NEUTRAL.r, from.r, t);
  const g = lerp(NEUTRAL.g, from.g, t);
  const b = lerp(NEUTRAL.b, from.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}

export const CORRELATION_COLOR_STOPS: Array<[number, string]> = [
  [0, `rgb(${NEGATIVE.r}, ${NEGATIVE.g}, ${NEGATIVE.b})`],
  [0.5, `rgb(${NEUTRAL.r}, ${NEUTRAL.g}, ${NEUTRAL.b})`],
  [1, `rgb(${POSITIVE.r}, ${POSITIVE.g}, ${POSITIVE.b})`],
];
