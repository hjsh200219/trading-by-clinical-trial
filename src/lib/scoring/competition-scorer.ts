import { ClinicalTrial, ScoreComponent } from '../../types.js';
import { SCORING_WEIGHTS } from './weights.js';

function extractPhaseNumber(phase: string | null): number {
  if (!phase) return 0;
  if (/early\s+phase/i.test(phase)) return 0;
  const matches = phase.match(/\d+/g);
  if (!matches || matches.length === 0) return 0;
  return Math.max(...matches.map(Number));
}

export function scoreCompetition(
  subjectTrial: ClinicalTrial,
  competitors: ClinicalTrial[]
): ScoreComponent {
  const maxPoints = SCORING_WEIGHTS.COMPETITION;
  const count = competitors.length;

  let basePoints: number;
  let details: string;

  if (count === 0) {
    basePoints = 15;
    details = 'No competitors in same condition + phase (first mover)';
  } else if (count <= 2) {
    basePoints = 10;
    details = `${count} competitor${count === 1 ? '' : 's'} in same condition + phase`;
  } else if (count <= 5) {
    basePoints = 6;
    details = `${count} competitors in same condition + phase`;
  } else {
    basePoints = 2;
    details = `${count} competitors in same condition + phase (crowded)`;
  }

  // Phase advantage bonus: +3 if subject is Phase 3 and ALL competitors are Phase 1
  let bonus = 0;
  if (count > 0) {
    const subjectPhase = extractPhaseNumber(subjectTrial.phase);
    const allCompetitorsPhase1 = competitors.every(
      (c) => extractPhaseNumber(c.phase) === 1
    );
    if (subjectPhase === 3 && allCompetitorsPhase1) {
      bonus = 3;
      details += ' (phase advantage: all competitors Phase 1)';
    }
  }

  const points = Math.min(basePoints + bonus, maxPoints);

  return {
    name: 'Competition',
    points,
    maxPoints,
    details,
  };
}
