/**
 * ACCESSOS Safe Interaction Engine Types (Phase 8).
 * Strongly-typed contracts for atomic browser interactions, safety policies,
 * confirmation criteria, and execution results.
 */

export type ActionType =
  | 'FOCUS'
  | 'TYPE'
  | 'SELECT_OPTION'
  | 'TOGGLE_CHECKBOX'
  | 'HIGHLIGHT'
  | 'CLEAR_HIGHLIGHT';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

export type IntentSource = 'USER' | 'GUIDED_MODE' | 'AI_SUGGESTION';

export type ValueSource = 'USER_EXPLICIT' | 'AI_GENERATED' | 'NONE';

export type InteractionStatus =
  | 'SUCCESS'
  | 'REJECTED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_INVALID'
  | 'NOT_ALLOWED'
  | 'ERROR';

export interface InteractionIntent {
  actionId: string;
  actionType: ActionType;
  targetElementId: string;
  value?: string;
  valueSource?: ValueSource;
  optionValue?: string;
  checked?: boolean;
  reason?: string;
  riskLevel?: RiskLevel;
  requiresConfirmation?: boolean;
  source?: IntentSource;
}

export interface InteractionResult {
  actionId: string;
  status: InteractionStatus;
  actionType: ActionType;
  targetElementId: string;
  message: string;
  changed: boolean;
  blockedReason?: string;
  requiresConfirmation?: boolean;
  timestamp: number;
}

export interface PolicyEvaluation {
  allowed: boolean;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  blockedReason?: string;
}

export interface TargetValidationResult {
  valid: boolean;
  element: HTMLElement | null;
  errorStatus?: InteractionStatus;
  message?: string;
  tagName?: string;
  inputType?: string;
}

export interface ValidatedExecutionCommand {
  readonly commandToken: string;
  readonly actionId: string;
  readonly actionType: ActionType;
  readonly targetElementId: string;
  readonly targetElement: HTMLElement;
  readonly value?: string;
  readonly valueSource?: ValueSource;
  readonly optionValue?: string;
  readonly checked?: boolean;
  readonly reason?: string;
  readonly riskLevel: RiskLevel;
  readonly requiresConfirmation: boolean;
  readonly confirmed: boolean;
  readonly timestamp: number;
}

export interface PrepareCommandResult {
  valid: boolean;
  command?: ValidatedExecutionCommand;
  errorStatus?: InteractionStatus;
  blockedReason?: string;
  message?: string;
}
