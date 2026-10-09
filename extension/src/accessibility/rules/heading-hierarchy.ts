/**
 * Rule 5: HEADING_HIERARCHY
 * Detects problematic heading structure, skipped heading levels, and missing top-level h1.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const HeadingHierarchyRule: AccessibilityRule = {
  id: 'HEADING_HIERARCHY',
  title: 'Heading hierarchy is skipped or invalid',
  category: 'UNDERSTANDABILITY',
  severity: 'MEDIUM',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const headings = representation.headings;

    if (headings.length === 0) {
      return findings;
    }

    const h1Count = headings.filter((h) => h.level === 1).length;

    // Check 1: Missing top-level h1
    if (h1Count === 0) {
      context.counter.value += 1;
      findings.push({
        id: `finding-${String(context.counter.value).padStart(3, '0')}`,
        ruleId: 'HEADING_HIERARCHY',
        category: 'UNDERSTANDABILITY',
        severity: 'MEDIUM',
        title: 'Document is missing a top-level h1 heading',
        description: 'The page does not contain an <h1> element, making it difficult for screen readers to identify the primary page topic.',
        affectedElementId: headings[0]?.id,
        evidence: {
          totalHeadings: headings.length,
          h1Count: 0,
          firstHeadingLevel: headings[0]?.level,
        },
        remediation: 'Introduce an <h1> heading representing the overarching title of the application or document.',
        confidence: 1.0,
        deterministic: true,
      });
    }

    // Check 2: Level jumps greater than 1 (e.g., h1 followed directly by h3)
    let prevLevel = 0;
    headings.forEach((h) => {
      if (prevLevel > 0 && h.level > prevLevel + 1) {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'HEADING_HIERARCHY',
          category: 'UNDERSTANDABILITY',
          severity: 'MEDIUM',
          title: `Heading level h${h.level} skips hierarchy from h${prevLevel}`,
          description: `The heading structure jumps from level h${prevLevel} directly to h${h.level}, violating logical outline hierarchy.`,
          affectedElementId: h.id,
          evidence: {
            headingId: h.id,
            headingText: h.text,
            currentLevel: h.level,
            previousLevel: prevLevel,
            skippedLevelsCount: h.level - prevLevel - 1,
          },
          remediation: `Adjust the heading level to h${prevLevel + 1} or insert intermediate semantic headings to preserve hierarchy.`,
          confidence: 1.0,
          deterministic: true,
        });
      }
      prevLevel = h.level;
    });

    return findings;
  },
};
