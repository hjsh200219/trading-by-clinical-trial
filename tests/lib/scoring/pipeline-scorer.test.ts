import { describe, it, expect } from 'vitest';
import { scorePipeline } from '../../../src/lib/scoring/pipeline-scorer.js';
import { ClinicalTrial } from '../../../src/types.js';

function makeTrial(overrides: Partial<ClinicalTrial> = {}): ClinicalTrial {
  return {
    nctId: 'NCT00000001',
    drugName: 'TestDrug',
    condition: 'TestCondition',
    phase: 'Phase 2',
    status: 'Recruiting',
    estimatedCompletionDate: null,
    enrollment: null,
    hasResults: false,
    sponsor: 'TestSponsor',
    ...overrides,
  };
}

describe('scorePipeline', () => {
  it('0 trials → 0 pts', () => {
    const result = scorePipeline([]);
    expect(result.points).toBe(0);
    expect(result.maxPoints).toBe(10);
    expect(result.name).toBe('Pipeline');
  });

  it('1 active trial → 2 pts', () => {
    const result = scorePipeline([makeTrial({ status: 'Recruiting' })]);
    expect(result.points).toBe(2);
  });

  it('2 active trials → 4 pts', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Active, not recruiting' }),
    ]);
    expect(result.points).toBe(4);
  });

  it('3 active trials → 7 pts', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Enrolling by invitation' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Not yet recruiting' }),
    ]);
    expect(result.points).toBe(7);
  });

  it('4 active trials → 7 pts', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Active, not recruiting' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Enrolling by invitation' }),
      makeTrial({ nctId: 'NCT00000004', status: 'Not yet recruiting' }),
    ]);
    expect(result.points).toBe(7);
  });

  it('5 active trials → 10 pts', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Active, not recruiting' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Enrolling by invitation' }),
      makeTrial({ nctId: 'NCT00000004', status: 'Not yet recruiting' }),
      makeTrial({ nctId: 'NCT00000005', status: 'Recruiting' }),
    ]);
    expect(result.points).toBe(10);
  });

  it('6 active trials → 10 pts (5+ bucket)', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000004', status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000005', status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000006', status: 'Recruiting' }),
    ]);
    expect(result.points).toBe(10);
  });

  it('Completed trials do NOT count as active', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Completed' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Terminated' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Withdrawn' }),
    ]);
    expect(result.points).toBe(0);
  });

  it('Mix of active and non-active: only active trials count', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Completed' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Terminated' }),
    ]);
    // 1 active → 2 pts
    expect(result.points).toBe(2);
  });

  it('null status does NOT count as active', () => {
    const result = scorePipeline([makeTrial({ status: null })]);
    expect(result.points).toBe(0);
  });

  it('Multi-area bonus: 5+ active trials across different conditions → +2, capped at 10', () => {
    // 5 active trials = 10 pts base, bonus would be 12 but cap at 10
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting', condition: 'Cancer' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Recruiting', condition: 'Diabetes' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Recruiting', condition: 'Cancer' }),
      makeTrial({ nctId: 'NCT00000004', status: 'Recruiting', condition: 'Diabetes' }),
      makeTrial({ nctId: 'NCT00000005', status: 'Recruiting', condition: 'Cancer' }),
    ]);
    // base 10, bonus +2, capped at 10
    expect(result.points).toBe(10);
  });

  it('Multi-area bonus: 3 active trials across 2 conditions → base 7 + 2 bonus = 9', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting', condition: 'Cancer' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Recruiting', condition: 'Diabetes' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Recruiting', condition: 'Cancer' }),
    ]);
    // base 7, +2 multi-area bonus = 9
    expect(result.points).toBe(9);
  });

  it('No multi-area bonus when all active trials have the same condition', () => {
    const result = scorePipeline([
      makeTrial({ status: 'Recruiting', condition: 'Cancer' }),
      makeTrial({ nctId: 'NCT00000002', status: 'Recruiting', condition: 'Cancer' }),
      makeTrial({ nctId: 'NCT00000003', status: 'Recruiting', condition: 'Cancer' }),
    ]);
    // base 7, no bonus
    expect(result.points).toBe(7);
  });

  it('ScoreComponent has correct shape', () => {
    const result = scorePipeline([makeTrial({ status: 'Recruiting' })]);
    expect(result).toMatchObject({
      name: 'Pipeline',
      points: expect.any(Number),
      maxPoints: 10,
      details: expect.any(String),
    });
  });
});
