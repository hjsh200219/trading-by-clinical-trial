import { describe, it, expect } from 'vitest';
import { SCORING_WEIGHTS } from '../../src/lib/scoring/weights.js';

describe('Scoring Weights', () => {
  it('should have 6 components', () => {
    const components = [
      SCORING_WEIGHTS.TEMPORAL_PROXIMITY,
      SCORING_WEIGHTS.IMPACT,
      SCORING_WEIGHTS.COMPETITION,
      SCORING_WEIGHTS.PIPELINE,
      SCORING_WEIGHTS.DATA_RICHNESS,
      SCORING_WEIGHTS.MARKET_SIGNAL,
    ];
    expect(components).toHaveLength(6);
    components.forEach((w) => expect(w).toBeGreaterThan(0));
  });

  it('should sum to exactly 100', () => {
    const sum =
      SCORING_WEIGHTS.TEMPORAL_PROXIMITY +
      SCORING_WEIGHTS.IMPACT +
      SCORING_WEIGHTS.COMPETITION +
      SCORING_WEIGHTS.PIPELINE +
      SCORING_WEIGHTS.DATA_RICHNESS +
      SCORING_WEIGHTS.MARKET_SIGNAL;
    expect(sum).toBe(100);
    expect(sum).toBe(SCORING_WEIGHTS.TOTAL);
  });

  it('should match the planned allocation', () => {
    expect(SCORING_WEIGHTS.TEMPORAL_PROXIMITY).toBe(30);
    expect(SCORING_WEIGHTS.IMPACT).toBe(25);
    expect(SCORING_WEIGHTS.COMPETITION).toBe(15);
    expect(SCORING_WEIGHTS.PIPELINE).toBe(10);
    expect(SCORING_WEIGHTS.DATA_RICHNESS).toBe(5);
    expect(SCORING_WEIGHTS.MARKET_SIGNAL).toBe(15);
  });
});
