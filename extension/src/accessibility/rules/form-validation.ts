/**
 * Rule 7: INVALID_FORM_CONTROL
 * Detects form fields currently marked with aria-invalid="true".
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const InvalidFormControlRule: AccessibilityRule = {
  id: 'INVALID_FORM_CONTROL',
  title: 'Form field currently contains an invalid value',
  category: 'VALIDATION',
  severity: 'MEDIUM',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    // Check fields recorded in PageRepresentation signals
    const invalidFieldIds = new Set(
      representation.accessibilitySignals.ariaInvalidFields.map((s) => s.fieldId)
    );

    // Also check DOM directly if context.doc is available
    if (context.doc) {
      const invalidDomElements = context.doc.querySelectorAll('[aria-invalid="true"]');
      invalidDomElements.forEach((el) => {
        const id = el.getAttribute('data-accessos-id');
        if (id) invalidFieldIds.add(id);
      });
    }

    invalidFieldIds.forEach((fieldId) => {
      const fieldInfo = representation.fields.find((f) => f.id === fieldId);
      context.counter.value += 1;
      findings.push({
        id: `finding-${String(context.counter.value).padStart(3, '0')}`,
        ruleId: 'INVALID_FORM_CONTROL',
        category: 'VALIDATION',
        severity: 'MEDIUM',
        title: 'Form field currently contains an invalid value',
        description: `The field '${fieldInfo?.name || fieldInfo?.label || fieldId}' is flagged with aria-invalid="true".`,
        affectedElementId: fieldId,
        evidence: {
          fieldId,
          fieldName: fieldInfo?.name,
          fieldLabel: fieldInfo?.label,
          fieldType: fieldInfo?.type,
          ariaInvalid: true,
        },
        remediation: 'Review the input requirement, correct invalid syntax or format, and re-submit the field.',
        confidence: 1.0,
        deterministic: true,
      });
    });

    return findings;
  },
};
