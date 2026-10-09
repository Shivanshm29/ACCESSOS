/**
 * ACCESSOS Completion Checker Client (Phase 12)
 *
 * Calls the backend completion verification service or executes
 * deterministic local evaluation. Never mutates browser state.
 */

import type { PageRepresentation } from '../core/types/representation';
import type { CompletionResult } from './types';
import { evaluateCompletion, type DocumentMatchInput } from './checker';
import { getBackendUrl, DEFAULT_BACKEND_URL } from '../core/config';
export { DEFAULT_BACKEND_URL };

export interface CompletionEvaluatePayload {
  representation: PageRepresentation;
  formValues?: Record<string, unknown>;
  documentMatches?: DocumentMatchInput[];
  currentStageIndex?: number;
}

export async function requestCompletionEvaluation(
  payload: CompletionEvaluatePayload,
  backendUrl: string = getBackendUrl(),
  timeoutMs: number = 8000
): Promise<CompletionResult> {
  const url = `${backendUrl.replace(/\/$/, '')}/api/v1/completion/evaluate`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        representation: payload.representation,
        formValues: payload.formValues || {},
        documentMatches: payload.documentMatches || [],
        currentStageIndex: payload.currentStageIndex || 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        overallStatus: data.overall_status,
        completionPercent: data.completion_percent,
        currentStageIndex: data.current_stage_index,
        currentStageName: data.current_stage_name,
        blockingIssues: (data.blocking_issues || []).map((b: any) => ({
          id: b.id,
          type: b.type,
          title: b.title,
          description: b.description,
          status: b.status,
          severity: b.severity,
          targetElementId: b.target_element_id,
          relatedDocumentId: b.related_document_id,
          stageId: b.stage_id,
          stageName: b.stage_name,
          reason: b.reason,
          evidence: b.evidence,
          suggestedNextStep: b.suggested_next_step,
          isBlocking: b.is_blocking,
          sensitive: b.sensitive,
        })),
        warnings: (data.warnings || []).map((w: any) => ({
          id: w.id,
          type: w.type,
          title: w.title,
          description: w.description,
          status: w.status,
          severity: w.severity,
          targetElementId: w.target_element_id,
          relatedDocumentId: w.related_document_id,
          stageId: w.stage_id,
          stageName: w.stage_name,
          reason: w.reason,
          evidence: w.evidence,
          suggestedNextStep: w.suggested_next_step,
          isBlocking: w.is_blocking,
          sensitive: w.sensitive,
        })),
        completedRequirements: (data.completed_requirements || []).map((c: any) => ({
          id: c.id,
          type: c.type,
          title: c.title,
          description: c.description,
          status: c.status,
          severity: c.severity,
          targetElementId: c.target_element_id,
          relatedDocumentId: c.related_document_id,
          stageId: c.stage_id,
          stageName: c.stage_name,
          reason: c.reason,
          evidence: c.evidence,
          suggestedNextStep: c.suggested_next_step,
          isBlocking: c.is_blocking,
          sensitive: c.sensitive,
        })),
        remainingRequirements: (data.remaining_requirements || []).map((r: any) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          description: r.description,
          status: r.status,
          severity: r.severity,
          targetElementId: r.target_element_id,
          relatedDocumentId: r.related_document_id,
          stageId: r.stage_id,
          stageName: r.stage_name,
          reason: r.reason,
          evidence: r.evidence,
          suggestedNextStep: r.suggested_next_step,
          isBlocking: r.is_blocking,
          sensitive: r.sensitive,
        })),
        stageSummaries: (data.stage_summaries || []).map((s: any) => ({
          stageIndex: s.stage_index,
          stageId: s.stage_id,
          stageName: s.stage_name,
          status: s.status,
          totalRequirements: s.total_requirements,
          completedRequirements: s.completed_requirements,
          blockingIssuesCount: s.blocking_issues_count,
          warningIssuesCount: s.warning_issues_count,
        })),
        documentRequirements: (data.document_requirements || []).map((d: any) => ({
          requirementId: d.requirement_id,
          documentType: d.document_type,
          title: d.title,
          matchStatus: d.match_status,
          documentId: d.document_id,
          documentName: d.document_name,
          confidence: d.confidence,
          evidence: d.evidence,
          reason: d.reason,
          suggestedNextStep: d.suggested_next_step,
          isSatisfied: d.is_satisfied,
          isBlocking: d.is_blocking,
        })),
        consistencyChecks: (data.consistency_checks || []).map((k: any) => ({
          ruleId: k.rule_id,
          ruleName: k.rule_name,
          status: k.status,
          fieldIds: k.field_ids,
          explanation: k.explanation,
          isBlocking: k.is_blocking,
        })),
        timestamp: data.timestamp || Date.now(),
        evaluatedFieldCount: data.evaluated_field_count || 0,
        evaluatedDocumentCount: data.evaluated_document_count || 0,
      };
    }
  } catch {
    // Graceful fallback to deterministic local engine
  }

  // Authoritative deterministic local fallback
  return evaluateCompletion(
    payload.representation,
    payload.formValues,
    payload.documentMatches,
    payload.currentStageIndex
  );
}
