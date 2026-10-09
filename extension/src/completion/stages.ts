/**
 * ACCESSOS Stage Completion Calculator (Phase 12)
 *
 * Deterministically computes per-stage completion summaries
 * across the 8-stage portal workflow without mutating state.
 */

import { PORTAL_STAGES } from './constants';
import type {
  CompletionRequirement,
  StageCompletionSummary,
  PortalStageDefinition,
  CompletionStatus,
} from './types';

export function evaluateStageSummaries(
  requirements: CompletionRequirement[],
  customStages?: PortalStageDefinition[]
): StageCompletionSummary[] {
  const stages = customStages || PORTAL_STAGES;
  const summaries: StageCompletionSummary[] = [];

  for (const stage of stages) {
    const stageReqs = requirements.filter((r) => r.stageId === stage.id);
    const totalReqs = stageReqs.length;
    const completedReqs = stageReqs.filter((r) => r.status === 'COMPLETE').length;
    const blockingCount = stageReqs.filter(
      (r) => r.isBlocking && r.status !== 'COMPLETE'
    ).length;
    const warningCount = stageReqs.filter(
      (r) => !r.isBlocking && r.status !== 'COMPLETE'
    ).length;

    let status: CompletionStatus = 'INCOMPLETE';
    if (totalReqs === 0) {
      status = 'COMPLETE';
    } else if (blockingCount > 0) {
      status = 'INCOMPLETE';
    } else if (completedReqs === totalReqs) {
      status = 'COMPLETE';
    } else {
      status = 'INCOMPLETE';
    }

    summaries.push({
      stageIndex: stage.index,
      stageId: stage.id,
      stageName: stage.name,
      status,
      totalRequirements: totalReqs,
      completedRequirements: completedReqs,
      blockingIssuesCount: blockingCount,
      warningIssuesCount: warningCount,
    });
  }

  return summaries;
}
