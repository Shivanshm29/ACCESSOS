/**
 * ACCESSOS Completion Checker Domain Types (Phase 12)
 *
 * Strongly typed domain models for application completion verification.
 * Purely assistive verification system - NEVER performs browser mutations.
 */

export type CompletionStatus =
  | 'COMPLETE'
  | 'INCOMPLETE'
  | 'BLOCKED'
  | 'INVALID'
  | 'UNKNOWN'
  | 'COMPLETION_UNSUPPORTED'
  | 'INSUFFICIENT_STRUCTURED_REQUIREMENTS';

export type RequirementType =
  | 'REQUIRED_FIELD'
  | 'REQUIRED_DOCUMENT'
  | 'VALIDATION'
  | 'CONSISTENCY'
  | 'CONFIRMATION'
  | 'WORKFLOW_STAGE';

export type RequirementSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export type ConsistencyStatus =
  | 'CONSISTENT'
  | 'INCONSISTENT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NOT_APPLICABLE';

export interface CompletionRequirement {
  id: string;
  type: RequirementType;
  title: string;
  description: string;
  status: CompletionStatus;
  severity: RequirementSeverity;
  targetElementId?: string;
  relatedDocumentId?: string;
  stageId?: string;
  stageName?: string;
  reason: string;
  evidence?: string;
  suggestedNextStep: string;
  isBlocking: boolean;
  sensitive?: boolean;
}

export interface StageCompletionSummary {
  stageIndex: number;
  stageId: string;
  stageName: string;
  status: CompletionStatus;
  totalRequirements: number;
  completedRequirements: number;
  blockingIssuesCount: number;
  warningIssuesCount: number;
}

export interface ConsistencyCheckResult {
  ruleId: string;
  ruleName: string;
  status: ConsistencyStatus;
  fieldIds: string[];
  explanation: string;
  isBlocking: boolean;
}

export interface DocumentRequirementStatus {
  requirementId: string;
  documentType: string;
  title: string;
  matchStatus: string;
  documentId?: string;
  documentName?: string;
  confidence?: number;
  evidence?: string;
  reason: string;
  suggestedNextStep: string;
  isSatisfied: boolean;
  isBlocking: boolean;
}

export interface CompletionResult {
  overallStatus: CompletionStatus;
  completionPercent: number;
  currentStageIndex: number;
  currentStageName: string;
  blockingIssues: CompletionRequirement[];
  warnings: CompletionRequirement[];
  completedRequirements: CompletionRequirement[];
  remainingRequirements: CompletionRequirement[];
  stageSummaries: StageCompletionSummary[];
  documentRequirements: DocumentRequirementStatus[];
  consistencyChecks: ConsistencyCheckResult[];
  timestamp: number;
  evaluatedFieldCount: number;
  evaluatedDocumentCount: number;
}

export interface PortalStageDefinition {
  index: number;
  id: string;
  name: string;
  step: number;
}
