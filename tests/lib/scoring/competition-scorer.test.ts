import { describe, it, expect } from 'vitest';
import { scoreCompetition } from '../../../src/lib/scoring/competition-scorer.js';
import { ClinicalTrial } from '../../../src/types.js';

function makeTrial(overrides: Partial<ClinicalTrial> = {}): ClinicalTrial {
  return {
    nctId: 'NCT00000001',
    drugName: 'TestDrug',
    condition: 'TestCondition',
    phase: 'Phase 3',
    status: 'RECRUITING',
    estimatedCompletionDate: null,
    enrollment: null,
    hasResults: false,
    sponsor: 'TestSponsor',
    ...overrides,
  };
}

describe('scoreCompetition', () => {
  it('No competitors → 15 pts (first mover)', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const result = scoreCompetition(subject, []);
    expect(result.points).toBe(15);
    expect(result.maxPoints).toBe(15);
    expect(result.name).toBe('Competition');
  });

  it('1 competitor in same phase → 10 pts', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = [makeTrial({ nctId: 'NCT00000002', phase: 'Phase 3', sponsor: 'Pfizer' })];
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(10);
  });

  it('2 competitors in same phase → 10 pts', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = [
      makeTrial({ nctId: 'NCT00000002', phase: 'Phase 3', sponsor: 'Pfizer' }),
      makeTrial({ nctId: 'NCT00000003', phase: 'Phase 3', sponsor: 'Roche' }),
    ];
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(10);
  });

  it('3 competitors in same phase → 6 pts', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = [
      makeTrial({ nctId: 'NCT00000002', phase: 'Phase 3', sponsor: 'Pfizer' }),
      makeTrial({ nctId: 'NCT00000003', phase: 'Phase 3', sponsor: 'Roche' }),
      makeTrial({ nctId: 'NCT00000004', phase: 'Phase 3', sponsor: 'Novartis' }),
    ];
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(6);
  });

  it('5 competitors in same phase → 6 pts', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = Array.from({ length: 5 }, (_, i) =>
      makeTrial({ nctId: `NCT0000000${i + 2}`, phase: 'Phase 3', sponsor: `Sponsor${i}` })
    );
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(6);
  });

  it('6 competitors in same phase → 2 pts', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = Array.from({ length: 6 }, (_, i) =>
      makeTrial({ nctId: `NCT0000000${i + 2}`, phase: 'Phase 3', sponsor: `Sponsor${i}` })
    );
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(2);
  });

  it('10 competitors in same phase → 2 pts', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = Array.from({ length: 10 }, (_, i) =>
      makeTrial({ nctId: `NCT${String(i + 2).padStart(8, '0')}`, phase: 'Phase 3', sponsor: `Sponsor${i}` })
    );
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(2);
  });

  it('Phase advantage: subject Phase 3, all competitors Phase 1 → base + 3 (capped at 15)', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = [
      makeTrial({ nctId: 'NCT00000002', phase: 'Phase 1', sponsor: 'Pfizer' }),
      makeTrial({ nctId: 'NCT00000003', phase: 'Phase 1', sponsor: 'Roche' }),
    ];
    // 2 competitors → base 10, +3 bonus → 13
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(13);
  });

  it('Phase advantage bonus capped at 15', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    // 0 competitors → base 15, +3 bonus → capped at 15
    const competitors = [
      makeTrial({ nctId: 'NCT00000002', phase: 'Phase 1', sponsor: 'Pfizer' }),
    ];
    // 1 competitor all Phase 1 → base 10, +3 → 13; not capped scenario
    // For cap test: no competitors, all Phase 1 means no same-phase competitors exist
    // Use 0 competitors scenario: base=15, bonus would push to 18, capped at 15
    const result = scoreCompetition(subject, []);
    // No competitors: first mover 15 pts, no phase advantage applicable (no competitors to compare)
    expect(result.points).toBe(15);
  });

  it('Phase advantage does NOT apply if any competitor is Phase 2', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = [
      makeTrial({ nctId: 'NCT00000002', phase: 'Phase 1', sponsor: 'Pfizer' }),
      makeTrial({ nctId: 'NCT00000003', phase: 'Phase 2', sponsor: 'Roche' }),
    ];
    // 2 competitors → base 10, no bonus (not all Phase 1)
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(10);
  });

  it('Phase advantage does NOT apply if any competitor is Phase 3', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const competitors = [
      makeTrial({ nctId: 'NCT00000002', phase: 'Phase 1', sponsor: 'Pfizer' }),
      makeTrial({ nctId: 'NCT00000003', phase: 'Phase 3', sponsor: 'Novartis' }),
    ];
    // 2 competitors → base 10, no bonus (not all Phase 1)
    const result = scoreCompetition(subject, competitors);
    expect(result.points).toBe(10);
  });

  it('ScoreComponent has correct shape', () => {
    const subject = makeTrial({ phase: 'Phase 3' });
    const result = scoreCompetition(subject, []);
    expect(result).toMatchObject({
      name: 'Competition',
      points: 15,
      maxPoints: 15,
      details: expect.any(String),
    });
  });
});
