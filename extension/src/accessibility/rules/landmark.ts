/**
 * Rule 6: MAIN_LANDMARK
 * Detects absence of a primary <main> or role="main" landmark container.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const MainLandmarkRule: AccessibilityRule = {
  id: 'MAIN_LANDMARK',
  title: 'Page is missing a main landmark',
  category: 'NAVIGATION',
  severity: 'MEDIUM',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    const hasMainInSignals = representation.accessibilitySignals.hasMainLandmark;
    const hasMainInSections = representation.sections.some(
      (s) => s.role === 'main' || s.role.toLowerCase() === 'main'
    );
    const hasMainInDoc = context.doc
      ? context.doc.querySelector('main, [role="main"]') !== null
      : false;

    const hasMain = hasMainInSignals || hasMainInSections || hasMainInDoc;

    if (!hasMain) {
      context.counter.value += 1;
      findings.push({
        id: `finding-${String(context.counter.value).padStart(3, '0')}`,
        ruleId: 'MAIN_LANDMARK',
        category: 'NAVIGATION',
        severity: 'MEDIUM',
        title: 'Page lacks a <main> landmark',
        description: 'No <main> or role="main" element was detected. Screen reader users cannot quickly jump to the core content.',
        affectedElementId: undefined,
        evidence: {
          hasMainLandmark: false,
          totalSections: representation.sections.length,
        },
        remediation: 'Enclose primary page content in a semantic <main> element or add role="main" to the primary content container.',
        confidence: 1.0,
        deterministic: true,
      });
    }

    return findings;
  },
};
