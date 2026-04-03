import type { ClinicalTrial, ScoreComponent } from '../../types.js';
import { SCORING_WEIGHTS } from './weights.js';

const LARGE_ENROLLMENT_THRESHOLD = 500;

/**
 * Extracts the highest phase number from a phase string.
 * e.g. "Phase 3" → 3, "Phase 2/Phase 3" → 3, "Early Phase 1" → 0, null → 0
 */
function extractHighestPhase(phase: string | null): number {
  if (!phase) return 0;

  // Handle "Early Phase 1" as a special case below 1
  // We return 0 so it falls into the unknown/early bucket
  if (/early\s+phase/i.test(phase)) return 0;

  // Extract all phase numbers from the string (handles "Phase 2/Phase 3")
  const matches = phase.match(/\d+/g);
  if (!matches || matches.length === 0) return 0;

  return Math.max(...matches.map(Number));
}

function isLargeEnrollment(enrollment: number | null): boolean {
  return enrollment !== null && enrollment > LARGE_ENROLLMENT_THRESHOLD;
}

export function scoreImpact(trial: ClinicalTrial): ScoreComponent {
  const phaseNum = extractHighestPhase(trial.phase);
  const large = isLargeEnrollment(trial.enrollment);

  let points: number;
  let details: string;

  if (phaseNum === 3) {
    points = large ? 25 : 21;
    details = `Phase 3${large ? ' large enrollment (>500)' : ' standard enrollment'}`;
  } else if (phaseNum === 2) {
    points = large ? 15 : 12;
    details = `Phase 2${large ? ' large enrollment (>500)' : ' standard enrollment'}`;
  } else if (phaseNum === 4) {
    points = 8;
    details = 'Phase 4 (post-marketing)';
  } else if (phaseNum === 1) {
    points = large ? 5 : 4;
    details = `Phase 1${large ? ' large enrollment (>500)' : ' standard enrollment'}`;
  } else {
    points = 2;
    details = trial.phase ? `Early Phase 1 / Unknown (${trial.phase})` : 'Unknown phase';
  }

  return {
    name: 'Impact',
    points,
    maxPoints: SCORING_WEIGHTS.IMPACT,
    details,
  };
}
