import type { ClinicalTrial, ScoreComponent } from '../../types.js';
import { SCORING_WEIGHTS } from './weights.js';

export function scoreTemporalProximity(trial: ClinicalTrial): ScoreComponent {
  const maxPoints = SCORING_WEIGHTS.TEMPORAL_PROXIMITY;

  if (trial.hasResults) {
    return {
      name: 'Temporal Proximity',
      points: maxPoints,
      maxPoints,
      details: 'Trial has results posted',
    };
  }

  if (trial.estimatedCompletionDate === null) {
    return {
      name: 'Temporal Proximity',
      points: 1,
      maxPoints,
      details: 'No estimated completion date available',
    };
  }

  const today = Date.now();
  const completion = new Date(trial.estimatedCompletionDate).getTime();
  const daysUntil = Math.ceil((completion - today) / (24 * 60 * 60 * 1000));

  let points: number;
  let details: string;

  if (daysUntil <= 30) {
    points = 26;
    details = daysUntil <= 0
      ? 'Completion date reached or passed'
      : `Completion in ${daysUntil} day(s) (D-30 or less)`;
  } else if (daysUntil <= 90) {
    points = 19;
    details = `Completion in ${daysUntil} day(s) (D-31 to D-90)`;
  } else if (daysUntil <= 180) {
    points = 12;
    details = `Completion in ${daysUntil} day(s) (D-91 to D-180)`;
  } else if (daysUntil <= 365) {
    points = 6;
    details = `Completion in ${daysUntil} day(s) (D-181 to D-365)`;
  } else {
    points = 2;
    details = `Completion in ${daysUntil} day(s) (D-365+)`;
  }

  return {
    name: 'Temporal Proximity',
    points,
    maxPoints,
    details,
  };
}
