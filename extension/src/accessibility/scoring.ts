/**
 * ACCESSOS Deterministic Accessibility Scoring Model
 * Transparent, explainable deduction-based scoring system.
 * 
 * DISCLAIMER:
 * This score represents an objective ACCESSOS Accessibility Baseline heuristic.
 * It is NOT an official claim of WCAG 2.1/2.2 compliance or W3C conformance.
 */
import type {
  AccessibilityFinding,
  AccessibilityScore,
  PenaltyBreakdown,
  ScoreBand,
} from './types';
import { SEVERITY_WEIGHTS } from './severity';

export const SCORE_FORMULA_DOCUMENTATION =
  'finalScore = clamp(100 - (critical * 20 + high * 10 + medium * 5 + low * 2), 0, 100)';

export function calculateScore(findings: AccessibilityFinding[]): AccessibilityScore {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;

  findings.forEach((f) => {
    switch (f.severity) {
      case 'CRITICAL':
        criticalCount += 1;
        break;
      case 'HIGH':
        highCount += 1;
        break;
      case 'MEDIUM':
        mediumCount += 1;
        break;
      case 'LOW':
        lowCount += 1;
        break;
      case 'INFO':
        infoCount += 1;
        break;
    }
  });

  const criticalDeduction = criticalCount * SEVERITY_WEIGHTS.CRITICAL;
  const highDeduction = highCount * SEVERITY_WEIGHTS.HIGH;
  const mediumDeduction = mediumCount * SEVERITY_WEIGHTS.MEDIUM;
  const lowDeduction = lowCount * SEVERITY_WEIGHTS.LOW;
  const totalDeduction = criticalDeduction + highDeduction + mediumDeduction + lowDeduction;

  const rawScore = 100 - totalDeduction;
  const finalScore = Math.max(0, Math.min(100, rawScore));

  const penalties: PenaltyBreakdown = {
    critical: criticalDeduction,
    high: highDeduction,
    medium: mediumDeduction,
    low: lowDeduction,
    info: 0,
    totalDeduction,
  };

  const band = resolveScoreBand(finalScore);
  const interpretation = resolveScoreInterpretation(band);

  return {
    rawScore,
    finalScore,
    band,
    interpretation,
    formula: SCORE_FORMULA_DOCUMENTATION,
    penalties,
  };
}

export function resolveScoreBand(score: number): ScoreBand {
  if (score >= 90) return 'Strong baseline';
  if (score >= 75) return 'Minor barriers';
  if (score >= 50) return 'Significant barriers';
  if (score >= 25) return 'Major barriers';
  return 'Severe barriers';
}

export function resolveScoreInterpretation(band: ScoreBand): string {
  switch (band) {
    case 'Strong baseline':
      return 'Few or no objective accessibility anomalies detected by deterministic baseline checks.';
    case 'Minor barriers':
      return 'Minor accessibility friction observed. Key form and landmark semantics are mostly sound.';
    case 'Significant barriers':
      return 'Meaningful accessibility obstacles detected that may impede users of assistive technology.';
    case 'Major barriers':
      return 'Multiple severe structural, label, or interaction barriers significantly degrade accessibility.';
    case 'Severe barriers':
      return 'Critical accessibility barriers severely obstruct task completion and navigation.';
  }
}
