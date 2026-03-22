import type { VolumeRatioResult, VolumeInterpretation } from '../../types.js';

const PERIOD = 20;

export function calculateVolumeRatio(volumes: number[]): VolumeRatioResult {
  if (volumes.length < PERIOD) {
    throw new Error(`Volume ratio requires at least ${PERIOD} data points, got ${volumes.length}`);
  }

  const currentVolume = volumes[volumes.length - 1];

  // 20-day average (excluding the current day)
  const window = volumes.slice(-(PERIOD + 1), -1);
  const avg = window.reduce((a, b) => a + b, 0) / window.length;

  const ratio = avg === 0 ? 0 : currentVolume / avg;

  let interpretation: VolumeInterpretation;
  if (ratio < 0.5) interpretation = 'low';
  else if (ratio <= 1.5) interpretation = 'normal';
  else if (ratio <= 3.0) interpretation = 'high';
  else interpretation = 'surge';

  return {
    ratio: Math.round(ratio * 100) / 100,
    interpretation,
  };
}
