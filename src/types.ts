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

// === Technical Strategy Types ===

export type TechSignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface TechStrategyResult {
  strategy: string;
  direction: TechSignalDirection;
  confidence: number; // 0~1
  details: string;
}

export interface TechAnalysisSummary {
  strategies: TechStrategyResult[];
  consensus: TechSignalDirection;
  consensusScore: number; // -1 (strong SHORT) ~ +1 (strong LONG)
  summary: string;
}

// === Combo Scorer Types ===

export type RecommendationGrade = 'STRONG_BUY' | 'BUY' | 'WATCH' | 'HOLD' | 'AVOID';

export interface SignalSnapshot {
  institutionalNetEarly: number;
  institutionalNetLate: number;
  foreignNetEarly: number;
  foreignNetLate: number;
  shortSellingRatioAvg: number;
  shortSellingEarly: number;
  shortSellingLate: number;
  dataPoints: number;
}

export interface MatchedCondition {
  name: string;
  met: boolean;
  value: number | null;
  threshold: number | null;
}

export interface ComboScore {
  comboId: number;
  comboName: string;
  grade: RecommendationGrade;
  expectedReturn: number;
  winRate: number;
  confidence: number;
  phaseMultiplier: number;
  adjustedReturn: number;
  matchedConditions: MatchedCondition[];
}

