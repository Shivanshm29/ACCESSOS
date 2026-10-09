/**
 * ACCESSOS Security Types & Data Classifications (Phase 11)
 */

export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  PERSONAL = 'PERSONAL',
  SENSITIVE = 'SENSITIVE',
  HIGHLY_SENSITIVE = 'HIGHLY_SENSITIVE',
}

export enum SecurityErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  POLICY_BLOCKED = 'POLICY_BLOCKED',
  SENSITIVE_DATA_BLOCKED = 'SENSITIVE_DATA_BLOCKED',
  UNSUPPORTED_CONTENT = 'UNSUPPORTED_CONTENT',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PROMPT_INJECTION_DETECTED = 'PROMPT_INJECTION_DETECTED',
  UNAUTHORIZED_DESTINATION = 'UNAUTHORIZED_DESTINATION',
  SCHEMA_VIOLATION = 'SCHEMA_VIOLATION',
}

export interface SecurityAuditEvent {
  eventId: string;
  timestamp: number;
  eventName: string;
  feature: string;
  success: boolean;
  reason?: string;
  durationMs?: number;
}

export interface SecurityValidationResult {
  valid: boolean;
  sanitized?: unknown;
  errorCode?: SecurityErrorCode;
  error?: string;
  blockedReasons?: string[];
}

export interface NetworkDestination {
  name: string;
  host: string;
  purpose: string;
  isAllowlisted: boolean;
}
