import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeDecision } from '../../src/lib/decision-matrix';
import type { ClinicalTrial, ScoreComponent, RSIResult } from '../../src/types';

// Fixed date: 2024-01-15
const FIXED_NOW = new Date('2024-01-15T00:00:00.000Z');

// Helper: build a minimal ClinicalTrial
function makeTrial(overrides: Partial<ClinicalTrial> = {}): ClinicalTrial {
  return {
    nctId: 'NCT00000001',
    drugName: 'TestDrug',
    condition: 'TestCondition',
    phase: 'Phase 3',
    status: 'Recruiting',
    estimatedCompletionDate: '2025-01-01',
    enrollment: 100,
    hasResults: false,
    sponsor: 'TestSponsor',
    ...overrides,
  };
}

// Helper: build a data_richness component
function dataRichnessComponent(points: number): ScoreComponent {
  return { name: 'data_richness', points, maxPoints: 10, details: 'test' };
}

// Helper: a full set of components with data_richness >= 4 (for HIGH confidence)
function richComponents(dataRichnessPoints = 5): ScoreComponent[] {
  return [
    dataRichnessComponent(dataRichnessPoints),
    { name: 'phase_score', points: 10, maxPoints: 20, details: 'test' },
    { name: 'enrollment_score', points: 5, maxPoints: 10, details: 'test' },
  ];
}

// Within D-30: 14 days from FIXED_NOW (2024-01-15 + 14 = 2024-01-29)
const WITHIN_30_DAYS = '2024-01-29';
// Far future: not within D-30
const FAR_FUTURE = '2025-06-01';

describe('makeDecision', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Priority 1: hasResults ---
  describe('Priority 1: hasResults=true → TRIAL_REVIEW', () => {
    it('returns TRIAL_REVIEW when hasResults is true, regardless of score', () => {
      const trial = makeTrial({ hasResults: true, phase: 'Phase 3', estimatedCompletionDate: WITHIN_30_DAYS });
      const components = richComponents(5);
      const rsi: RSIResult = { value: 30, interpretation: 'oversold' };
      const result = makeDecision(trial, 90, components, rsi);
      expect(result.decision).toBe('TRIAL_REVIEW');
    });

    it('returns TRIAL_REVIEW even for low score with hasResults', () => {
      const trial = makeTrial({ hasResults: true });
      const result = makeDecision(trial, 10, richComponents(1), null);
      expect(result.decision).toBe('TRIAL_REVIEW');
    });
  });

  // --- Priority 2: Low data confidence ---
  describe('Priority 2: Low data confidence → TRIAL_WATCH', () => {
    it('returns TRIAL_WATCH when data_richness component has 0 points', () => {
      const trial = makeTrial({ hasResults: false, phase: 'Phase 3' });
      const components: ScoreComponent[] = [
        dataRichnessComponent(0),
        { name: 'phase_score', points: 10, maxPoints: 20, details: 'test' },
        { name: 'enrollment_score', points: 5, maxPoints: 10, details: 'test' },
      ];
      const result = makeDecision(trial, 80, components, null);
      expect(result.decision).toBe('TRIAL_WATCH');
    });

    it('returns TRIAL_WATCH when fewer than 3 components are scored', () => {
      const trial = makeTrial({ hasResults: false, phase: 'Phase 3' });
      const components: ScoreComponent[] = [
        dataRichnessComponent(5),
        { name: 'phase_score', points: 10, maxPoints: 20, details: 'test' },
      ];
      const result = makeDecision(trial, 80, components, null);
      expect(result.decision).toBe('TRIAL_WATCH');
    });
  });

  // --- Priority 3: Phase 1 / Early Phase 1 ---
  describe('Priority 3: Phase 1 or Early Phase 1 → TRIAL_WATCH', () => {
    it('returns TRIAL_WATCH for Phase 1', () => {
      const trial = makeTrial({ phase: 'Phase 1' });
      const result = makeDecision(trial, 90, richComponents(), null);
      expect(result.decision).toBe('TRIAL_WATCH');
    });

    it('returns TRIAL_WATCH for Early Phase 1', () => {
      const trial = makeTrial({ phase: 'Early Phase 1' });
      const result = makeDecision(trial, 90, richComponents(), null);
      expect(result.decision).toBe('TRIAL_WATCH');
    });
  });

  // --- Priority 4: Strong positive ---
  describe('Priority 4: Score >= 75 + Phase 3 + D-30 + RSI < 50 → TRIAL_STRONG_POSITIVE', () => {
    it('returns TRIAL_STRONG_POSITIVE when all conditions met', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: WITHIN_30_DAYS });
      const rsi: RSIResult = { value: 45, interpretation: 'neutral' };
      const result = makeDecision(trial, 80, richComponents(), rsi);
      expect(result.decision).toBe('TRIAL_STRONG_POSITIVE');
    });

    it('returns TRIAL_STRONG_POSITIVE at exact boundary score=75', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: WITHIN_30_DAYS });
      const rsi: RSIResult = { value: 30, interpretation: 'oversold' };
      const result = makeDecision(trial, 75, richComponents(), rsi);
      expect(result.decision).toBe('TRIAL_STRONG_POSITIVE');
    });

    it('does NOT return TRIAL_STRONG_POSITIVE when score is 74', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: WITHIN_30_DAYS });
      const rsi: RSIResult = { value: 45, interpretation: 'neutral' };
      const result = makeDecision(trial, 74, richComponents(), rsi);
      expect(result.decision).not.toBe('TRIAL_STRONG_POSITIVE');
    });

    it('does NOT return TRIAL_STRONG_POSITIVE when completion is beyond D-30', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: FAR_FUTURE });
      const rsi: RSIResult = { value: 45, interpretation: 'neutral' };
      const result = makeDecision(trial, 80, richComponents(), rsi);
      expect(result.decision).not.toBe('TRIAL_STRONG_POSITIVE');
    });
  });

  // --- Priority 5: Overbought guard ---
  describe('Priority 5: Score >= 75 + Phase 3 + D-30 + RSI > 70 → TRIAL_WATCH', () => {
    it('returns TRIAL_WATCH (overbought guard) when RSI > 70', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: WITHIN_30_DAYS });
      const rsi: RSIResult = { value: 75, interpretation: 'overbought' };
      const result = makeDecision(trial, 80, richComponents(), rsi);
      expect(result.decision).toBe('TRIAL_WATCH');
    });
  });

  // --- Priority 4 fallback when RSI is null ---
  describe('RSI null fallback: Score >= 75 + Phase 3 + D-30 → TRIAL_STRONG_POSITIVE', () => {
    it('returns TRIAL_STRONG_POSITIVE when RSI is null', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: WITHIN_30_DAYS });
      const result = makeDecision(trial, 80, richComponents(), null);
      expect(result.decision).toBe('TRIAL_STRONG_POSITIVE');
    });
  });

  // --- Priority 6: Score >= 60 ---
  describe('Priority 6: Score >= 60 → TRIAL_POSITIVE', () => {
    it('returns TRIAL_POSITIVE for score 60', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: FAR_FUTURE });
      const result = makeDecision(trial, 60, richComponents(), null);
      expect(result.decision).toBe('TRIAL_POSITIVE');
    });

    it('returns TRIAL_POSITIVE for score 74 (just below strong positive threshold)', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: FAR_FUTURE });
      const result = makeDecision(trial, 74, richComponents(), null);
      expect(result.decision).toBe('TRIAL_POSITIVE');
    });
  });

  // --- Priority 7: Score 40-59 ---
  describe('Priority 7: Score 40-59 → TRIAL_NEUTRAL', () => {
    it('returns TRIAL_NEUTRAL for score 40', () => {
      const trial = makeTrial({ phase: 'Phase 3' });
      const result = makeDecision(trial, 40, richComponents(), null);
      expect(result.decision).toBe('TRIAL_NEUTRAL');
    });

    it('returns TRIAL_NEUTRAL for score 59', () => {
      const trial = makeTrial({ phase: 'Phase 3' });
      const result = makeDecision(trial, 59, richComponents(), null);
      expect(result.decision).toBe('TRIAL_NEUTRAL');
    });
  });

  // --- Priority 8: Score < 40 ---
  describe('Priority 8: Score < 40 → TRIAL_WATCH', () => {
    it('returns TRIAL_WATCH for score 39', () => {
      const trial = makeTrial({ phase: 'Phase 3' });
      const result = makeDecision(trial, 39, richComponents(), null);
      expect(result.decision).toBe('TRIAL_WATCH');
    });

    it('returns TRIAL_WATCH for score 0', () => {
      const trial = makeTrial({ phase: 'Phase 3' });
      const result = makeDecision(trial, 0, richComponents(), null);
      expect(result.decision).toBe('TRIAL_WATCH');
    });
  });

  // --- Confidence levels ---
  describe('Confidence: HIGH when score >= 70 and data_richness >= 4', () => {
    it('returns HIGH confidence for score 70 and data_richness 4', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: FAR_FUTURE });
      const components: ScoreComponent[] = [
        dataRichnessComponent(4),
        { name: 'phase_score', points: 10, maxPoints: 20, details: 'test' },
        { name: 'other_score', points: 5, maxPoints: 10, details: 'test' },
      ];
      const result = makeDecision(trial, 70, components, null);
      expect(result.confidence).toBe('HIGH');
    });

    it('returns HIGH confidence for score 80 and data_richness 5', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: FAR_FUTURE });
      const result = makeDecision(trial, 80, richComponents(5), null);
      expect(result.confidence).toBe('HIGH');
    });
  });

  describe('Confidence: MEDIUM when score >= 40 and data_richness >= 2', () => {
    it('returns MEDIUM confidence for score 40 and data_richness 2', () => {
      const trial = makeTrial({ phase: 'Phase 3' });
      const components: ScoreComponent[] = [
        dataRichnessComponent(2),
        { name: 'phase_score', points: 10, maxPoints: 20, details: 'test' },
        { name: 'other_score', points: 5, maxPoints: 10, details: 'test' },
      ];
      const result = makeDecision(trial, 40, components, null);
      expect(result.confidence).toBe('MEDIUM');
    });

    it('returns MEDIUM (not HIGH) when data_richness is 3 and score is 69', () => {
      const trial = makeTrial({ phase: 'Phase 3', estimatedCompletionDate: FAR_FUTURE });
      const components: ScoreComponent[] = [
        dataRichnessComponent(3),
        { name: 'phase_score', points: 10, maxPoints: 20, details: 'test' },
        { name: 'other_score', points: 5, maxPoints: 10, details: 'test' },
      ];
      const result = makeDecision(trial, 69, components, null);
      expect(result.confidence).toBe('MEDIUM');
    });
  });

  describe('Confidence: LOW otherwise', () => {
    it('returns LOW confidence for score 20 and data_richness 1', () => {
      const trial = makeTrial({ phase: 'Phase 3' });
      const components: ScoreComponent[] = [
        dataRichnessComponent(1),
        { name: 'phase_score', points: 5, maxPoints: 20, details: 'test' },
        { name: 'other_score', points: 3, maxPoints: 10, details: 'test' },
      ];
      const result = makeDecision(trial, 20, components, null);
      expect(result.confidence).toBe('LOW');
    });

    it('returns LOW confidence for score 39 regardless of data_richness', () => {
      const trial = makeTrial({ phase: 'Phase 3' });
      const result = makeDecision(trial, 39, richComponents(5), null);
      expect(result.confidence).toBe('LOW');
    });
  });

  // --- reasoning field ---
  describe('reasoning field', () => {
    it('includes a non-empty reasoning string in all results', () => {
      const trial = makeTrial();
      const result = makeDecision(trial, 50, richComponents(), null);
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });
});
