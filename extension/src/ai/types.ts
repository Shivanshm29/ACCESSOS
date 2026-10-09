/**
 * ACCESSOS Phase 5 AI Page Analysis Types
 * Strongly typed contracts matching backend Pydantic schemas.
 */

export type PageType =
  | 'INFORMATION'
  | 'APPLICATION'
  | 'REGISTRATION'
  | 'PAYMENT'
  | 'DOCUMENT_SUBMISSION'
  | 'TRACKING'
  | 'PROFILE'
  | 'OTHER';

export type AIBarrierType =
  | 'LANGUAGE_COMPLEXITY'
  | 'UNFAMILIAR_TERM'
  | 'AMBIGUOUS_INSTRUCTION'
  | 'COGNITIVE_LOAD'
  | 'PROCESS_COMPLEXITY'
  | 'INFORMATION_GROUPING'
  | 'REQUIREMENT_CLARITY'
  | 'NEXT_ACTION_UNCLEAR'
  | 'OTHER';

export type AISeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PageUnderstanding {
  pageType: PageType;
  pagePurpose: string;
  confidence: number;
}

export interface ProcessUnderstanding {
  processName: string;
  goal: string;
  currentStage?: string;
  totalStages?: number;
  majorStages: string[];
  requiredInformationCategories: string[];
  requiredDocumentCategories: string[];
  likelyNextAction: string;
}

export interface AIBarrierFinding {
  id: string;
  type: AIBarrierType;
  severity: AISeverity;
  title: string;
  explanation: string;
  evidence: Array<Record<string, unknown>>;
  affectedElementIds: string[];
  suggestedSimplification: string;
  confidence: number;
}

export interface NextAction {
  description: string;
  targetElementId?: string;
  stage?: string;
}

export interface AIPageAnalysisResponse {
  pageUnderstanding: PageUnderstanding;
  processUnderstanding: ProcessUnderstanding;
  barriers: AIBarrierFinding[];
  nextAction: NextAction;
  summary: string;
  provider: string;
  model: string;
  durationMs?: number;
  truncated: boolean;
  truncationNotes?: string[];
}

export interface AIPageAnalysisRequest {
  page: Record<string, unknown>;
  representation?: Record<string, unknown>;
  accessibilityReport?: Record<string, unknown>;
  userGoal?: string;
}
