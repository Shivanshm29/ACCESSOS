/**
 * Rule 10: EMPTY_INTERACTIVE
 * Detects custom or non-semantic interactive elements that contain no accessible content.
 * Deduplicates against BUTTON_MISSING_NAME and LINK_MISSING_NAME.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const EmptyInteractiveRule: AccessibilityRule = {
  id: 'EMPTY_INTERACTIVE',
  title: 'Interactive control has no content or accessible name',
  category: 'OPERABILITY',
  severity: 'MEDIUM',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    // Checked button and link IDs from previous rules to prevent duplication
    const buttonIds = new Set(representation.buttons.map((b) => b.id));
    const linkIds = new Set(representation.links.map((l) => l.id));

    if (context.doc) {
      // Find non-native interactive elements (custom ARIA roles)
      const customInteractives = context.doc.querySelectorAll(
        '[role="button"]:not(button), [role="link"]:not(a), [role="tab"], [role="menuitem"]'
      );

      customInteractives.forEach((el) => {
        const text = el.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label')?.trim() || '';
        const ariaLabelledby = el.getAttribute('aria-labelledby')?.trim() || '';

        if (!text && !ariaLabel && !ariaLabelledby) {
          const stableId = el.getAttribute('data-accessos-id') || undefined;
          context.counter.value += 1;
          findings.push({
            id: `finding-${String(context.counter.value).padStart(3, '0')}`,
            ruleId: 'EMPTY_INTERACTIVE',
            category: 'OPERABILITY',
            severity: 'MEDIUM',
            title: 'Custom interactive element lacks content or accessible name',
            description: `Element with role="${el.getAttribute('role')}" contains neither text content nor an aria-label.`,
            affectedElementId: stableId,
            evidence: {
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute('role'),
              hasText: false,
              hasAriaLabel: false,
            },
            remediation: 'Provide visible text or an aria-label attribute for this custom interactive element.',
            confidence: 1.0,
            deterministic: true,
          });
        }
      });
    }

    // Fallback: check emptyInteractiveElements recorded in signals that are NOT standard buttons or links
    representation.accessibilitySignals.emptyInteractiveElements.forEach((item) => {
      if (buttonIds.has(item.elementId) || linkIds.has(item.elementId)) {
        // Skip: already captured by BUTTON_MISSING_NAME or LINK_MISSING_NAME
        return;
      }

      context.counter.value += 1;
      findings.push({
        id: `finding-${String(context.counter.value).padStart(3, '0')}`,
        ruleId: 'EMPTY_INTERACTIVE',
        category: 'OPERABILITY',
        severity: 'MEDIUM',
        title: 'Interactive control lacks content or accessible name',
        description: `Interactive <${item.tag}> element is empty and cannot be voiced by screen readers.`,
        affectedElementId: item.elementId,
        evidence: {
          tag: item.tag,
          elementId: item.elementId,
        },
        remediation: 'Ensure interactive elements contain descriptive visible text or an accessible name.',
        confidence: 1.0,
        deterministic: true,
      });
    });

    return findings;
  },
};
