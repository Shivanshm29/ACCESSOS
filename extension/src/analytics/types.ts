/**
 * ACCESSOS Analytics Types (Phase 13)
 *
 * Defines strongly typed models, enums, and bounds for privacy-preserving local analytics.
 */

export enum AnalyticsEventType {
  ACCESSIBILITY_ANALYSIS = 'ACCESSIBILITY_ANALYSIS',
  AI_ANALYSIS = 'AI_ANALYSIS',
  GUIDED_MODE_STARTED = 'GUIDED_MODE_STARTED',
  GUIDED_STEP_COMPLETED = 'GUIDED_STEP_COMPLETED',
  GUIDED_MODE_COMPLETED = 'GUIDED_MODE_COMPLETED',
  EXPLANATION_REQUESTED = 'EXPLANATION_REQUESTED',
  DOCUMENT_ANALYSIS = 'DOCUMENT_ANALYSIS',
  DOCUMENT_REQUIREMENT_MATCH = 'DOCUMENT_REQUIREMENT_MATCH',
  COMPLETION_CHECK = 'COMPLETION_CHECK',
  COMPLETION_ACHIEVED = 'COMPLETION_ACHIEVED',
  COMPLETION_BLOCKED = 'COMPLETION_BLOCKED',
  SAFE_INTERACTION_CONFIRMED = 'SAFE_INTERACTION_CONFIRMED',
  SAFE_INTERACTION_BLOCKED = 'SAFE_INTERACTION_BLOCKED',
  USER_EXITED_FEATURE = 'USER_EXITED_FEATURE',
  ERROR = 'ERROR',
}

export type DurationBucket = '<1s' | '1-5s' | '5-15s' | '15-30s' | '30-60s' | '>60s';

export type CoarseResultCategory =
  | 'COMPLETE'
  | 'INCOMPLETE'
  | 'BLOCKED'
  | 'INVALID'
  | 'MATCH'
  | 'PARTIAL_MATCH'
  | 'NO_MATCH'
  | 'AMBIGUOUS'
  | 'NOT_ENOUGH_EVIDENCE'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'SUCCESS'
  | 'SKIPPED'
  | 'EXHAUSTED'
  | 'ERROR';

export type CoarseErrorCategory =
  | 'INVALID_INPUT'
  | 'POLICY_BLOCKED'
  | 'SCHEMA_VIOLATION'
  | 'TARGET_NOT_FOUND'
  | 'NETWORK_BLOCKED'
  | 'AI_PROVIDER_ERROR'
  | 'DOCUMENT_PARSE_ERROR'
  | 'COMPLETION_ERROR'
  | 'UNKNOWN_ERROR';

export type FeatureCategory =
  | 'accessibility'
  | 'ai'
  | 'guided'
  | 'explain'
  | 'document'
  | 'completion'
  | 'interaction'
  | 'preferences'
  | 'system';

export type AnonymizedTargetCategory =
  | 'input'
  | 'button'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file_upload'
  | 'link'
  | 'heading'
  | 'section'
  | 'dialog'
  | 'form'
  | 'unknown';

export interface AnalyticsEvent {
  eventId: string;
  eventType: AnalyticsEventType;
  timestamp: number;
  sessionId: string;
  feature: FeatureCategory;
  durationBucket?: DurationBucket;
  success: boolean;
  coarseResultCategory?: CoarseResultCategory;
  stageId?: string;
  anonymizedTargetCategory?: AnonymizedTargetCategory;
  countMetrics?: Record<string, number>;
  errorCode?: CoarseErrorCategory;
  version: number;
}

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType;
  feature: FeatureCategory;
  durationMs?: number;
  success: boolean;
  coarseResultCategory?: CoarseResultCategory;
  stageId?: string;
  anonymizedTargetCategory?: AnonymizedTargetCategory;
  countMetrics?: Record<string, number>;
  errorCode?: CoarseErrorCategory;
}

export interface AnalyticsSession {
  sessionId: string;
  startedAt: number;
  lastActiveAt: number;
  eventCount: number;
}

export interface AccessibilityAggregates {
  analyses: number;
  barriers: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  totalBarriers: number;
  pagesWithBarriers: number;
  scoreSum: number;
  scoreCount: number;
  averageScore: number;
}

export interface GuidedModeAggregates {
  started: number;
  completed: number;
  stepsCompleted: number;
  stepsSkipped: number;
  stepsExited: number;
  completionRate: number;
}

export interface ExplainAnythingAggregates {
  requests: number;
  modes: {
    SIMPLE: number;
    STANDARD: number;
    DETAILED: number;
  };
  completed: number;
  exited: number;
}

export interface DocumentAggregates {
  analyzed: number;
  matches: number;
  partialMatches: number;
  noMatches: number;
  ambiguous: number;
  notEnoughEvidence: number;
  successful: number;
  failed: number;
}

export interface CompletionAggregates {
  checks: number;
  complete: number;
  incomplete: number;
  blocked: number;
  invalid: number;
  totalBlockers: number;
  totalWarnings: number;
  checksBeforeCompletion: number;
  progressBuckets: {
    '0-25%': number;
    '26-50%': number;
    '51-75%': number;
    '76-99%': number;
    '100%': number;
  };
}

export interface InteractionAggregates {
  requested: number;
  confirmed: number;
  blocked: number;
  cancelled: number;
  byAction: {
    CLICK: number;
    INPUT: number;
    SELECT: number;
    HIGHLIGHT: number;
    OTHER: number;
  };
}

export interface AnalyticsAggregates {
  accessibility: AccessibilityAggregates;
  guidedMode: GuidedModeAggregates;
  explainAnything: ExplainAnythingAggregates;
  documents: DocumentAggregates;
  completion: CompletionAggregates;
  interactions: InteractionAggregates;
  durationBuckets: Record<DurationBucket, number>;
  errors: Record<string, number>;
  totalEvents: number;
  lastUpdated: number;
}

export interface AnalyticsValidationResult {
  valid: boolean;
  sanitized?: AnalyticsEvent;
  error?: string;
}

export interface AnalyticsExportPayload {
  session: AnalyticsSession;
  aggregates: AnalyticsAggregates;
  recentEvents: AnalyticsEvent[];
  schemaVersion: number;
  exportedAt: number;
}
