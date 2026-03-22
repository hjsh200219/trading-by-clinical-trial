import { describe, it, expect } from 'vitest';
import { SCORING_WEIGHTS } from '../../../src/lib/scoring/weights.js';

describe('Scoring Weights', () => {
  it('should sum to exactly 100', () => {
    const { TOTAL, ...components } = SCORING_WEIGHTS;
    const sum = Object.values(components).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(TOTAL).toBe(100);
  });

  it('should have all positive values', () => {
    for (const [key, value] of Object.entries(SCORING_WEIGHTS)) {
      expect(value, `${key} should be positive`).toBeGreaterThan(0);
    }
  });
});
