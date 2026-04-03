import type { ScoreComponent, RSIResult, VolumeRatioResult } from '../../types.js';
import { SCORING_WEIGHTS } from './weights.js';

export interface MarketSignalInput {
  rsi: RSIResult | null;
  bollingerPercentB: number | null;
  volumeRatio: VolumeRatioResult | null;
}

const MAX_POINTS = SCORING_WEIGHTS.MARKET_SIGNAL;

export function scoreMarketSignal(input: MarketSignalInput | null): ScoreComponent {
  if (input === null) {
    return {
      name: 'Market Signal',
      points: 0,
      maxPoints: MAX_POINTS,
      details: 'Market data unavailable; score withheld.',
    };
  }

  const { rsi, bollingerPercentB, volumeRatio } = input;
  const rsiValue = rsi?.value ?? null;
  const volRatio = volumeRatio?.ratio ?? null;

  // Rule 1: RSI < 30 AND volume ratio > 1.5 → 15 pts
  if (rsiValue !== null && volRatio !== null && rsiValue < 30 && volRatio > 1.5) {
    return {
      name: 'Market Signal',
      points: 15,
      maxPoints: MAX_POINTS,
      details: `RSI ${rsiValue.toFixed(1)} (oversold) with volume ratio ${volRatio.toFixed(2)} (>1.5x) — strong technical signal.`,
    };
  }

  // Rule 2: RSI < 40 AND Bollinger %B < 20 → 12 pts
  if (rsiValue !== null && bollingerPercentB !== null && rsiValue < 40 && bollingerPercentB < 20) {
    return {
      name: 'Market Signal',
      points: 12,
      maxPoints: MAX_POINTS,
      details: `RSI ${rsiValue.toFixed(1)} (<40) with Bollinger %B ${bollingerPercentB.toFixed(1)}% (<20%) — technically depressed.`,
    };
  }

  // Rule 3: RSI 40-60 AND volume ratio > 2.0 → 10 pts
  if (rsiValue !== null && volRatio !== null && rsiValue >= 40 && rsiValue <= 60 && volRatio > 2.0) {
    return {
      name: 'Market Signal',
      points: 10,
      maxPoints: MAX_POINTS,
      details: `RSI ${rsiValue.toFixed(1)} (neutral) with volume ratio ${volRatio.toFixed(2)} (>2x) — unusual volume surge.`,
    };
  }

  // Rule 4: RSI 40-60 AND normal volume (0.5-2.0) → 5 pts
  if (rsiValue !== null && volRatio !== null && rsiValue >= 40 && rsiValue <= 60 && volRatio >= 0.5 && volRatio <= 2.0) {
    return {
      name: 'Market Signal',
      points: 5,
      maxPoints: MAX_POINTS,
      details: `RSI ${rsiValue.toFixed(1)} (neutral) with normal volume ratio ${volRatio.toFixed(2)} — baseline.`,
    };
  }

  // Rule 5: RSI > 70 → 2 pts
  if (rsiValue !== null && rsiValue > 70) {
    return {
      name: 'Market Signal',
      points: 2,
      maxPoints: MAX_POINTS,
      details: `RSI ${rsiValue.toFixed(1)} (overbought) — likely already priced in.`,
    };
  }

  // Rule 6: Default fallback → 3 pts
  return {
    name: 'Market Signal',
    points: 3,
    maxPoints: MAX_POINTS,
    details: `No dominant technical signal detected; default score applied.`,
  };
}
