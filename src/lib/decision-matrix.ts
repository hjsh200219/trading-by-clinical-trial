import type { ClinicalTrial, ScoreComponent, RSIResult, DecisionResult, ConfidenceLevel } from '../types.js';

/**
 * Returns true if estimatedCompletionDate is within 30 days from now (or already past).
 */
function isWithin30Days(estimatedCompletionDate: string | null): boolean {
  if (!estimatedCompletionDate) return false;
  const completion = new Date(estimatedCompletionDate);
  const now = new Date();
  const diffMs = completion.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 30;
}

function getDataRichnessPoints(components: ScoreComponent[]): number {
  const comp = components.find(c => c.name === 'data_richness');
  return comp ? comp.points : 0;
}

function determineConfidence(totalScore: number, components: ScoreComponent[]): ConfidenceLevel {
  const dataRichness = getDataRichnessPoints(components);
  if (totalScore >= 70 && dataRichness >= 4) return 'HIGH';
  if (totalScore >= 40 && dataRichness >= 2) return 'MEDIUM';
  return 'LOW';
}

export function makeDecision(
  trial: ClinicalTrial,
  totalScore: number,
  components: ScoreComponent[],
  rsi: RSIResult | null
): DecisionResult {
  const confidence = determineConfidence(totalScore, components);

  // Priority 1: hasResults → TRIAL_REVIEW
  if (trial.hasResults) {
    return {
      decision: 'TRIAL_REVIEW',
      confidence,
      reasoning: 'Trial has posted results that require manual assessment.',
    };
  }

  // Priority 2: Low data confidence
  const dataRichnessPoints = getDataRichnessPoints(components);
  const scoredComponentCount = components.filter(c => c.points > 0).length;
  if (dataRichnessPoints === 0 || scoredComponentCount < 3) {
    return {
      decision: 'TRIAL_WATCH',
      confidence,
      reasoning: 'Insufficient data confidence: data_richness is 0 or fewer than 3 components scored.',
    };
  }

  // Priority 3: Phase 1 or Early Phase 1
  const phase = trial.phase ?? '';
  if (phase === 'Phase 1' || phase === 'Early Phase 1') {
    return {
      decision: 'TRIAL_WATCH',
      confidence,
      reasoning: `Trial is in ${phase}, which carries high early-stage risk.`,
    };
  }

  // Priorities 4 & 5: Score >= 75, Phase 3, within D-30
  const isPhase3 = phase === 'Phase 3';
  const withinD30 = isWithin30Days(trial.estimatedCompletionDate);
  if (totalScore >= 75 && isPhase3 && withinD30) {
    if (rsi !== null) {
      // Priority 5: overbought guard
      if (rsi.value > 70) {
        return {
          decision: 'TRIAL_WATCH',
          confidence,
          reasoning: `Strong trial fundamentals but RSI=${rsi.value} indicates overbought conditions.`,
        };
      }
      // Priority 4: strong positive with RSI < 50
      if (rsi.value < 50) {
        return {
          decision: 'TRIAL_STRONG_POSITIVE',
          confidence,
          reasoning: `Score ${totalScore} >= 75, Phase 3, completion within 30 days, RSI=${rsi.value} is favorable.`,
        };
      }
      // RSI between 50-70: fall through to score-based rules
    } else {
      // RSI null fallback: strong positive
      return {
        decision: 'TRIAL_STRONG_POSITIVE',
        confidence,
        reasoning: `Score ${totalScore} >= 75, Phase 3, completion within 30 days. RSI unavailable, defaulting to strong positive.`,
      };
    }
  }

  // Priority 6: Score >= 60
  if (totalScore >= 60) {
    return {
      decision: 'TRIAL_POSITIVE',
      confidence,
      reasoning: `Score ${totalScore} >= 60 indicates a positive trial outlook.`,
    };
  }

  // Priority 7: Score 40-59
  if (totalScore >= 40) {
    return {
      decision: 'TRIAL_NEUTRAL',
      confidence,
      reasoning: `Score ${totalScore} is in the neutral range (40-59).`,
    };
  }

  // Priority 8: Score < 40
  return {
    decision: 'TRIAL_WATCH',
    confidence,
    reasoning: `Score ${totalScore} < 40 indicates insufficient trial quality for investment consideration.`,
  };
}
