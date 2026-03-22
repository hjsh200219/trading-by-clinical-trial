import { describe, it, expect } from 'vitest';
import { scoreImpact } from '../../../src/lib/scoring/impact-scorer.js';
import { ClinicalTrial } from '../../../src/types.js';

function makeTrial(overrides: Partial<ClinicalTrial> = {}): ClinicalTrial {
  return {
    nctId: 'NCT00000001',
    drugName: 'TestDrug',
    condition: 'TestCondition',
    phase: null,
    status: 'RECRUITING',
    estimatedCompletionDate: null,
    enrollment: null,
    hasResults: false,
    sponsor: 'TestSponsor',
    ...overrides,
  };
}

describe('scoreImpact', () => {
  it('Phase 3 with large enrollment (>500) → 25 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 3', enrollment: 501 }));
    expect(result.points).toBe(25);
    expect(result.maxPoints).toBe(25);
    expect(result.name).toBe('Impact');
  });

  it('Phase 3 standard enrollment → 21 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 3', enrollment: 200 }));
    expect(result.points).toBe(21);
  });

  it('Phase 3 with null enrollment treated as standard → 21 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 3', enrollment: null }));
    expect(result.points).toBe(21);
  });

  it('Phase 2 with large enrollment (>500) → 15 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 2', enrollment: 600 }));
    expect(result.points).toBe(15);
  });

  it('Phase 2 standard enrollment → 12 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 2', enrollment: 100 }));
    expect(result.points).toBe(12);
  });

  it('Phase 4 → 8 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 4', enrollment: 1000 }));
    expect(result.points).toBe(8);
  });

  it('Phase 4 standard enrollment → 8 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 4', enrollment: 50 }));
    expect(result.points).toBe(8);
  });

  it('Phase 1 with large enrollment (>500) → 5 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 1', enrollment: 750 }));
    expect(result.points).toBe(5);
  });

  it('Phase 1 standard enrollment → 4 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 1', enrollment: 30 }));
    expect(result.points).toBe(4);
  });

  it('Early Phase 1 → 2 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Early Phase 1', enrollment: 20 }));
    expect(result.points).toBe(2);
  });

  it('Unknown phase string → 2 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Unknown', enrollment: 50 }));
    expect(result.points).toBe(2);
  });

  it('null phase → 2 pts', () => {
    const result = scoreImpact(makeTrial({ phase: null, enrollment: 50 }));
    expect(result.points).toBe(2);
  });

  it('Phase 2/Phase 3 combined → uses highest phase (3) with large enrollment → 25 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 2/Phase 3', enrollment: 600 }));
    expect(result.points).toBe(25);
  });

  it('Phase 2/Phase 3 combined → uses highest phase (3) standard enrollment → 21 pts', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 2/Phase 3', enrollment: 100 }));
    expect(result.points).toBe(21);
  });

  it('ScoreComponent has correct shape', () => {
    const result = scoreImpact(makeTrial({ phase: 'Phase 3', enrollment: 600 }));
    expect(result).toMatchObject({
      name: 'Impact',
      points: 25,
      maxPoints: 25,
      details: expect.any(String),
    });
  });
});
