import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scoreTemporalProximity } from '../../../src/lib/scoring/temporal-proximity-scorer.js';
import type { ClinicalTrial } from '../../../src/types.js';

// Fix "today" to 2024-01-15 for all tests
const FIXED_TODAY = new Date('2024-01-15T00:00:00.000Z').getTime();

function makeTrial(overrides: Partial<ClinicalTrial>): ClinicalTrial {
  return {
    nctId: 'NCT00000001',
    drugName: 'TestDrug',
    condition: 'Cancer',
    phase: 'Phase 3',
    status: 'ACTIVE_NOT_RECRUITING',
    estimatedCompletionDate: null,
    enrollment: 100,
    hasResults: false,
    sponsor: 'TestSponsor',
    ...overrides,
  };
}

/** Returns an ISO date string that is `days` from FIXED_TODAY */
function daysFromToday(days: number): string {
  const d = new Date(FIXED_TODAY + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

describe('scoreTemporalProximity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a ScoreComponent with correct name and maxPoints', () => {
    const trial = makeTrial({ hasResults: true });
    const result = scoreTemporalProximity(trial);
    expect(result.name).toBe('Temporal Proximity');
    expect(result.maxPoints).toBe(30);
    expect(typeof result.details).toBe('string');
  });

  // --- hasResults=true → 30 pts ---
  it('awards 30 pts when trial has results posted', () => {
    const trial = makeTrial({ hasResults: true });
    const result = scoreTemporalProximity(trial);
    expect(result.points).toBe(30);
  });

  // --- D-30 or less → 26 pts ---
  it('awards 26 pts when completion is today (D-0)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(0) });
    expect(scoreTemporalProximity(trial).points).toBe(26);
  });

  it('awards 26 pts when completion is in exactly 30 days (D-30)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(30) });
    expect(scoreTemporalProximity(trial).points).toBe(26);
  });

  it('awards 26 pts when completion date is in the past (D-negative)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(-10) });
    expect(scoreTemporalProximity(trial).points).toBe(26);
  });

  // --- D-31 to D-90 → 19 pts ---
  it('awards 19 pts when completion is in 31 days (D-31 boundary)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(31) });
    expect(scoreTemporalProximity(trial).points).toBe(19);
  });

  it('awards 19 pts when completion is in 90 days (D-90 boundary)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(90) });
    expect(scoreTemporalProximity(trial).points).toBe(19);
  });

  // --- D-91 to D-180 → 12 pts ---
  it('awards 12 pts when completion is in 91 days (D-91 boundary)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(91) });
    expect(scoreTemporalProximity(trial).points).toBe(12);
  });

  it('awards 12 pts when completion is in 180 days (D-180 boundary)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(180) });
    expect(scoreTemporalProximity(trial).points).toBe(12);
  });

  // --- D-181 to D-365 → 6 pts ---
  it('awards 6 pts when completion is in 181 days (D-181 boundary)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(181) });
    expect(scoreTemporalProximity(trial).points).toBe(6);
  });

  it('awards 6 pts when completion is in 365 days (D-365 boundary)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(365) });
    expect(scoreTemporalProximity(trial).points).toBe(6);
  });

  // --- D-365+ → 2 pts ---
  it('awards 2 pts when completion is in 366 days (D-366, just past 365)', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(366) });
    expect(scoreTemporalProximity(trial).points).toBe(2);
  });

  it('awards 2 pts when completion is far in the future', () => {
    const trial = makeTrial({ estimatedCompletionDate: daysFromToday(730) });
    expect(scoreTemporalProximity(trial).points).toBe(2);
  });

  // --- No estimated completion date → 1 pt ---
  it('awards 1 pt when estimatedCompletionDate is null', () => {
    const trial = makeTrial({ estimatedCompletionDate: null });
    expect(scoreTemporalProximity(trial).points).toBe(1);
  });

  // --- hasResults=true takes precedence over date ---
  it('awards 30 pts for hasResults=true even when completion date is far away', () => {
    const trial = makeTrial({
      hasResults: true,
      estimatedCompletionDate: daysFromToday(500),
    });
    expect(scoreTemporalProximity(trial).points).toBe(30);
  });
});
