/**
 * ACCESSOS Deterministic Accessibility Engine
 * Evaluates semantic PageRepresentation and local DOM signals against the rule catalog.
 * Produces structured, deterministic AccessibilityReport with explainable scores.
 * 
 * STRICT ARCHITECTURAL PRINCIPLE:
 * Zero LLM / AI dependencies. 100% deterministic, local, and reproducible.
 */
import type { PageRepresentation } from '../core/types/representation';
import type {
  AccessibilityCategory,
  AccessibilityFinding,
  AccessibilityReport,
  AccessibilitySeverity,
  AccessibilitySummary,
} from './types';
import { RULE_CATALOG } from './rules/index';
import { calculateScore } from './scoring';

export function analyzeAccessibility(
  representation: PageRepresentation,
  doc?: Document
): AccessibilityReport {
  const context = {
    doc,
    counter: { value: 0 },
  };

  const allFindings: AccessibilityFinding[] = [];

  // Execute all registered deterministic rules in catalog sequence
  RULE_CATALOG.forEach((rule) => {
    try {
      const ruleFindings = rule.execute(representation, context);
      allFindings.push(...ruleFindings);
    } catch (err: unknown) {
      console.error(`[ACCESSOS Engine] Error executing rule '${rule.id}':`, err);
    }
  });

  // Deduplicate any finding with identical ruleId and affectedElementId
  const seenKeys = new Set<string>();
  const findings: AccessibilityFinding[] = [];

  allFindings.forEach((finding) => {
    const dedupeKey = `${finding.ruleId}::${finding.affectedElementId || 'global'}::${finding.title}`;
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      findings.push(finding);
    }
  });

  // Compile summary statistics
  const bySeverity: Record<AccessibilitySeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  const byCategory: Record<AccessibilityCategory, number> = {
    PERCEIVABILITY: 0,
    OPERABILITY: 0,
    UNDERSTANDABILITY: 0,
    ROBUSTNESS: 0,
    FORMS: 0,
    NAVIGATION: 0,
    VALIDATION: 0,
    COGNITIVE_LOAD: 0,
  };

  findings.forEach((f) => {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  });

  const summary: AccessibilitySummary = {
    totalFindings: findings.length,
    bySeverity,
    byCategory,
  };

  // Compute explainable deterministic score
  const score = calculateScore(findings);

  return {
    findings,
    summary,
    score,
    analyzedAt: Date.now(),
    deterministic: true,
  };
}
