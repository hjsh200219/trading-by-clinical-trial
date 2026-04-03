/**
 * Signal Combo Scoring Engine
 *
 * Ported from coin-trading/src/lib/clinical/combo-scorer.ts
 *
 * Evaluates 10 backtested signal combinations to produce
 * STRONG_BUY ~ AVOID grades based on institutional/foreign/short-selling data.
 *
 * Evaluation order: AVOID first (risk-first) → STRONG_BUY → BUY → WATCH → HOLD (fallback)
 */

import type {
  RecommendationGrade,
  SignalSnapshot,
  MatchedCondition,
  ComboScore,
} from '../types.js';

interface ComboDefinition {
  id: number;
  name: string;
  grade: RecommendationGrade;
  expectedReturn: number;
  winRate: number;
  match: (s: SignalSnapshot) => MatchedCondition[];
}

function instTotal(s: SignalSnapshot): number {
  return s.institutionalNetEarly + s.institutionalNetLate;
}

function foreignTotal(s: SignalSnapshot): number {
  return s.foreignNetEarly + s.foreignNetLate;
}

const COMBO_DEFINITIONS: ComboDefinition[] = [
  {
    id: 1,
    name: 'Institutional Acceleration + Short↓',
    grade: 'STRONG_BUY',
    expectedReturn: 8.43,
    winRate: 0.9412,
    match(s) {
      return [
        { name: 'Inst late > early (accelerating)', met: s.institutionalNetLate > s.institutionalNetEarly && s.institutionalNetLate > 0, value: s.institutionalNetLate - s.institutionalNetEarly, threshold: 0 },
        { name: 'Short selling ≤ 7%', met: s.shortSellingRatioAvg <= 7, value: s.shortSellingRatioAvg, threshold: 7 },
        { name: 'Late short selling ≤ 10%', met: s.shortSellingLate <= 10, value: s.shortSellingLate, threshold: 10 },
      ];
    },
  },
  {
    id: 2,
    name: 'Institutional + Short↓ + Foreign Buy',
    grade: 'STRONG_BUY',
    expectedReturn: 7.61,
    winRate: 0.7778,
    match(s) {
      return [
        { name: 'Inst net buy > 0', met: instTotal(s) > 0, value: instTotal(s), threshold: 0 },
        { name: 'Short selling ≤ 7%', met: s.shortSellingRatioAvg <= 7, value: s.shortSellingRatioAvg, threshold: 7 },
        { name: 'Foreign net buy > 0', met: foreignTotal(s) > 0, value: foreignTotal(s), threshold: 0 },
        { name: 'Late short selling ≤ 10%', met: s.shortSellingLate <= 10, value: s.shortSellingLate, threshold: 10 },
      ];
    },
  },
  {
    id: 3,
    name: 'Institutional Sustained 60d',
    grade: 'BUY',
    expectedReturn: 8.37,
    winRate: 0.80,
    match(s) {
      return [
        { name: 'Inst early > 0', met: s.institutionalNetEarly > 0, value: s.institutionalNetEarly, threshold: 0 },
        { name: 'Inst late > 0', met: s.institutionalNetLate > 0, value: s.institutionalNetLate, threshold: 0 },
      ];
    },
  },
  {
    id: 4,
    name: 'Institutional Large Buy',
    grade: 'BUY',
    expectedReturn: 4.98,
    winRate: 0.73,
    match(s) {
      return [
        { name: 'Inst net buy > 200K', met: instTotal(s) > 200000, value: instTotal(s), threshold: 200000 },
      ];
    },
  },
  {
    id: 5,
    name: 'Foreign Net Buy Reversal',
    grade: 'WATCH',
    expectedReturn: 3.21,
    winRate: 0.65,
    match(s) {
      return [
        { name: 'Foreign early sell', met: s.foreignNetEarly < 0, value: s.foreignNetEarly, threshold: 0 },
        { name: 'Foreign late buy', met: s.foreignNetLate > 0, value: s.foreignNetLate, threshold: 0 },
      ];
    },
  },
  {
    id: 6,
    name: 'Mixed Signal',
    grade: 'WATCH',
    expectedReturn: 1.52,
    winRate: 0.55,
    match(s) {
      return [
        { name: 'Inst net buy > 0', met: instTotal(s) > 0, value: instTotal(s), threshold: 0 },
        { name: 'Short selling > 10%', met: s.shortSellingRatioAvg > 10, value: s.shortSellingRatioAvg, threshold: 10 },
      ];
    },
  },
  {
    id: 7,
    name: 'No Signal',
    grade: 'HOLD',
    expectedReturn: 0.34,
    winRate: 0.52,
    match() {
      return [{ name: 'Default fallback', met: true, value: null, threshold: null }];
    },
  },
  {
    id: 8,
    name: 'Short Selling Surge',
    grade: 'AVOID',
    expectedReturn: -2.87,
    winRate: 0.35,
    match(s) {
      return [
        { name: 'Short selling > 15%', met: s.shortSellingRatioAvg > 15, value: s.shortSellingRatioAvg, threshold: 15 },
        { name: 'Short accelerating (late > early)', met: s.shortSellingLate > s.shortSellingEarly, value: s.shortSellingLate - s.shortSellingEarly, threshold: 0 },
      ];
    },
  },
  {
    id: 9,
    name: 'Institutional Sell Reversal',
    grade: 'AVOID',
    expectedReturn: -4.21,
    winRate: 0.25,
    match(s) {
      return [
        { name: 'Inst early buy', met: s.institutionalNetEarly > 0, value: s.institutionalNetEarly, threshold: 0 },
        { name: 'Inst late sell', met: s.institutionalNetLate < 0, value: s.institutionalNetLate, threshold: 0 },
      ];
    },
  },
  {
    id: 10,
    name: 'Institutional + Foreign Sell',
    grade: 'AVOID',
    expectedReturn: -6.63,
    winRate: 0.10,
    match(s) {
      return [
        { name: 'Inst net sell', met: instTotal(s) < 0, value: instTotal(s), threshold: 0 },
        { name: 'Foreign net sell', met: foreignTotal(s) < 0, value: foreignTotal(s), threshold: 0 },
      ];
    },
  },
];

/**
 * Phase multiplier for expected return adjustment.
 */
export function getPhaseMultiplier(phase: string | null): number {
  if (!phase) return 1.0;
  const p = phase.toUpperCase().replace(/\s+/g, '');
  if (p.includes('PHASE3') || p === '3') return 1.5;
  if (p.includes('PHASE4') || p === '4') return 0.8;
  if (p.includes('PHASE2') || p === '2') return 1.0;
  if (p.includes('PHASE1') || p.includes('EARLY')) return 0.7;
  return 1.0;
}

function calculateConfidence(dataPoints: number): number {
  if (dataPoints >= 20) return Math.min(1.0, 0.8 + (dataPoints - 20) * 0.01);
  if (dataPoints >= 10) return 0.5 + (dataPoints - 10) * 0.03;
  if (dataPoints >= 5) return 0.3 + (dataPoints - 5) * 0.04;
  return Math.max(0.1, dataPoints * 0.06);
}

function buildResult(
  combo: ComboDefinition,
  conditions: MatchedCondition[],
  phaseMultiplier: number,
  confidence: number,
): ComboScore {
  return {
    comboId: combo.id,
    comboName: combo.name,
    grade: combo.grade,
    expectedReturn: combo.expectedReturn,
    winRate: combo.winRate,
    confidence,
    phaseMultiplier,
    adjustedReturn: combo.expectedReturn * phaseMultiplier,
    matchedConditions: conditions,
  };
}

/**
 * Evaluate a signal snapshot against all 10 combos.
 * AVOID combos checked first (risk-first), then STRONG_BUY → BUY → WATCH → HOLD.
 */
export function evaluateCombo(signal: SignalSnapshot, phase: string | null): ComboScore {
  const phaseMultiplier = getPhaseMultiplier(phase);
  const confidence = calculateConfidence(signal.dataPoints);

  // AVOID first (risk detection)
  const avoidCombos = COMBO_DEFINITIONS.filter(c => c.grade === 'AVOID');
  for (const combo of avoidCombos) {
    const conditions = combo.match(signal);
    if (conditions.every(c => c.met)) {
      return buildResult(combo, conditions, phaseMultiplier, confidence);
    }
  }

  // STRONG_BUY → BUY → WATCH
  const positiveCombos = COMBO_DEFINITIONS.filter(c => c.grade !== 'AVOID' && c.grade !== 'HOLD');
  for (const combo of positiveCombos) {
    const conditions = combo.match(signal);
    if (conditions.every(c => c.met)) {
      return buildResult(combo, conditions, phaseMultiplier, confidence);
    }
  }

  // Fallback: HOLD
  const holdCombo = COMBO_DEFINITIONS.find(c => c.grade === 'HOLD')!;
  const holdConditions = holdCombo.match(signal);
  return buildResult(holdCombo, holdConditions, phaseMultiplier, confidence);
}

/**
 * Format combo score for display.
 */
export function formatComboScore(score: ComboScore): string {
  const gradeEmoji: Record<string, string> = {
    STRONG_BUY: '🟢', BUY: '🔵', WATCH: '🟡', HOLD: '⚪', AVOID: '🔴',
  };
  const emoji = gradeEmoji[score.grade] ?? '⚪';
  const conditions = score.matchedConditions
    .filter(c => c.met)
    .map(c => c.value !== null ? `${c.name}: ${c.value.toLocaleString()}` : c.name)
    .join(', ');

  return [
    `${emoji} **${score.grade}** — ${score.comboName}`,
    `Expected Return: ${score.expectedReturn.toFixed(1)}% (adjusted: ${score.adjustedReturn.toFixed(1)}%)`,
    `Win Rate: ${(score.winRate * 100).toFixed(0)}% | Confidence: ${(score.confidence * 100).toFixed(0)}%`,
    `Phase Multiplier: ${score.phaseMultiplier}x`,
    `Conditions: ${conditions}`,
  ].join('\n');
}
