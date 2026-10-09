/**
 * Rule 1: FORM_MISSING_LABEL
 * Detects form controls that do not have an accessible label.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const FormMissingLabelRule: AccessibilityRule = {
  id: 'FORM_MISSING_LABEL',
  title: 'Form field has no accessible label',
  category: 'FORMS',
  severity: 'HIGH',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    representation.fields.forEach((field) => {
      // Exclude hidden fields and submit/button inputs
      if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') {
        return;
      }

      if (field.labelSource === 'none') {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'FORM_MISSING_LABEL',
          category: 'FORMS',
          severity: 'HIGH',
          title: 'Form field has no accessible label',
          description: `The '${field.type}' form control lacks an associated accessible name or label.`,
          affectedElementId: field.id,
          evidence: {
            elementId: field.id,
            domElementId: field.elementId,
            tag: field.tag,
            type: field.type,
            name: field.name,
            labelSource: 'none',
          },
          remediation: 'Associate an explicit <label for="..."> element, wrapping <label>, or aria-label attribute with this form control.',
          confidence: 1.0,
          deterministic: true,
        });
      }
    });

    return findings;
  },
};
