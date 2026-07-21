import { ProcessedIndexData } from '../../../types/index';

export type AnalysisPeriod = '1y' | '3y' | '5y' | '10y' | 'max';

export type CorrelationFrequency = 'daily' | 'weekly' | 'monthly' | 'longTerm';

export interface ResampledPoint {
  key: string;
  date: Date;
  value: number;
}

export interface AlignedSeries {
  dates: Date[];
  a: number[];
  b: number[];
}

export interface PairedReturns {
  dates: Date[];
  a: number[];
  b: number[];
}

export interface HorizonResult {
  frequency: CorrelationFrequency;
  correlation: number | null;
  observations: number;
  startDate: string | null;
  endDate: string | null;
  minRequired: number;
  available: boolean;
  reason?: string;
}

export interface CorrelationHorizons {
  daily: HorizonResult;
  weekly: HorizonResult;
  monthly: HorizonResult;
  longTerm: HorizonResult;
}

export type PriceSeries = ProcessedIndexData[];
