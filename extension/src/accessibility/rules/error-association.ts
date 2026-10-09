/**
 * Rule 8: ERROR_ASSOCIATION
 * Detects validation error messages that are not programmatically associated with their corresponding form controls.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const ErrorAssociationRule: AccessibilityRule = {
  id: 'ERROR_ASSOCIATION',
  title: 'Validation error is not programmatically associated with form field',
  category: 'VALIDATION',
  severity: 'MEDIUM',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    // Check visible errors in representation
    const errorsToCheck = [...representation.errors];

    // If context.doc is present, also check for visible error elements
    if (context.doc) {
      const domErrorElements = context.doc.querySelectorAll(
        '.field-error-message.visible, .error-message:not(.hidden), [role="alert"]:not([style*="display: none"])'
      );
      domErrorElements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && !errorsToCheck.some((e) => e.text === text)) {
          errorsToCheck.push({
            id: el.getAttribute('id') || el.getAttribute('data-accessos-id') || `err-${Math.random().toString(36).slice(2, 7)}`,
            text,
            source: 'error-class',
            fieldId: undefined,
          });
        }
      });
    }

    errorsToCheck.forEach((error) => {
      // Check if any field references this error by ID via aria-describedby or aria-errormessage
      const hasFieldAriaAssociation = representation.fields.some((field) => {
        if (!field.ariaDescribedBy) return false;
        const ids = field.ariaDescribedBy.split(/\s+/);
        return ids.includes(error.id);
      });

      // Also check context.doc for aria-describedby or aria-errormessage
      let docHasAssociation = false;
      if (context.doc && error.id) {
        const associatedControl = context.doc.querySelector(
          `[aria-describedby~="${error.id}"], [aria-errormessage="${error.id}"]`
        );
        if (associatedControl) docHasAssociation = true;
      }

      if (!hasFieldAriaAssociation && !docHasAssociation) {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'ERROR_ASSOCIATION',
          category: 'VALIDATION',
          severity: 'MEDIUM',
          title: 'Validation error message lacks programmatic association',
          description: `The error message "${error.text.slice(0, 80)}" is displayed visually but not programmatically linked to a form control via aria-describedby or aria-errormessage.`,
          affectedElementId: error.fieldId || undefined,
          evidence: {
            errorId: error.id,
            errorText: error.text,
            hasProgrammaticAssociation: false,
          },
          remediation: 'Link the error message element to its corresponding input using aria-describedby="[error-element-id]" or aria-errormessage.',
          confidence: 1.0,
          deterministic: true,
        });
      }
    });

    return findings;
  },
};
