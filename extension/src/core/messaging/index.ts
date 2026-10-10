/**
 * ACCESSOS Messaging Contracts
 * Type-safe message passing abstractions between background, content, and UI components.
 */
import type { PageMetadata, PageRepresentation } from '../types/index';
import type { AccessibilityReport } from '../../accessibility/types';
import type { InteractionIntent, InteractionResult } from '../../interaction/types';
import type { CompletionResult } from '../../completion/types';
import type {
  AnalyticsAggregates,
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsSession,
} from '../../analytics/types';
import type { ProfileFieldMapping, ApplyProfileResult } from '../../profile/types';

export enum MessageType {
  PING = 'PING',
  PONG = 'PONG',
  GET_STATE = 'GET_STATE',
  STATE_UPDATED = 'STATE_UPDATED',
  TOGGLE_ASSISTANT = 'TOGGLE_ASSISTANT',
  ANALYZE_PAGE = 'ANALYZE_PAGE',
  PAGE_ANALYSIS_RESULT = 'PAGE_ANALYSIS_RESULT',
  HIGHLIGHT_ELEMENT = 'HIGHLIGHT_ELEMENT',
  CLEAR_HIGHLIGHT = 'CLEAR_HIGHLIGHT',
  GET_SELECTION = 'GET_SELECTION',
  SELECTION_RESULT = 'SELECTION_RESULT',
  EXECUTE_INTERACTION = 'EXECUTE_INTERACTION',
  INTERACTION_RESULT = 'INTERACTION_RESULT',
  CHECK_COMPLETION = 'CHECK_COMPLETION',
  COMPLETION_RESULT = 'COMPLETION_RESULT',
  GET_ANALYTICS = 'GET_ANALYTICS',
  ANALYTICS_DATA = 'ANALYTICS_DATA',
  CLEAR_ANALYTICS = 'CLEAR_ANALYTICS',
  ANALYTICS_CLEARED = 'ANALYTICS_CLEARED',
  RECORD_ANALYTICS_EVENT = 'RECORD_ANALYTICS_EVENT',
  RESET_DEMO = 'RESET_DEMO',
  DEMO_RESET_RESULT = 'DEMO_RESET_RESULT',
  APPLY_PROFILE_FIELDS = 'APPLY_PROFILE_FIELDS',
  PROFILE_APPLIED_RESULT = 'PROFILE_APPLIED_RESULT',
}

export interface HighlightElementPayload {
  targetElementId: string;
}

export interface HighlightElementMessage extends BaseMessage<HighlightElementPayload> {
  type: MessageType.HIGHLIGHT_ELEMENT;
  payload: HighlightElementPayload;
}

export interface ClearHighlightMessage extends BaseMessage<void> {
  type: MessageType.CLEAR_HIGHLIGHT;
}

export interface SelectionContextPayload {
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  pageTitle?: string;
  sectionHeading?: string;
  targetElementId?: string;
  elementRole?: string;
}

export interface GetSelectionMessage extends BaseMessage<void> {
  type: MessageType.GET_SELECTION;
}

export interface SelectionResponsePayload {
  success: boolean;
  selection: SelectionContextPayload | null;
  error?: string;
}

export interface SelectionResultMessage extends BaseMessage<SelectionResponsePayload> {
  type: MessageType.SELECTION_RESULT;
  payload: SelectionResponsePayload;
}

export interface ExecuteInteractionMessage extends BaseMessage<InteractionIntent> {
  type: MessageType.EXECUTE_INTERACTION;
  payload: InteractionIntent;
}

export interface InteractionResultMessage extends BaseMessage<InteractionResult> {
  type: MessageType.INTERACTION_RESULT;
  payload: InteractionResult;
}

export interface CheckCompletionPayload {
  formValues?: Record<string, unknown>;
  documentMatches?: any[];
  currentStageIndex?: number;
}

export interface CheckCompletionMessage extends BaseMessage<CheckCompletionPayload> {
  type: MessageType.CHECK_COMPLETION;
  payload?: CheckCompletionPayload;
}

export interface CompletionResponsePayload {
  success: boolean;
  result?: CompletionResult;
  error?: string;
}

export interface CompletionResultMessage extends BaseMessage<CompletionResponsePayload> {
  type: MessageType.COMPLETION_RESULT;
  payload: CompletionResponsePayload;
}

export interface GetAnalyticsMessage extends BaseMessage<void> {
  type: MessageType.GET_ANALYTICS;
}

export interface AnalyticsDataPayload {
  success: boolean;
  aggregates?: AnalyticsAggregates;
  session?: AnalyticsSession;
  recentEvents?: AnalyticsEvent[];
  error?: string;
}

export interface AnalyticsDataMessage extends BaseMessage<AnalyticsDataPayload> {
  type: MessageType.ANALYTICS_DATA;
  payload: AnalyticsDataPayload;
}

export interface ClearAnalyticsMessage extends BaseMessage<void> {
  type: MessageType.CLEAR_ANALYTICS;
}

export interface AnalyticsClearedPayload {
  success: boolean;
}

export interface AnalyticsClearedMessage extends BaseMessage<AnalyticsClearedPayload> {
  type: MessageType.ANALYTICS_CLEARED;
  payload: AnalyticsClearedPayload;
}

export interface RecordAnalyticsMessage extends BaseMessage<AnalyticsEventInput> {
  type: MessageType.RECORD_ANALYTICS_EVENT;
  payload: AnalyticsEventInput;
}


export interface BaseMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  timestamp: number;
}

export interface PingMessage extends BaseMessage<void> {
  type: MessageType.PING;
}

export interface PongMessage extends BaseMessage<{ status: string }> {
  type: MessageType.PONG;
}

export interface AnalyzePageMessage extends BaseMessage<void> {
  type: MessageType.ANALYZE_PAGE;
}

export interface PageAnalysisSuccessPayload {
  success: true;
  metadata: PageMetadata;
  representation?: PageRepresentation;
  accessibilityReport?: AccessibilityReport;
}

export interface PageAnalysisErrorPayload {
  success: false;
  error: string;
}

export type PageAnalysisResponsePayload =
  | PageAnalysisSuccessPayload
  | PageAnalysisErrorPayload;

export interface PageAnalysisResultMessage extends BaseMessage<PageAnalysisResponsePayload> {
  type: MessageType.PAGE_ANALYSIS_RESULT;
  payload: PageAnalysisResponsePayload;
}

export function createMessage<T>(type: MessageType, payload?: T): BaseMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}

export function isAnalyzePageMessage(msg: unknown): msg is AnalyzePageMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.ANALYZE_PAGE
  );
}

export function isPageAnalysisResultMessage(msg: unknown): msg is PageAnalysisResultMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.PAGE_ANALYSIS_RESULT &&
    typeof (msg as PageAnalysisResultMessage).payload === 'object' &&
    (msg as PageAnalysisResultMessage).payload !== null
  );
}

export function isHighlightElementMessage(msg: unknown): msg is HighlightElementMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.HIGHLIGHT_ELEMENT &&
    typeof (msg as HighlightElementMessage).payload === 'object' &&
    typeof (msg as HighlightElementMessage).payload?.targetElementId === 'string'
  );
}

export function isClearHighlightMessage(msg: unknown): msg is ClearHighlightMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.CLEAR_HIGHLIGHT
  );
}

export function isGetSelectionMessage(msg: unknown): msg is GetSelectionMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.GET_SELECTION
  );
}

export function isSelectionResultMessage(msg: unknown): msg is SelectionResultMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.SELECTION_RESULT &&
    typeof (msg as SelectionResultMessage).payload === 'object' &&
    (msg as SelectionResultMessage).payload !== null &&
    typeof (msg as SelectionResultMessage).payload.success === 'boolean'
  );
}

export function isExecuteInteractionMessage(msg: unknown): msg is ExecuteInteractionMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.EXECUTE_INTERACTION &&
    typeof (msg as ExecuteInteractionMessage).payload === 'object' &&
    (msg as ExecuteInteractionMessage).payload !== null &&
    typeof (msg as ExecuteInteractionMessage).payload.targetElementId === 'string'
  );
}

export function isInteractionResultMessage(msg: unknown): msg is InteractionResultMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.INTERACTION_RESULT &&
    typeof (msg as InteractionResultMessage).payload === 'object' &&
    (msg as InteractionResultMessage).payload !== null &&
    typeof (msg as InteractionResultMessage).payload.status === 'string'
  );
}

export function isCheckCompletionMessage(msg: unknown): msg is CheckCompletionMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.CHECK_COMPLETION
  );
}

export function isCompletionResultMessage(msg: unknown): msg is CompletionResultMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.COMPLETION_RESULT &&
    typeof (msg as CompletionResultMessage).payload === 'object' &&
    (msg as CompletionResultMessage).payload !== null &&
    typeof (msg as CompletionResultMessage).payload.success === 'boolean'
  );
}

export function isGetAnalyticsMessage(msg: unknown): msg is GetAnalyticsMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.GET_ANALYTICS
  );
}

export function isAnalyticsDataMessage(msg: unknown): msg is AnalyticsDataMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.ANALYTICS_DATA &&
    typeof (msg as AnalyticsDataMessage).payload === 'object' &&
    (msg as AnalyticsDataMessage).payload !== null &&
    typeof (msg as AnalyticsDataMessage).payload.success === 'boolean'
  );
}

export function isClearAnalyticsMessage(msg: unknown): msg is ClearAnalyticsMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.CLEAR_ANALYTICS
  );
}

export function isRecordAnalyticsMessage(msg: unknown): msg is RecordAnalyticsMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.RECORD_ANALYTICS_EVENT &&
    typeof (msg as RecordAnalyticsMessage).payload === 'object' &&
    (msg as RecordAnalyticsMessage).payload !== null
  );
}

export interface ApplyProfileFieldsPayload {
  mappings: ProfileFieldMapping[];
}

export interface ApplyProfileFieldsMessage extends BaseMessage<ApplyProfileFieldsPayload> {
  type: MessageType.APPLY_PROFILE_FIELDS;
  payload: ApplyProfileFieldsPayload;
}

export interface ProfileAppliedResultMessage extends BaseMessage<ApplyProfileResult> {
  type: MessageType.PROFILE_APPLIED_RESULT;
  payload: ApplyProfileResult;
}

export function isApplyProfileFieldsMessage(msg: unknown): msg is ApplyProfileFieldsMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as BaseMessage).type === MessageType.APPLY_PROFILE_FIELDS &&
    typeof (msg as ApplyProfileFieldsMessage).payload === 'object' &&
    (msg as ApplyProfileFieldsMessage).payload !== null &&
    Array.isArray((msg as ApplyProfileFieldsMessage).payload.mappings)
  );
}


export function isKnownMessageType(type: string): boolean {
  return Object.values(MessageType).includes(type as MessageType);
}

export function validateMessageEnvelope(msg: unknown): { valid: boolean; error?: string } {
  if (!msg || typeof msg !== 'object') {
    return { valid: false, error: 'Message must be a non-null object' };
  }
  const record = msg as Record<string, unknown>;
  if (!('type' in record) || typeof record.type !== 'string') {
    return { valid: false, error: 'Message must contain a string type field' };
  }
  if (!isKnownMessageType(record.type)) {
    return { valid: false, error: `Unknown message type: ${record.type}` };
  }
  const serialized = JSON.stringify(msg);
  if (serialized.length > 524288) {
    return { valid: false, error: 'Message payload exceeds maximum size limit (512 KB)' };
  }
  if (serialized.includes('<script') || serialized.includes('javascript:') || serialized.includes('eval(')) {
    return { valid: false, error: 'Message contains forbidden executable script content' };
  }
  return { valid: true };
}


