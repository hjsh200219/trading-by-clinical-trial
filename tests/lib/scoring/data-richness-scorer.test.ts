import { describe, it, expect } from 'vitest';
import { scoreDataRichness } from '../../../src/lib/scoring/data-richness-scorer.js';
import type { ClinicalTrial } from '../../../src/types.js';

const baseTrial: ClinicalTrial = {
  nctId: 'NCT00000001',
  drugName: null,
  condition: null,
  phase: null,
  status: null,
  estimatedCompletionDate: null,
  enrollment: null,
  hasResults: false,
  sponsor: null,
};

describe('scoreDataRichness', () => {
  it('all 5 fields populated → 5 pts', () => {
    const trial: ClinicalTrial = {
      ...baseTrial,
      drugName: 'Aspirin',
      condition: 'Hypertension',
      estimatedCompletionDate: '2025-12-31',
      enrollment: 100,
      hasResults: true,
    };
    const result = scoreDataRichness(trial);
    expect(result.points).toBe(5);
    expect(result.maxPoints).toBe(5);
    expect(result.name).toBe('Data Richness');
  });

  it('no fields populated (all null, hasResults=false) → 0 pts', () => {
    const result = scoreDataRichness(baseTrial);
    expect(result.points).toBe(0);
    expect(result.maxPoints).toBe(5);
  });

  it('only drugName populated → 1 pt', () => {
    const trial: ClinicalTrial = { ...baseTrial, drugName: 'Aspirin' };
    const result = scoreDataRichness(trial);
    expect(result.points).toBe(1);
  });

  it('3 out of 5 fields populated → 3 pts', () => {
    const trial: ClinicalTrial = {
      ...baseTrial,
      drugName: 'Aspirin',
      condition: 'Hypertension',
      enrollment: 50,
    };
    const result = scoreDataRichness(trial);
    expect(result.points).toBe(3);
  });

  it('hasResults=true counts as results_status present', () => {
    const trial: ClinicalTrial = { ...baseTrial, hasResults: true };
    const result = scoreDataRichness(trial);
    expect(result.points).toBe(1);
  });

  it('enrollment=0 is still present (only null counts as missing)', () => {
    const trial: ClinicalTrial = { ...baseTrial, enrollment: 0 };
    const result = scoreDataRichness(trial);
    expect(result.points).toBe(1);
  });

  it('empty string drugName is not present', () => {
    const trial: ClinicalTrial = { ...baseTrial, drugName: '' };
    const result = scoreDataRichness(trial);
    expect(result.points).toBe(0);
  });

  it('returns a ScoreComponent with details string', () => {
    const result = scoreDataRichness(baseTrial);
    expect(typeof result.details).toBe('string');
    expect(result.details.length).toBeGreaterThan(0);
  });
});
