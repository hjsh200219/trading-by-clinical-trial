import { describe, it, expect } from 'vitest';
import { calculateBollinger } from '../../src/lib/technical/bollinger.js';

describe('Bollinger Bands (20-day, 2σ)', () => {
  it('should compute middle as 20-day SMA', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const result = calculateBollinger(closes);
    // SMA of last 20 values: avg of 105..124 = 114.5
    expect(result.middle).toBeCloseTo(114.5, 0);
  });

  it('should have upper > middle > lower', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 5);
    const result = calculateBollinger(closes);
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.middle).toBeGreaterThan(result.lower);
  });

  it('should compute %B correctly', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const result = calculateBollinger(closes);
    // Last price is 124. %B = (price - lower) / (upper - lower) * 100
    expect(result.percentB).toBeGreaterThan(0);
    expect(result.percentB).toBeLessThanOrEqual(100);
  });

  it('should require minimum 20 data points', () => {
    const closes = Array.from({ length: 10 }, () => 100);
    expect(() => calculateBollinger(closes)).toThrow();
  });

  it('should handle flat prices (zero bandwidth)', () => {
    const closes = Array.from({ length: 25 }, () => 100);
    const result = calculateBollinger(closes);
    expect(result.middle).toBe(100);
    expect(result.upper).toBe(100);
    expect(result.lower).toBe(100);
    // %B for flat prices: 50 (middle of band)
    expect(result.percentB).toBe(50);
  });
});
