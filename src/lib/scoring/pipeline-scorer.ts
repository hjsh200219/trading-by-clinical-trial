import { ClinicalTrial, ScoreComponent } from '../../types.js';
import { SCORING_WEIGHTS } from './weights.js';

const ACTIVE_STATUS_KEYWORDS = ['recruiting', 'active', 'enrolling', 'not yet recruiting'];

function isActiveTrial(trial: ClinicalTrial): boolean {
  if (!trial.status) return false;
  const lower = trial.status.toLowerCase();
  return ACTIVE_STATUS_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function hasMultipleTherapeuticAreas(activeTrials: ClinicalTrial[]): boolean {
  const conditions = new Set(
    activeTrials
      .map((t) => t.condition?.trim().toLowerCase())
      .filter((c): c is string => !!c),
  );
  return conditions.size > 1;
}

export function scorePipeline(trials: ClinicalTrial[]): ScoreComponent {
  const activeTrials = trials.filter(isActiveTrial);
  const count = activeTrials.length;

  let base: number;
  if (count === 0) {
    base = 0;
  } else if (count === 1) {
    base = 2;
  } else if (count === 2) {
    base = 4;
  } else if (count <= 4) {
    base = 7;
  } else {
    base = 10;
  }

  const multiAreaBonus = count > 0 && hasMultipleTherapeuticAreas(activeTrials) ? 2 : 0;
  const points = Math.min(base + multiAreaBonus, SCORING_WEIGHTS.PIPELINE);

  const details = count === 0
    ? 'No active trials'
    : `${count} active trial${count > 1 ? 's' : ''}${multiAreaBonus > 0 ? ', multiple therapeutic areas (+2)' : ''}`;

  return {
    name: 'Pipeline',
    points,
    maxPoints: SCORING_WEIGHTS.PIPELINE,
    details,
  };
}
