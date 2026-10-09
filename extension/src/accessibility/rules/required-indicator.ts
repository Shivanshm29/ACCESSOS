/**
 * Rule 12: REQUIRED_FIELD_INDICATION
 * Detects programmatically required fields where no visible indication or explanatory text is provided.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const RequiredFieldIndicationRule: AccessibilityRule = {
  id: 'REQUIRED_FIELD_INDICATION',
  title: 'Required field lacks clear visible indication',
  category: 'FORMS',
  severity: 'LOW',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    const requiredIndicatorPattern = /(\*|required|mandatory)/i;

    representation.fields.forEach((field) => {
      if (!field.required) {
        return;
      }

      // 1. Check label text for * or 'required'
      const labelHasIndicator = Boolean(field.label && requiredIndicatorPattern.test(field.label));

      // 2. Check DOM label if context.doc is present
      let domHasIndicator = false;
      if (context.doc && field.elementId) {
        const labelEl = context.doc.querySelector(`label[for="${field.elementId}"]`);
        if (labelEl) {
          const rawLabel = labelEl.textContent || '';
          const hasStarClass = labelEl.querySelector('.req-star, .required, [aria-hidden="true"]') !== null;
          if (requiredIndicatorPattern.test(rawLabel) || hasStarClass) {
            domHasIndicator = true;
          }
        }
      }

      // 3. Check placeholder / description
      const descHasIndicator = Boolean(
        (field.placeholder && requiredIndicatorPattern.test(field.placeholder)) ||
        (field.description && requiredIndicatorPattern.test(field.description))
      );

      const hasVisibleIndication = labelHasIndicator || domHasIndicator || descHasIndicator;

      if (!hasVisibleIndication) {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'REQUIRED_FIELD_INDICATION',
          category: 'FORMS',
          severity: 'LOW',
          title: 'Required field lacks clear visible indicator',
          description: `The field '${field.name || field.id}' is programmatically required but lacks a discernible visual marker (such as '*' or '(required)').`,
          affectedElementId: field.id,
          evidence: {
            fieldId: field.id,
            fieldName: field.name,
            label: field.label,
            requiredSource: field.requiredSource,
            hasVisibleIndicator: false,
          },
          remediation: 'Add a clear visible indicator (e.g. an asterisk * or "(required)") next to the field label so users know it is mandatory before submitting.',
          confidence: 1.0,
          deterministic: true,
        });
      }
    });

    return findings;
  },
};
