/**
 * ACCESSOS Analytics Sanitizer (Phase 13)
 *
 * Enforces Phase 11 privacy invariants on all analytics events:
 * - Strips personal, sensitive, and highly sensitive data.
 * - Rejects raw document text, form values, passwords, OTPs, CVVs, bank accounts, Aadhaar/SSN.
 * - Enforces schema validation, payload bounds, and coarse categorizations.
 */

import {
  AnalyticsEventType,
  type AnalyticsEvent,
  type AnalyticsValidationResult,
  type AnonymizedTargetCategory,
  type CoarseErrorCategory,
  type CoarseResultCategory,
  type DurationBucket,
  type FeatureCategory,
} from './types';
import {
  ANALYTICS_SCHEMA_VERSION,
  MAX_ANALYTICS_EVENT_PAYLOAD_BYTES,
} from './constants';
import { classifyData, stripHtml } from '../security/sanitizer';
import { DataClassification } from '../security/types';

const ALLOWED_EVENT_TYPES = new Set<string>(Object.values(AnalyticsEventType));

const ALLOWED_FEATURES = new Set<FeatureCategory>([
  'accessibility',
  'ai',
  'guided',
  'explain',
  'document',
  'completion',
  'interaction',
  'preferences',
  'system',
]);

const ALLOWED_DURATION_BUCKETS = new Set<DurationBucket>([
  '<1s',
  '1-5s',
  '5-15s',
  '15-30s',
  '30-60s',
  '>60s',
]);

const ALLOWED_RESULT_CATEGORIES = new Set<CoarseResultCategory>([
  'COMPLETE',
  'INCOMPLETE',
  'BLOCKED',
  'INVALID',
  'MATCH',
  'PARTIAL_MATCH',
  'NO_MATCH',
  'AMBIGUOUS',
  'NOT_ENOUGH_EVIDENCE',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'SUCCESS',
  'SKIPPED',
  'EXHAUSTED',
  'ERROR',
]);

const ALLOWED_ERROR_CATEGORIES = new Set<CoarseErrorCategory>([
  'INVALID_INPUT',
  'POLICY_BLOCKED',
  'SCHEMA_VIOLATION',
  'TARGET_NOT_FOUND',
  'NETWORK_BLOCKED',
  'AI_PROVIDER_ERROR',
  'DOCUMENT_PARSE_ERROR',
  'COMPLETION_ERROR',
  'UNKNOWN_ERROR',
]);

const ALLOWED_TARGET_CATEGORIES = new Set<AnonymizedTargetCategory>([
  'input',
  'button',
  'select',
  'checkbox',
  'radio',
  'file_upload',
  'link',
  'heading',
  'section',
  'dialog',
  'form',
  'unknown',
]);

const FORBIDDEN_SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /token/i,
  /secret/i,
  /otp/i,
  /cvv/i,
  /cvc/i,
  /card_number/i,
  /card/i,
  /bank/i,
  /account/i,
  /aadhaar/i,
  /ssn/i,
  /bearer\s+/i,
  /<script/i,
  /javascript:/i,
  /eval\(/i,
];

const CLASSIFICATION_ORDER: Record<DataClassification, number> = {
  [DataClassification.PUBLIC]: 0,
  [DataClassification.INTERNAL]: 1,
  [DataClassification.PERSONAL]: 2,
  [DataClassification.SENSITIVE]: 3,
  [DataClassification.HIGHLY_SENSITIVE]: 4,
};

function isPrivacySafeClassification(c: DataClassification): boolean {
  return CLASSIFICATION_ORDER[c] <= CLASSIFICATION_ORDER[DataClassification.INTERNAL];
}

const ALLOWED_EVENT_KEYS = new Set<string>([
  'eventId',
  'eventType',
  'timestamp',
  'sessionId',
  'feature',
  'success',
  'version',
  'durationBucket',
  'coarseResultCategory',
  'stageId',
  'anonymizedTargetCategory',
  'countMetrics',
  'errorCode',
]);

/**
 * Checks if a string or key contains forbidden sensitive identifiers or keywords.
 */
function containsForbiddenPattern(text: string): boolean {
  return FORBIDDEN_SENSITIVE_PATTERNS.some((pat) => pat.test(text));
}

/**
 * Validates and sanitizes a raw analytics event.
 * Rejects or strips any personal, sensitive, or malformed data.
 */
export function sanitizeAnalyticsEvent(raw: unknown): AnalyticsValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Analytics event must be a non-null object' };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    return { valid: false, error: 'Analytics event is not serializable' };
  }

  if (serialized.length > MAX_ANALYTICS_EVENT_PAYLOAD_BYTES) {
    return { valid: false, error: `Analytics event exceeds payload limit of ${MAX_ANALYTICS_EVENT_PAYLOAD_BYTES} bytes` };
  }

  // Reject executable script injections
  if (serialized.includes('<script') || serialized.includes('javascript:') || serialized.includes('eval(')) {
    return { valid: false, error: 'Analytics event contains forbidden executable script code' };
  }

  const record = raw as Record<string, unknown>;

  // 1. Strict Privacy & Schema Boundary Check:
  // Reject any event containing disallowed keys, sensitive data, personal data, or forbidden patterns.
  for (const [k, v] of Object.entries(record)) {
    const keyLower = k.toLowerCase();
    const valStr = typeof v === 'string' ? v.toLowerCase() : '';

    if (keyLower.includes('password') || valStr.includes('password')) {
      return { valid: false, error: 'Analytics event contains forbidden password field' };
    }
    if (keyLower.includes('otp') || valStr.includes('otp')) {
      return { valid: false, error: 'Analytics event contains forbidden otp field' };
    }
    if (keyLower.includes('script') || valStr.includes('script') || keyLower.includes('html')) {
      return { valid: false, error: 'Analytics event contains forbidden script or HTML content' };
    }

    const classification = classifyData(k, v);
    if (!isPrivacySafeClassification(classification)) {
      return {
        valid: false,
        error: `Analytics event contains forbidden sensitive field: ${k}`,
      };
    }

    if (containsForbiddenPattern(keyLower)) {
      return {
        valid: false,
        error: `Analytics event contains forbidden sensitive field: ${k}`,
      };
    }

    if (
      keyLower.includes('income') ||
      keyLower.includes('salary') ||
      keyLower.includes('bank') ||
      keyLower.includes('account') ||
      keyLower.includes('document') ||
      keyLower.includes('text') ||
      keyLower.includes('url') ||
      keyLower.includes('href') ||
      keyLower.includes('dom') ||
      keyLower.includes('html')
    ) {
      return {
        valid: false,
        error: `Analytics event contains forbidden sensitive field or content: ${k}`,
      };
    }

    if (!ALLOWED_EVENT_KEYS.has(k)) {
      return {
        valid: false,
        error: `Analytics event contains disallowed field: ${k}`,
      };
    }
  }

  // 2. Event Type Validation
  if (!record.eventType || typeof record.eventType !== 'string' || !ALLOWED_EVENT_TYPES.has(record.eventType)) {
    return { valid: false, error: `Invalid or missing eventType: ${String(record.eventType)}` };
  }
  const eventType = record.eventType as AnalyticsEventType;

  // 3. Feature Validation
  if (!record.feature || typeof record.feature !== 'string' || !ALLOWED_FEATURES.has(record.feature as FeatureCategory)) {
    return { valid: false, error: `Invalid or missing feature category: ${String(record.feature)}` };
  }
  const feature = record.feature as FeatureCategory;

  // 4. Timestamp Validation
  let timestamp = typeof record.timestamp === 'number' && Number.isFinite(record.timestamp) ? record.timestamp : Date.now();
  if (timestamp <= 0 || timestamp > Date.now() + 60000) {
    timestamp = Date.now();
  }

  // 5. Session ID Validation (ephemeral, safe identifier)
  let sessionId = typeof record.sessionId === 'string' ? stripHtml(record.sessionId).trim() : 'ephemeral-session';
  if (!sessionId || containsForbiddenPattern(sessionId) || sessionId.length > 64) {
    sessionId = 'sanitized-session';
  }

  // 6. Event ID Validation
  let eventId = typeof record.eventId === 'string' ? stripHtml(record.eventId).trim() : '';
  if (!eventId || eventId.length > 64) {
    eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // 7. Success flag
  const success = typeof record.success === 'boolean' ? record.success : true;

  // 8. Optional durationBucket
  let durationBucket: DurationBucket | undefined;
  if (record.durationBucket && typeof record.durationBucket === 'string' && ALLOWED_DURATION_BUCKETS.has(record.durationBucket as DurationBucket)) {
    durationBucket = record.durationBucket as DurationBucket;
  }

  // 9. Optional coarseResultCategory
  let coarseResultCategory: CoarseResultCategory | undefined;
  if (record.coarseResultCategory && typeof record.coarseResultCategory === 'string' && ALLOWED_RESULT_CATEGORIES.has(record.coarseResultCategory as CoarseResultCategory)) {
    coarseResultCategory = record.coarseResultCategory as CoarseResultCategory;
  }

  // 10. Optional stageId (coarse, e.g. stage-1)
  let stageId: string | undefined;
  if (typeof record.stageId === 'string') {
    const cleaned = stripHtml(record.stageId).trim();
    if (cleaned.length <= 32 && !containsForbiddenPattern(cleaned)) {
      stageId = cleaned;
    }
  }

  // 11. Optional anonymizedTargetCategory (coarse only, never raw DOM IDs or selectors)
  let anonymizedTargetCategory: AnonymizedTargetCategory | undefined;
  if (typeof record.anonymizedTargetCategory === 'string') {
    const rawTarget = record.anonymizedTargetCategory.toLowerCase().trim();
    if (ALLOWED_TARGET_CATEGORIES.has(rawTarget as AnonymizedTargetCategory)) {
      anonymizedTargetCategory = rawTarget as AnonymizedTargetCategory;
    } else {
      anonymizedTargetCategory = 'unknown';
    }
  }

  // Check if raw DOM selector or arbitrary target ID leaked into anonymizedTargetCategory
  if (
    anonymizedTargetCategory &&
    (anonymizedTargetCategory.includes('#') ||
      anonymizedTargetCategory.includes('.') ||
      anonymizedTargetCategory.includes('[') ||
      anonymizedTargetCategory.includes('/'))
  ) {
    anonymizedTargetCategory = 'unknown';
  }

  // 12. Count Metrics Validation (numbers only, safe keys only)
  let countMetrics: Record<string, number> | undefined;
  if (record.countMetrics && typeof record.countMetrics === 'object' && !Array.isArray(record.countMetrics)) {
    const cleanedMetrics: Record<string, number> = {};
    for (const [key, val] of Object.entries(record.countMetrics as Record<string, unknown>)) {
      if (typeof val === 'number' && Number.isFinite(val)) {
        const cleanKey = stripHtml(key).trim();
        if (cleanKey && cleanKey.length <= 64 && !containsForbiddenPattern(cleanKey)) {
          // Confirm not classified as sensitive
          if (isPrivacySafeClassification(classifyData(cleanKey, val))) {
            cleanedMetrics[cleanKey] = val;
          }
        }
      }
    }
    if (Object.keys(cleanedMetrics).length > 0) {
      countMetrics = cleanedMetrics;
    }
  }

  // 13. Error Code Validation
  let errorCode: CoarseErrorCategory | undefined;
  if (record.errorCode && typeof record.errorCode === 'string' && ALLOWED_ERROR_CATEGORIES.has(record.errorCode as CoarseErrorCategory)) {
    errorCode = record.errorCode as CoarseErrorCategory;
  }

  const sanitized: AnalyticsEvent = {
    eventId,
    eventType,
    timestamp,
    sessionId,
    feature,
    success,
    version: ANALYTICS_SCHEMA_VERSION,
  };

  if (durationBucket) sanitized.durationBucket = durationBucket;
  if (coarseResultCategory) sanitized.coarseResultCategory = coarseResultCategory;
  if (stageId) sanitized.stageId = stageId;
  if (anonymizedTargetCategory) sanitized.anonymizedTargetCategory = anonymizedTargetCategory;
  if (countMetrics) sanitized.countMetrics = countMetrics;
  if (errorCode) sanitized.errorCode = errorCode;

  return {
    valid: true,
    sanitized,
  };
}
