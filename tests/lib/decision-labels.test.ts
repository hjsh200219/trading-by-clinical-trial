import { describe, it, expect } from 'vitest';
import { makeDecision } from '../../src/lib/decision-matrix.js';
import type { TrialDecision, ClinicalTrial, ScoreComponent } from '../../src/types.js';

const ALL_TRIAL_DECISIONS: TrialDecision[] = [
  'TRIAL_STRONG_POSITIVE',
  'TRIAL_POSITIVE',
  'TRIAL_NEUTRAL',
  'TRIAL_WATCH',
  'TRIAL_REVIEW',
  'TRIAL_NEGATIVE',
];

function makeComponent(name: string, points: number, maxPoints: number): ScoreComponent {
  return { name, points, maxPoints, details: 'test' };
}

function makeTrial(overrides: Partial<ClinicalTrial> = {}): ClinicalTrial {
  return {
    nctId: 'NCT00000001',
    drugName: 'TestDrug',
    condition: 'TestCondition',
    phase: 'Phase 3',
    status: 'RECRUITING',
    estimatedCompletionDate: null,
    enrollment: 300,
    hasResults: false,
    sponsor: 'TestSponsor',
    ...overrides,
  };
}

describe('Decision labels', () => {
  it('all TrialDecision values are prefixed with TRIAL_', () => {
    for (const label of ALL_TRIAL_DECISIONS) {
      expect(label.startsWith('TRIAL_')).toBe(true);
    }
  });

  it('makeDecision never returns a label without TRIAL_ prefix', () => {
    const components: ScoreComponent[] = [
      makeComponent('temporal_proximity', 20, 30),
      makeComponent('impact', 15, 25),
      makeComponent('competition', 10, 15),
      makeComponent('pipeline', 5, 10),
      makeComponent('Data Richness', 4, 5),
      makeComponent('market_signal', 10, 15),
    ];

    const scenarios: Array<{ trial: ClinicalTrial; score: number }> = [
      // TRIAL_REVIEW path (hasResults)
      { trial: makeTrial({ hasResults: true }), score: 80 },
      // TRIAL_WATCH path (data richness = 0)
      { trial: makeTrial(), score: 50 },
      // TRIAL_WATCH path (Phase 1)
      { trial: makeTrial({ phase: 'Phase 1' }), score: 50 },
      // TRIAL_STRONG_POSITIVE path
      {
        trial: makeTrial({
          phase: 'Phase 3',
          estimatedCompletionDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        }),
        score: 80,
      },
      // TRIAL_POSITIVE path (score >= 60)
      { trial: makeTrial(), score: 65 },
      // TRIAL_NEUTRAL path (score 40-59)
      { trial: makeTrial(), score: 45 },
      // TRIAL_WATCH path (score < 40)
      { trial: makeTrial(), score: 20 },
    ];

    for (const { trial, score } of scenarios) {
      const result = makeDecision(trial, score, components, null);
      expect(
        result.decision.startsWith('TRIAL_'),
        `Expected TRIAL_ prefix but got "${result.decision}"`
      ).toBe(true);
      expect(ALL_TRIAL_DECISIONS).toContain(result.decision);
    }
  });
});
