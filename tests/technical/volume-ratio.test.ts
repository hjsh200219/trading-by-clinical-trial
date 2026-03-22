import { describe, it, expect } from 'vitest';
import { calculateVolumeRatio } from '../../src/lib/technical/volume-ratio.js';

describe('Volume Ratio', () => {
  it('should return normal for average volume', () => {
    const volumes = Array.from({ length: 25 }, () => 1000000);
    const result = calculateVolumeRatio(volumes);
    expect(result.ratio).toBeCloseTo(1.0, 1);
    expect(result.interpretation).toBe('normal');
  });

  it('should detect surge when current volume is 4x average', () => {
    const volumes = Array.from({ length: 24 }, () => 1000000);
    volumes.push(4000000); // last day surge
    const result = calculateVolumeRatio(volumes);
    expect(result.ratio).toBeGreaterThan(3.0);
    expect(result.interpretation).toBe('surge');
  });

  it('should detect high volume', () => {
    const volumes = Array.from({ length: 24 }, () => 1000000);
    volumes.push(2000000);
    const result = calculateVolumeRatio(volumes);
    expect(result.ratio).toBeGreaterThan(1.5);
    expect(result.ratio).toBeLessThanOrEqual(3.0);
    expect(result.interpretation).toBe('high');
  });

  it('should detect low volume', () => {
    const volumes = Array.from({ length: 24 }, () => 1000000);
    volumes.push(300000);
    const result = calculateVolumeRatio(volumes);
    expect(result.ratio).toBeLessThan(0.5);
    expect(result.interpretation).toBe('low');
  });

  it('should require minimum 20 data points', () => {
    expect(() => calculateVolumeRatio([100, 200])).toThrow();
  });
});
