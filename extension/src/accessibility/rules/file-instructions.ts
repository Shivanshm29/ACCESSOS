/**
 * Rule 11: FILE_INSTRUCTION_ASSOCIATION
 * Detects file upload requirements where instructions/guidelines are present on the page
 * but not programmatically associated with the file input.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const FileInstructionAssociationRule: AccessibilityRule = {
  id: 'FILE_INSTRUCTION_ASSOCIATION',
  title: 'File upload field lacks programmatic association with document guidelines',
  category: 'COGNITIVE_LOAD',
  severity: 'LOW',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const fileFields = representation.fields.filter((f) => f.type === 'file');

    if (fileFields.length === 0) {
      return findings;
    }

    // Check if any instructions exist in the representation
    const hasInstructions = representation.instructions.length > 0;

    // Also check DOM for document guidelines panels
    const hasDocSpecsInDom = context.doc
      ? context.doc.querySelector('.document-spec-panel, .spec-list, .upload-guidelines') !== null
      : false;

    if (!hasInstructions && !hasDocSpecsInDom) {
      return findings;
    }

    fileFields.forEach((fileField) => {
      // Check if file input has aria-describedby or an inline description
      const hasAriaDescribedBy = Boolean(fileField.ariaDescribedBy && fileField.ariaDescribedBy.trim().length > 0);
      const hasDirectDescription = Boolean(fileField.description && fileField.description.trim().length > 0);

      if (!hasAriaDescribedBy && !hasDirectDescription) {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'FILE_INSTRUCTION_ASSOCIATION',
          category: 'COGNITIVE_LOAD',
          severity: 'LOW',
          title: 'File upload field lacks programmatic link to upload constraints',
          description: `The file input '${fileField.name || fileField.id}' has guidelines on the page, but lacks an aria-describedby binding to programmatically convey file size or format rules.`,
          affectedElementId: fileField.id,
          evidence: {
            fieldId: fileField.id,
            fieldType: 'file',
            hasAriaDescribedBy: false,
            hasDirectDescription: false,
            sectionId: fileField.sectionId,
          },
          remediation: 'Associate upload guidelines, file format constraints, and size limits directly to the file input using aria-describedby.',
          confidence: 1.0,
          deterministic: true,
        });
      }
    });

    return findings;
  },
};
