/**
 * ACCESSOS Page Requirement Extractor (Phase 9)
 *
 * Extracts document requirements and expected verification facts from
 * the existing PageRepresentation.
 */

import type { PageRepresentation } from '../core/types/index';
import type { DocumentType, PageRequirement } from './types';

function inferExpectedDocType(text: string): DocumentType | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('income')) return 'INCOME_CERTIFICATE';
  if (lower.includes('marksheet') || lower.includes('academic') || lower.includes('transcript')) {
    return 'ACADEMIC_MARKSHEET';
  }
  if (lower.includes('domicile') || lower.includes('residence')) return 'DOMICILE_CERTIFICATE';
  if (lower.includes('bank') || lower.includes('passbook') || lower.includes('cheque')) {
    return 'BANK_DOCUMENT';
  }
  if (lower.includes('identity') || lower.includes('aadhaar') || lower.includes('voter') || lower.includes('passport')) {
    return 'IDENTITY_DOCUMENT';
  }
  if (lower.includes('declaration') || lower.includes('affirm') || lower.includes('undertaking')) {
    return 'DECLARATION';
  }
  return undefined;
}

export function extractPageRequirements(pageRep: PageRepresentation, doc?: Document): PageRequirement[] {
  const requirements: PageRequirement[] = [];
  const activeDoc = doc || (typeof document !== 'undefined' ? document : undefined);

  // Extract expected values from existing fields (e.g., candidate name, state)
  const expectedValues: Record<string, string> = {};
  for (const field of pageRep.fields) {
    const domId = field.elementId || field.id || '';
    const fieldIdLower = domId.toLowerCase();
    const labelLower = (field.label || '').toLowerCase();

    if (
      (fieldIdLower.includes('name') || labelLower.includes('name')) &&
      !fieldIdLower.includes('bank') &&
      !labelLower.includes('bank') &&
      !fieldIdLower.includes('hostel')
    ) {
      if (activeDoc) {
        const el = (field.elementId ? activeDoc.getElementById(field.elementId) : null) ||
                   (field.id ? activeDoc.getElementById(field.id) : null) ||
                   (field.id ? activeDoc.querySelector(`[data-accessos-id="${field.id}"]`) : null) as HTMLInputElement | null;
        if (el && (el as HTMLInputElement).value) {
          expectedValues.applicant_name = (el as HTMLInputElement).value.trim();
        }
      }
    }
  }

  // Find all file upload fields
  for (const field of pageRep.fields) {
    if (field.type === 'file') {
      const targetDomId = field.elementId || field.id;
      const labelOrName = field.label || field.name || targetDomId || 'Supporting Document';
      const expectedType = inferExpectedDocType(`${labelOrName} ${field.elementId || ''} ${field.name || ''} ${field.id}`);

      requirements.push({
        requirementId: `req_${targetDomId || requirements.length + 1}`,
        targetFieldId: targetDomId,
        requirementType: 'FILE_UPLOAD',
        description: labelOrName,
        mandatory: field.required ?? true,
        expectedDocumentType: expectedType,
        expectedValues: Object.keys(expectedValues).length > 0 ? expectedValues : undefined,
      });
    }
  }

  return requirements;
}
