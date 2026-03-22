import { describe, it, expect } from 'vitest';
import { mapCompetitors } from '../../src/lib/competition-mapper.js';
import type { ClinicalTrial } from '../../src/types.js';

const makeTrial = (overrides: Partial<ClinicalTrial> = {}): ClinicalTrial => ({
  nctId: 'NCT00000001',
  drugName: 'TestDrug',
  condition: 'Lung Cancer',
  phase: 'Phase 3',
  status: 'Recruiting',
  estimatedCompletionDate: '2025-12-01',
  enrollment: 100,
  hasResults: false,
  sponsor: 'Some Pharma Co.',
  ...overrides,
});

describe('mapCompetitors', () => {
  it('filters out subject company own trials by sponsor', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000001', sponsor: 'Celltrion' }),
      makeTrial({ nctId: 'NCT00000002', sponsor: 'Pfizer' }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result).toHaveLength(1);
    expect(result[0].nctId).toBe('NCT00000002');
  });

  it('maps trial data to CompetitorInfo correctly', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({
        nctId: 'NCT00000099',
        sponsor: 'Pfizer',
        phase: 'Phase 2',
        status: 'Active, not recruiting',
        condition: 'Breast Cancer',
        estimatedCompletionDate: '2026-06-30',
      }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result).toHaveLength(1);
    const comp = result[0];
    expect(comp.sponsor).toBe('Pfizer');
    expect(comp.nctId).toBe('NCT00000099');
    expect(comp.phase).toBe('Phase 2');
    expect(comp.status).toBe('Active, not recruiting');
    expect(comp.condition).toBe('Breast Cancer');
    expect(comp.estimatedCompletion).toBe('2026-06-30');
  });

  it('flags Korean company trials as isKorean=true', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000010', sponsor: 'Samsung Biologics' }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result).toHaveLength(1);
    expect(result[0].isKorean).toBe(true);
  });

  it('flags non-Korean company trials as isKorean=false', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000020', sponsor: 'Pfizer' }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result).toHaveLength(1);
    expect(result[0].isKorean).toBe(false);
  });

  it('handles null condition gracefully (defaults to empty string)', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000030', sponsor: 'Pfizer', condition: null }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result[0].condition).toBe('');
  });

  it('handles null phase gracefully (defaults to Unknown)', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000031', sponsor: 'Pfizer', phase: null }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result[0].phase).toBe('Unknown');
  });

  it('handles null status gracefully (defaults to Unknown)', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000032', sponsor: 'Pfizer', status: null }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result[0].status).toBe('Unknown');
  });

  it('handles null sponsor gracefully (includes trial with empty sponsor)', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000033', sponsor: null }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result).toHaveLength(1);
    expect(result[0].sponsor).toBe('');
  });

  it('returns empty array when no competitors exist', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000040', sponsor: 'Celltrion' }),
      makeTrial({ nctId: 'NCT00000041', sponsor: 'Celltrion Inc.' }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when given empty trials array', () => {
    const result = mapCompetitors('Celltrion', []);
    expect(result).toHaveLength(0);
  });

  it('performs case-insensitive sponsor matching for self-exclusion', () => {
    const trials: ClinicalTrial[] = [
      makeTrial({ nctId: 'NCT00000050', sponsor: 'CELLTRION' }),
      makeTrial({ nctId: 'NCT00000051', sponsor: 'celltrion' }),
      makeTrial({ nctId: 'NCT00000052', sponsor: 'Pfizer' }),
    ];
    const result = mapCompetitors('Celltrion', trials);
    expect(result).toHaveLength(1);
    expect(result[0].nctId).toBe('NCT00000052');
  });
});
