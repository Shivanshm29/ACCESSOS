/**
 * ACCESSOS Deterministic Completion Evaluator (Phase 12)
 *
 * Authoritative, non-mutating evaluation of workflow completion,
 * required fields, document evidence, validation errors, and cross-field consistency.
 *
 * CRITICAL RULE: NEVER mutates browser state. Phase 8 remains the only mutation authority.
 */

import type { PageRepresentation } from '../core/types/representation';
import type {
  CompletionResult,
  CompletionStatus,
  CompletionRequirement,
  RequirementSeverity,
  DocumentRequirementStatus,
  PortalStageDefinition,
} from './types';
import { PORTAL_STAGES } from './constants';
import { evaluateCrossFieldConsistency, type FieldValueRecord } from './consistency';
import { evaluateStageSummaries } from './stages';

export interface DocumentMatchInput {
  requirementId?: string;
  documentType?: string;
  title?: string;
  matchStatus?: string;
  documentId?: string;
  documentName?: string;
  confidence?: number;
  evidence?: string;
  reason?: string;
  filenameOnlyMatch?: boolean;
}

export function evaluateCompletion(
  pageRepresentation: PageRepresentation,
  formValues: Record<string, unknown> = {},
  documentMatches: DocumentMatchInput[] = [],
  currentStageIndex: number = 0,
  customStages?: PortalStageDefinition[]
): CompletionResult {
  const fields = pageRepresentation?.fields || [];
  const errors = pageRepresentation?.errors || [];
  const stages = customStages || PORTAL_STAGES;

  // If page lacks structured form fields and document requirements entirely, return unsupported status
  if (fields.length === 0 && !customStages && documentMatches.length === 0) {
    return {
      overallStatus: 'COMPLETION_UNSUPPORTED',
      completionPercent: 0,
      currentStageIndex: 0,
      currentStageName: '',
      blockingIssues: [],
      warnings: [],
      completedRequirements: [],
      remainingRequirements: [],
      stageSummaries: [],
      documentRequirements: [],
      consistencyChecks: [],
      timestamp: Date.now(),
      evaluatedFieldCount: 0,
      evaluatedDocumentCount: 0,
    };
  }

  // 1. Map errors by field ID
  const errorsByField: Record<string, string[]> = {};
  for (const err of errors) {
    const fid = err.fieldId;
    const text = err.text || 'Validation error';
    if (fid) {
      if (!errorsByField[fid]) errorsByField[fid] = [];
      errorsByField[fid].push(text);
    }
  }

  // 2. Build sanitized field map for consistency checking (NO sensitive credential values)
  const fieldsMap: Record<string, FieldValueRecord> = {};
  for (const f of fields) {
    const fid = f.id || f.name || '';
    const fname = f.name || fid;
    const isSensitive = Boolean(f.sensitive);

    // Read value safely
    const rawVal =
      fid in formValues
        ? formValues[fid]
        : fname in formValues
        ? formValues[fname]
        : f.hasValue
        ? '[POPULATED]'
        : null;

    // NEVER expose actual sensitive credential values in fieldsMap
    let safeVal: string | null = null;
    if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
      safeVal = isSensitive ? '[SENSITIVE_PRESENT]' : String(rawVal).trim();
    }

    fieldsMap[fname] = {
      id: fid,
      name: fname,
      value: safeVal,
      sensitive: isSensitive,
    };
  }

  const requirements: CompletionRequirement[] = [];
  let evaluatedFieldCount = 0;

  // 3. Evaluate Field Requirements
  for (const field of fields) {
    evaluatedFieldCount++;
    const fieldId = field.id || '';
    const fieldName = field.name || fieldId;
    const fieldLabel = field.label || fieldName || 'Required Field';
    const isRequired = Boolean(field.required);
    const isSensitive = Boolean(field.sensitive);
    const sectionId = field.sectionId;

    // Check if field has value (from formValues or field.hasValue)
    const providedVal =
      fieldId in formValues
        ? formValues[fieldId]
        : fieldName in formValues
        ? formValues[fieldName]
        : undefined;

    const hasVal =
      (providedVal !== undefined && providedVal !== null && String(providedVal).trim() !== '') ||
      Boolean(field.hasValue);

    const fieldErrors =
      errorsByField[fieldId] ||
      (field.elementId ? errorsByField[field.elementId] : undefined) ||
      errorsByField[fieldName] ||
      [];
    const reqId = `req-field-${fieldName}`;

    let status: CompletionStatus;
    let severity: RequirementSeverity;
    let reason: string;
    let nextStep: string;
    let isBlocking: boolean;

    if (fieldErrors.length > 0) {
      status = 'INVALID';
      severity = 'BLOCKING';
      reason = `Validation error: ${fieldErrors[0]}`;
      nextStep = `Correct the input in ${fieldLabel} to resolve the validation error.`;
      isBlocking = true;
    } else if (isRequired && !hasVal) {
      status = 'INCOMPLETE';
      severity = 'BLOCKING';
      reason = `Required field '${fieldLabel}' is missing or empty.`;
      nextStep = `Enter the required information in ${fieldLabel}.`;
      isBlocking = true;
    } else if (isRequired && hasVal) {
      status = 'COMPLETE';
      severity = 'INFO';
      reason = `Required field '${fieldLabel}' is populated.`;
      nextStep = `${fieldLabel} is complete.`;
      isBlocking = false;
    } else {
      // Optional field
      status = hasVal ? 'COMPLETE' : 'INCOMPLETE';
      severity = 'INFO';
      reason = `Optional field '${fieldLabel}' is ${hasVal ? 'populated' : 'not entered'}.`;
      nextStep = `Optionally complete ${fieldLabel}.`;
      isBlocking = false;
    }

    requirements.push({
      id: reqId,
      type: isRequired ? 'REQUIRED_FIELD' : 'VALIDATION',
      title: fieldLabel,
      description: `Field requirement for ${fieldLabel} in section ${sectionId || 'form'}.`,
      status,
      severity,
      targetElementId: fieldId,
      stageId: sectionId,
      reason,
      suggestedNextStep: nextStep,
      isBlocking,
      sensitive: isSensitive,
    });
  }

  // 4. Evaluate Document Requirements
  const docRequirementStatuses: DocumentRequirementStatus[] = [];
  let evaluatedDocCount = 0;

  for (const docMatch of documentMatches) {
    evaluatedDocCount++;
    const reqId = docMatch.requirementId || `doc-req-${evaluatedDocCount}`;
    const docType = docMatch.documentType || 'DOCUMENT';
    const title = docMatch.title || `${docType} Verification`;
    const matchStatus = docMatch.matchStatus || 'NO_MATCH';
    const docId = docMatch.documentId;
    const docName = docMatch.documentName;
    const confidence = docMatch.confidence;
    const evidence = docMatch.evidence;

    // Filename alone CANNOT satisfy document requirement
    const filenameOnly = Boolean(docMatch.filenameOnlyMatch);

    let status: CompletionStatus;
    let isSatisfied = false;
    let isBlocking = true;
    let reason: string;
    let nextStep: string;

    if (matchStatus === 'MATCH' && !filenameOnly) {
      status = 'COMPLETE';
      isSatisfied = true;
      isBlocking = false;
      reason = `Document evidence matches requirement for ${title}.`;
      nextStep = `${title} verification complete.`;
    } else if (matchStatus === 'PARTIAL_MATCH') {
      status = 'INCOMPLETE';
      isSatisfied = false;
      isBlocking = true;
      reason = `Document partially matches requirement for ${title}. Missing complete evidence.`;
      nextStep = `Review document ${docName || title} and provide a full certificate.`;
    } else if (matchStatus === 'AMBIGUOUS') {
      status = 'BLOCKED';
      isSatisfied = false;
      isBlocking = true;
      reason = `Document evidence for ${title} is ambiguous and requires human verification.`;
      nextStep = `Review ambiguous evidence in ${docName || title} and re-upload if needed.`;
    } else if (matchStatus === 'NOT_ENOUGH_EVIDENCE' || filenameOnly) {
      status = 'INCOMPLETE';
      isSatisfied = false;
      isBlocking = true;
      reason = `Insufficient evidence in document to satisfy requirement for ${title}.`;
      nextStep = `Provide a complete, legible copy of ${title}.`;
    } else {
      status = 'BLOCKED';
      isSatisfied = false;
      isBlocking = true;
      reason = `No matching document provided for required ${title}.`;
      nextStep = `Select and provide the required document for ${title}.`;
    }

    docRequirementStatuses.push({
      requirementId: reqId,
      documentType: docType,
      title,
      matchStatus,
      documentId: docId,
      documentName: docName,
      confidence,
      evidence,
      reason,
      suggestedNextStep: nextStep,
      isSatisfied,
      isBlocking,
    });

    requirements.push({
      id: `req-doc-${reqId}`,
      type: 'REQUIRED_DOCUMENT',
      title,
      description: `Supporting document requirement for ${title}.`,
      status,
      severity: isBlocking ? 'BLOCKING' : 'INFO',
      relatedDocumentId: docId,
      stageId: 'sec-documents',
      reason,
      evidence,
      suggestedNextStep: nextStep,
      isBlocking,
    });
  }

  // 5. Evaluate Cross-Field Consistency Checks
  const consistencyResults = evaluateCrossFieldConsistency(fieldsMap);
  for (const cRes of consistencyResults) {
    if (cRes.status === 'INCONSISTENT') {
      requirements.push({
        id: `req-cons-${cRes.ruleId}`,
        type: 'CONSISTENCY',
        title: cRes.ruleName,
        description: cRes.explanation,
        status: cRes.isBlocking ? 'INVALID' : 'INCOMPLETE',
        severity: cRes.isBlocking ? 'BLOCKING' : 'WARNING',
        targetElementId: cRes.fieldIds[0],
        reason: cRes.explanation,
        suggestedNextStep: 'Align the inconsistent fields before proceeding.',
        isBlocking: cRes.isBlocking,
      });
    }
  }

  // 6. Partition Requirements
  const blockingIssues = requirements.filter(
    (r) => r.isBlocking && r.status !== 'COMPLETE'
  );
  const warnings = requirements.filter(
    (r) => !r.isBlocking && r.status !== 'COMPLETE'
  );
  const completedReqs = requirements.filter((r) => r.status === 'COMPLETE');
  const remainingReqs = requirements.filter((r) => r.status !== 'COMPLETE');

  // 7. Deterministic Overall Status Calculation
  let overallStatus: CompletionStatus;
  if (blockingIssues.some((r) => r.status === 'INVALID')) {
    overallStatus = 'INVALID';
  } else if (blockingIssues.some((r) => r.status === 'BLOCKED')) {
    overallStatus = 'BLOCKED';
  } else if (blockingIssues.length > 0) {
    overallStatus = 'INCOMPLETE';
  } else {
    overallStatus = 'COMPLETE';
  }

  const totalCount = requirements.length;
  const completedCount = completedReqs.length;
  const completionPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  // 8. Stage Summaries
  const stageSummaries = evaluateStageSummaries(requirements, stages);
  const currentStageName =
    stages[currentStageIndex]?.name ||
    stages.find((s) => s.index === currentStageIndex)?.name ||
    '';

  return {
    overallStatus,
    completionPercent,
    currentStageIndex,
    currentStageName,
    blockingIssues,
    warnings,
    completedRequirements: completedReqs,
    remainingRequirements: remainingReqs,
    stageSummaries,
    documentRequirements: docRequirementStatuses,
    consistencyChecks: consistencyResults,
    timestamp: Date.now(),
    evaluatedFieldCount,
    evaluatedDocumentCount: evaluatedDocCount,
  };
}
