/**
 * ACCESSOS Phase 7 Explain Anything Types
 * Contracts matching backend Pydantic schemas.
 */

export type ExplanationMode =
  | 'SIMPLE'
  | 'DETAILED'
  | 'PLAIN_LANGUAGE'
  | 'EXAMPLE'
  | 'KEY_POINTS';

export interface ExplainSelectionContext {
  pageTitle?: string;
  sectionHeading?: string;
  targetElementId?: string;
  contextBefore?: string;
  contextAfter?: string;
  elementRole?: string;
}

export interface ExplainAnythingRequest {
  selectedText: string;
  context?: ExplainSelectionContext;
  mode?: ExplanationMode;
  userGoal?: string;
}

export interface TermDefinition {
  term: string;
  definition: string;
}

export interface ExplainAnythingResponse {
  explanation: string;
  whyItMatters?: string;
  keyPoints?: string[];
  terminology?: TermDefinition[];
  example?: string;
  confidence?: number;
  sourceSummary?: string;
  warnings?: string[];
  mode?: ExplanationMode;
  provider?: string;
  model?: string;
  durationMs?: number;
  fallbackUsed?: boolean;
}
