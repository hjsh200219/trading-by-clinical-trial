import type { BollingerResult } from '../../types.js';

const PERIOD = 20;
const STD_DEV_MULTIPLIER = 2;

export function calculateBollinger(closes: number[]): BollingerResult {
  if (closes.length < PERIOD) {
    throw new Error(`Bollinger Bands require at least ${PERIOD} data points, got ${closes.length}`);
  }

  // Use last PERIOD values for SMA
  const window = closes.slice(-PERIOD);
  const sum = window.reduce((a, b) => a + b, 0);
  const middle = sum / PERIOD;

  // Standard deviation
  const variance = window.reduce((acc, val) => acc + (val - middle) ** 2, 0) / PERIOD;
  const stdDev = Math.sqrt(variance);

  const upper = middle + STD_DEV_MULTIPLIER * stdDev;
  const lower = middle - STD_DEV_MULTIPLIER * stdDev;

  // %B calculation
  const lastPrice = closes[closes.length - 1];
  let percentB: number;
  if (upper === lower) {
    // Zero bandwidth (flat prices)
    percentB = 50;
  } else {
    percentB = ((lastPrice - lower) / (upper - lower)) * 100;
  }

  return {
    middle: Math.round(middle * 100) / 100,
    upper: Math.round(upper * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    percentB: Math.round(percentB * 100) / 100,
  };
}
