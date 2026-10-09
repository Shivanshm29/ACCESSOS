/**
 * ACCESSOS Accessibility Engine Types
 * Strongly-typed domain contracts for deterministic barrier detection and reporting.
 */

export type AccessibilitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type AccessibilityCategory =
  | 'PERCEIVABILITY'
  | 'OPERABILITY'
  | 'UNDERSTANDABILITY'
  | 'ROBUSTNESS'
  | 'FORMS'
  | 'NAVIGATION'
  | 'VALIDATION'
  | 'COGNITIVE_LOAD';

export type AccessibilityRuleId =
  | 'FORM_MISSING_LABEL'
  | 'IMAGE_MISSING_ALT'
  | 'BUTTON_MISSING_NAME'
  | 'LINK_MISSING_NAME'
  | 'HEADING_HIERARCHY'
  | 'MAIN_LANDMARK'
  | 'INVALID_FORM_CONTROL'
  | 'ERROR_ASSOCIATION'
  | 'DUPLICATE_ID'
  | 'EMPTY_INTERACTIVE'
  | 'FILE_INSTRUCTION_ASSOCIATION'
  | 'REQUIRED_FIELD_INDICATION';

export interface AccessibilityFinding {
  id: string;
  ruleId: AccessibilityRuleId;
  category: AccessibilityCategory;
  severity: AccessibilitySeverity;
  title: string;
  description: string;
  affectedElementId?: string;
  evidence: Record<string, unknown>;
  remediation: string;
  confidence: number;
  deterministic: true;
}

export type ScoreBand =
  | 'Strong baseline'
  | 'Minor barriers'
  | 'Significant barriers'
  | 'Major barriers'
  | 'Severe barriers';

export interface PenaltyBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  totalDeduction: number;
}

export interface AccessibilityScore {
  rawScore: number;
  finalScore: number;
  band: ScoreBand;
  interpretation: string;
  formula: string;
  penalties: PenaltyBreakdown;
}

export interface AccessibilitySummary {
  totalFindings: number;
  bySeverity: Record<AccessibilitySeverity, number>;
  byCategory: Record<AccessibilityCategory, number>;
}

export interface AccessibilityReport {
  findings: AccessibilityFinding[];
  summary: AccessibilitySummary;
  score: AccessibilityScore;
  analyzedAt: number;
  deterministic: true;
}

export interface AccessibilityRuleContext {
  doc?: Document;
  counter: { value: number };
}

export interface AccessibilityRule {
  id: AccessibilityRuleId;
  title: string;
  category: AccessibilityCategory;
  severity: AccessibilitySeverity;
  execute: (
    representation: import('../core/types/representation').PageRepresentation,
    context: AccessibilityRuleContext
  ) => AccessibilityFinding[];
}
