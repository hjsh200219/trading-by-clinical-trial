// === Data Types ===

export interface KrPharmaCompany {
  symbol: string;
  nameKr: string;
  nameEn: string;
  sponsorNames: string[];
  aliases: string[];
  market: 'KS' | 'KQ';
}

export interface ClinicalTrial {
  nctId: string;
  drugName: string | null;
  condition: string | null;
  phase: string | null;
  status: string | null;
  estimatedCompletionDate: string | null;
  enrollment: number | null;
  hasResults: boolean;
  sponsor: string | null;
}

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSummary {
  currentPrice: number;
  high52w: number;
  low52w: number;
  avgVolume: number;
  currency: string;
}

// === Technical Indicator Types ===

export type RSIInterpretation = 'oversold' | 'neutral' | 'overbought';

export interface RSIResult {
  value: number;
  interpretation: RSIInterpretation;
}

export interface BollingerResult {
  middle: number;
  upper: number;
  lower: number;
  percentB: number;
}

export type VolumeInterpretation = 'low' | 'normal' | 'high' | 'surge';

export interface VolumeRatioResult {
  ratio: number;
  interpretation: VolumeInterpretation;
}

// === Scoring Types ===

export interface ScoreComponent {
  name: string;
  points: number;
  maxPoints: number;
  details: string;
}

export interface TrialScore {
  nctId: string;
  drugName: string | null;
  condition: string | null;
  phase: string | null;
  totalScore: number;
  components: ScoreComponent[];
  decision: TrialDecision;
}

export type TrialDecision =
  | 'TRIAL_STRONG_POSITIVE'
  | 'TRIAL_POSITIVE'
  | 'TRIAL_NEUTRAL'
  | 'TRIAL_WATCH'
  | 'TRIAL_REVIEW'
  | 'TRIAL_NEGATIVE';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DecisionResult {
  decision: TrialDecision;
  confidence: ConfidenceLevel;
  reasoning: string;
}

// === Analysis Output ===

export interface StockAnalysis {
  company: KrPharmaCompany;
  bestTrial: TrialScore | null;
  allTrials: TrialScore[];
  marketData: MarketDataSection | null;
  competitionSummary: CompetitorInfo[];
  disclaimer: string;
}

export interface MarketDataSection {
  currentPrice: number;
  high52w: number;
  low52w: number;
  rsi: RSIResult | null;
  bollingerPercentB: number | null;
  volumeRatio: VolumeRatioResult | null;
  stale: boolean;
}

export interface CompetitorInfo {
  sponsor: string;
  nctId: string;
  phase: string;
  status: string;
  condition: string;
  estimatedCompletion: string | null;
  isKorean: boolean;
}

// === Cache Types ===

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// === API Error Types ===

export interface ApiError {
  error: true;
  message: string;
  cachedAt?: Date;
}

export interface StaleResponse<T> {
  data: T;
  stale: true;
  cachedAt: Date;
}

export type ApiResult<T> = T | ApiError | StaleResponse<T>;

export function isApiError(result: unknown): result is ApiError {
  return typeof result === 'object' && result !== null && 'error' in result && (result as ApiError).error === true;
}

export function isStaleResponse<T>(result: unknown): result is StaleResponse<T> {
  return typeof result === 'object' && result !== null && 'stale' in result && (result as StaleResponse<T>).stale === true;
}
