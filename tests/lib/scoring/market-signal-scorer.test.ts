import { describe, it, expect } from 'vitest';
import { scoreMarketSignal, MarketSignalInput } from '../../../src/lib/scoring/market-signal-scorer.js';
import { RSIResult, VolumeRatioResult } from '../../../src/types.js';

function makeInput(overrides: Partial<MarketSignalInput> = {}): MarketSignalInput {
  return {
    rsi: null,
    bollingerPercentB: null,
    volumeRatio: null,
    ...overrides,
  };
}

function makeRSI(value: number): RSIResult {
  const interpretation =
    value < 30 ? 'oversold' : value > 70 ? 'overbought' : 'neutral';
  return { value, interpretation };
}

function makeVolumeRatio(ratio: number): VolumeRatioResult {
  const interpretation =
    ratio < 0.5 ? 'low' : ratio > 2.0 ? 'surge' : ratio > 1.5 ? 'high' : 'normal';
  return { ratio, interpretation };
}

describe('scoreMarketSignal', () => {
  it('null input → 0 pts with "Market data unavailable" note', () => {
    const result = scoreMarketSignal(null);
    expect(result.points).toBe(0);
    expect(result.maxPoints).toBe(15);
    expect(result.name).toBe('Market Signal');
    expect(result.details).toContain('unavailable');
  });

  it('RSI < 30 AND volume ratio > 1.5 → 15 pts (strong technical signal)', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(28),
      volumeRatio: makeVolumeRatio(1.8),
    }));
    expect(result.points).toBe(15);
    expect(result.maxPoints).toBe(15);
    expect(result.name).toBe('Market Signal');
  });

  it('RSI < 40 AND Bollinger %B < 20 → 12 pts (technically depressed)', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(35),
      bollingerPercentB: 15,
      volumeRatio: makeVolumeRatio(1.0),
    }));
    expect(result.points).toBe(12);
  });

  it('RSI 40-60 AND volume ratio > 2.0 → 10 pts (attention surge)', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(50),
      volumeRatio: makeVolumeRatio(2.5),
    }));
    expect(result.points).toBe(10);
  });

  it('RSI 40-60 AND normal volume (0.5-2.0) → 5 pts (baseline)', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(50),
      volumeRatio: makeVolumeRatio(1.0),
    }));
    expect(result.points).toBe(5);
  });

  it('RSI > 70 → 2 pts (overbought, already priced in)', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(75),
      volumeRatio: makeVolumeRatio(1.0),
    }));
    expect(result.points).toBe(2);
  });

  it('default fallback (RSI=65, normal volume) → 3 pts', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(65),
      volumeRatio: makeVolumeRatio(1.0),
    }));
    expect(result.points).toBe(3);
  });

  it('priority: RSI<30+volume>1.5 takes precedence over RSI<40+%B<20', () => {
    // Satisfies both rule 1 (RSI<30 + volume>1.5) and rule 2 (RSI<40 + %B<20)
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(28),
      bollingerPercentB: 10,
      volumeRatio: makeVolumeRatio(2.0),
    }));
    expect(result.points).toBe(15);
  });

  it('partial data: rsi null, has volume surge → fallback 3 pts', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: null,
      volumeRatio: makeVolumeRatio(3.0),
    }));
    expect(result.points).toBe(3);
  });

  it('partial data: volumeRatio null with RSI<30 → cannot match rule 1, falls to next applicable rule', () => {
    // RSI<30 but no volume data → cannot confirm rule 1; RSI<40 but no %B → cannot confirm rule 2; fallback
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(25),
      volumeRatio: null,
      bollingerPercentB: null,
    }));
    // Cannot match rules 1 or 2 without volume/bollingerPercentB; RSI not in 40-60; not >70; fallback
    expect(result.points).toBe(3);
  });

  it('ScoreComponent has correct shape', () => {
    const result = scoreMarketSignal(makeInput({
      rsi: makeRSI(50),
      volumeRatio: makeVolumeRatio(1.0),
    }));
    expect(result).toMatchObject({
      name: 'Market Signal',
      points: expect.any(Number),
      maxPoints: 15,
      details: expect.any(String),
    });
  });
});
