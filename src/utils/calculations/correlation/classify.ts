export type CorrelationCategory =
  | 'strong-positive'
  | 'moderate-positive'
  | 'low-uncorrelated'
  | 'moderate-negative'
  | 'strong-negative';

export interface CorrelationClassification {
  category: CorrelationCategory;
  label: string;
  rangeLabel: string;
}

const CATEGORIES: Record<CorrelationCategory, { label: string; rangeLabel: string }> = {
  'strong-positive': { label: 'Highly correlated', rangeLabel: '+0.70 to +1.00' },
  'moderate-positive': { label: 'Related, but not a close proxy', rangeLabel: '+0.30 to +0.69' },
  'low-uncorrelated': { label: 'Potential diversifier', rangeLabel: '-0.29 to +0.29' },
  'moderate-negative': { label: 'Inverse relationship', rangeLabel: '-0.69 to -0.30' },
  'strong-negative': { label: 'Strong inverse relationship', rangeLabel: '-1.00 to -0.70' },
};

/**
 * Classification boundaries from the statistical contract. Low/uncorrelated and
 * negative relationships are always kept as separate categories.
 */
export function classifyCorrelation(value: number): CorrelationClassification {
  let category: CorrelationCategory;
  if (value >= 0.7) category = 'strong-positive';
  else if (value >= 0.3) category = 'moderate-positive';
  else if (value > -0.3) category = 'low-uncorrelated';
  else if (value > -0.7) category = 'moderate-negative';
  else category = 'strong-negative';

  return { category, ...CATEGORIES[category] };
}

export const CORRELATION_CATEGORY_ORDER: CorrelationCategory[] = [
  'strong-positive',
  'moderate-positive',
  'low-uncorrelated',
  'moderate-negative',
  'strong-negative',
];

export const CORRELATION_CATEGORY_TITLES: Record<CorrelationCategory, string> = {
  'strong-positive': 'Strongly correlated',
  'moderate-positive': 'Moderately correlated',
  'low-uncorrelated': 'Low / uncorrelated',
  'moderate-negative': 'Moderately negative',
  'strong-negative': 'Strongly negative',
};
