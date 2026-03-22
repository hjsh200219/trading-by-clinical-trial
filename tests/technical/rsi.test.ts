import { describe, it, expect } from 'vitest';
import { calculateRSI } from '../../src/lib/technical/rsi.js';

describe('RSI (14-day)', () => {
  it('should return oversold for consistently falling prices', () => {
    // 20 days of declining prices
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 2);
    const result = calculateRSI(closes);
    expect(result.value).toBeLessThan(30);
    expect(result.interpretation).toBe('oversold');
  });

  it('should return overbought for consistently rising prices', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 50 + i * 2);
    const result = calculateRSI(closes);
    expect(result.value).toBeGreaterThan(70);
    expect(result.interpretation).toBe('overbought');
  });

  it('should return neutral for mixed prices', () => {
    // Alternating up and down
    const closes = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    const result = calculateRSI(closes);
    expect(result.value).toBeGreaterThanOrEqual(30);
    expect(result.value).toBeLessThanOrEqual(70);
    expect(result.interpretation).toBe('neutral');
  });

  it('should require minimum 15 data points', () => {
    const closes = [1, 2, 3, 4, 5];
    expect(() => calculateRSI(closes)).toThrow();
  });

  it('should handle flat prices (RSI = 50 or similar neutral)', () => {
    const closes = Array.from({ length: 20 }, () => 100);
    const result = calculateRSI(closes);
    // All same price => no gains, no losses => RSI typically undefined/50
    expect(result.interpretation).toBe('neutral');
  });
});
