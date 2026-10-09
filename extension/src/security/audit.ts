/**
 * ACCESSOS Privacy-Safe Audit Logger (Phase 11)
 * In-memory, non-surveillance, minimal operational audit events.
 */

import { type SecurityAuditEvent } from './types';
import { sanitizeText } from './sanitizer';

const MAX_AUDIT_LOG_ITEMS = 200;
const _AUDIT_BUFFER: SecurityAuditEvent[] = [];

export function recordSecurityEvent(
  eventName: string,
  feature: string,
  success: boolean,
  reason?: string,
  durationMs?: number,
): SecurityAuditEvent {
  // Sanitize reason to never leak sensitive content in audit log
  const sanitizedReason = reason ? sanitizeText(reason, 200) : undefined;

  const event: SecurityAuditEvent = {
    eventId: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    eventName: sanitizeText(eventName, 64),
    feature: sanitizeText(feature, 32),
    success,
    reason: sanitizedReason,
    durationMs: durationMs ? Math.max(0, Math.round(durationMs)) : undefined,
  };

  _AUDIT_BUFFER.push(event);
  if (_AUDIT_BUFFER.length > MAX_AUDIT_LOG_ITEMS) {
    _AUDIT_BUFFER.shift();
  }

  return event;
}

export function cleanForLogging(event: SecurityAuditEvent): Record<string, unknown> {
  return {
    eventId: event.eventId,
    timestamp: event.timestamp,
    eventName: event.eventName,
    feature: event.feature,
    success: event.success,
    reasonCategory: event.reason || 'NONE',
    durationMs: event.durationMs,
  };
}

export function getAuditLog(): SecurityAuditEvent[] {
  return [..._AUDIT_BUFFER];
}

export function clearAuditLog(): void {
  _AUDIT_BUFFER.length = 0;
}
