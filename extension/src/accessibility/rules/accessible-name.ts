/**
 * Rules 3 & 4: BUTTON_MISSING_NAME and LINK_MISSING_NAME
 * Detects interactive buttons and links that lack accessible names.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const ButtonMissingNameRule: AccessibilityRule = {
  id: 'BUTTON_MISSING_NAME',
  title: 'Button has no accessible name',
  category: 'OPERABILITY',
  severity: 'HIGH',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    representation.buttons.forEach((btn) => {
      const hasText = Boolean(btn.text && btn.text.trim().length > 0);
      const hasAria = Boolean(btn.ariaLabel && btn.ariaLabel.trim().length > 0);

      if (!hasText && !hasAria) {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'BUTTON_MISSING_NAME',
          category: 'OPERABILITY',
          severity: 'HIGH',
          title: 'Button has no accessible name',
          description: 'This button does not have visible text or an aria-label, leaving its purpose undetectable for screen readers.',
          affectedElementId: btn.id,
          evidence: {
            buttonId: btn.id,
            buttonType: btn.type,
            text: btn.text || '',
            hasAriaLabel: hasAria,
          },
          remediation: 'Provide discernible visible text or an aria-label attribute clearly describing the action triggered by this button.',
          confidence: 1.0,
          deterministic: true,
        });
      }
    });

    return findings;
  },
};

export const LinkMissingNameRule: AccessibilityRule = {
  id: 'LINK_MISSING_NAME',
  title: 'Link has no accessible name',
  category: 'NAVIGATION',
  severity: 'MEDIUM',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    representation.links.forEach((link) => {
      const hasText = Boolean(link.text && link.text.trim().length > 0);
      const hasAria = Boolean(link.ariaLabel && link.ariaLabel.trim().length > 0);

      if (!hasText && !hasAria) {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'LINK_MISSING_NAME',
          category: 'NAVIGATION',
          severity: 'MEDIUM',
          title: 'Link has no accessible name',
          description: 'This link lacks descriptive anchor text or an accessible name, making its navigation destination ambiguous.',
          affectedElementId: link.id,
          evidence: {
            linkId: link.id,
            href: link.href,
            text: link.text || '',
            hasAriaLabel: hasAria,
          },
          remediation: 'Provide descriptive anchor text or an aria-label indicating the destination or action of this link.',
          confidence: 1.0,
          deterministic: true,
        });
      }
    });

    return findings;
  },
};
