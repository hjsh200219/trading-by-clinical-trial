import type { ClinicalTrial, ScoreComponent } from '../../types.js';
import { SCORING_WEIGHTS } from './weights.js';

export function scoreDataRichness(trial: ClinicalTrial): ScoreComponent {
  let score = 0;
  const present: string[] = [];
  const missing: string[] = [];

  // drug_name: not null and not empty string
  if (trial.drugName !== null && trial.drugName !== '') {
    score++;
    present.push('drug_name');
  } else {
    missing.push('drug_name');
  }

  // condition: not null and not empty string
  if (trial.condition !== null && trial.condition !== '') {
    score++;
    present.push('condition');
  } else {
    missing.push('condition');
  }

  // enrollment: not null (0 counts as present)
  if (trial.enrollment !== null) {
    score++;
    present.push('enrollment');
  } else {
    missing.push('enrollment');
  }

  // estimated_completion_date: not null and not empty string
  if (trial.estimatedCompletionDate !== null && trial.estimatedCompletionDate !== '') {
    score++;
    present.push('estimated_completion_date');
  } else {
    missing.push('estimated_completion_date');
  }

  // results_status: hasResults=true counts as present
  if (trial.hasResults) {
    score++;
    present.push('results_status');
  } else {
    missing.push('results_status');
  }

  const details =
    `${score}/${SCORING_WEIGHTS.DATA_RICHNESS} fields populated` +
    (present.length > 0 ? `. Present: ${present.join(', ')}` : '') +
    (missing.length > 0 ? `. Missing: ${missing.join(', ')}` : '');

  return {
    name: 'Data Richness',
    points: score,
    maxPoints: SCORING_WEIGHTS.DATA_RICHNESS,
    details,
  };
}
