import type { RSIResult, RSIInterpretation } from '../../types.js';

const PERIOD = 14;
const MIN_DATA_POINTS = PERIOD + 1;

export function calculateRSI(closes: number[]): RSIResult {
  if (closes.length < MIN_DATA_POINTS) {
    throw new Error(`RSI requires at least ${MIN_DATA_POINTS} data points, got ${closes.length}`);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss over first PERIOD
  for (let i = 1; i <= PERIOD; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= PERIOD;
  avgLoss /= PERIOD;

  // Wilder's smoothing for remaining data
  for (let i = PERIOD + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (PERIOD - 1) + gain) / PERIOD;
    avgLoss = (avgLoss * (PERIOD - 1) + loss) / PERIOD;
  }

  let rsi: number;
  if (avgLoss === 0) {
    rsi = avgGain === 0 ? 50 : 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
  }

  let interpretation: RSIInterpretation;
  if (rsi < 30) interpretation = 'oversold';
  else if (rsi > 70) interpretation = 'overbought';
  else interpretation = 'neutral';

  return { value: Math.round(rsi * 100) / 100, interpretation };
}
