/**
 * ACCESSOS Phase 6 Guided Mode Types
 * Strongly typed contracts matching backend Pydantic schemas.
 */

export type ActionType =
  | 'REVIEW'
  | 'READ'
  | 'ENTER'
  | 'SELECT'
  | 'UPLOAD'
  | 'CONFIRM'
  | 'SUBMIT_REVIEW';

export interface GuidedStep {
  stepId: string;
  order: number;
  title: string;
  description: string;
  targetElementId?: string;
  actionType: ActionType;
  whyItMatters: string;
  required: boolean;
  completed: boolean;
  barrierNote?: string;
}

export interface GuidedModeResponse {
  title: string;
  overview: string;
  currentStage: string;
  totalStages: number;
  progressPercent: number;
  steps: GuidedStep[];
  warnings: string[];
  completionMessage?: string;
  provider: string;
  model: string;
  durationMs?: number;
  fallbackUsed: boolean;
}

export interface GuidedModeStartRequest {
  page: Record<string, unknown>;
  representation?: Record<string, unknown>;
  accessibilityReport?: Record<string, unknown>;
  aiPageAnalysis?: Record<string, unknown>;
  userGoal?: string;
  targetStageIndex?: number;
}
