/**
 * ACCESSOS Security Sanitizer (Phase 11)
 * Defensive sanitization, redaction, and bounded depth structures.
 */

import {
  MAX_ARRAY_ITEMS,
  MAX_OBJECT_DEPTH,
  MAX_STRING_LENGTH,
  REDACTION_BANK,
  REDACTION_CARD,
  REDACTION_CVV,
  REDACTION_GOV_ID,
  REDACTION_OTP,
  REDACTION_PATH,
  REDACTION_TOKEN,
  REGEX_AADHAAR,
  REGEX_BANK_ACCOUNT,
  REGEX_BEARER_TOKEN,
  REGEX_CREDIT_CARD,
  REGEX_CVV,
  REGEX_HTML_TAGS,
  REGEX_OTP,
  REGEX_SSN,
  REGEX_UNIX_PATH,
  REGEX_WINDOWS_PATH,
} from './constants';
import { DataClassification } from './types';

export function stripHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const cleaned = text.replace(REGEX_HTML_TAGS, '').replace(/<[^>]+>/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function redactSensitiveCredentials(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let result = text;
  result = result.replace(REGEX_BEARER_TOKEN, REDACTION_TOKEN);
  result = result.replace(REGEX_CREDIT_CARD, REDACTION_CARD);
  result = result.replace(REGEX_CVV, `$1${REDACTION_CVV}`);
  result = result.replace(REGEX_OTP, `$1${REDACTION_OTP}`);
  result = result.replace(REGEX_BANK_ACCOUNT, `$1${REDACTION_BANK}`);
  result = result.replace(REGEX_SSN, REDACTION_GOV_ID);
  result = result.replace(REGEX_AADHAAR, REDACTION_GOV_ID);
  result = result.replace(REGEX_WINDOWS_PATH, REDACTION_PATH);
  result = result.replace(REGEX_UNIX_PATH, ` ${REDACTION_PATH}`);

  return result;
}

export function sanitizeUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(urlStr);
    const sensitiveParamKeywords = ['token', 'auth', 'key', 'secret', 'password', 'pwd', 'api_key', 'session'];
    
    for (const key of Array.from(parsed.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (sensitiveParamKeywords.some((kw) => lower.includes(kw))) {
        parsed.searchParams.set(key, REDACTION_TOKEN);
      }
    }
    return parsed.toString();
  } catch {
    return urlStr.slice(0, 256);
  }
}

export function sanitizeText(text: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const cleaned = stripHtml(text);
  const redacted = redactSensitiveCredentials(cleaned);
  return redacted.length > maxLength ? redacted.slice(0, maxLength) : redacted;
}

export function classifyData(key: string, value: unknown): DataClassification {
  const k = key.toLowerCase();
  const v = typeof value === 'string' ? value.toLowerCase() : '';

  // Highly Sensitive
  const highlySensitiveKeys = [
    'password', 'passwd', 'pwd', 'secret', 'token', 'auth', 'api_key',
    'otp', 'cvv', 'cvc', 'pin', 'ssn', 'aadhaar', 'card_number', 'pan'
  ];
  if (highlySensitiveKeys.some((pattern) => k.includes(pattern))) {
    return DataClassification.HIGHLY_SENSITIVE;
  }
  if (
    v.includes('bearer ') ||
    v.includes('ghp_') ||
    v.includes('sk_live_') ||
    v.includes('xoxb-')
  ) {
    return DataClassification.HIGHLY_SENSITIVE;
  }

  // Sensitive
  const sensitiveKeys = [
    'income', 'salary', 'tax', 'bank', 'account_no', 'address', 'domicile',
    'caste', 'religion', 'disability', 'medical', 'phone', 'mobile'
  ];
  if (sensitiveKeys.some((pattern) => k.includes(pattern))) {
    return DataClassification.SENSITIVE;
  }

  // Personal
  const personalKeys = [
    'name', 'first_name', 'last_name', 'dob', 'birth', 'gender', 'email',
    'student_id', 'roll_no', 'gpa', 'marks', 'degree', 'school', 'college'
  ];
  if (personalKeys.some((pattern) => k.includes(pattern))) {
    return DataClassification.PERSONAL;
  }

  // Internal
  const internalKeys = [
    'config', 'preference', 'theme', 'version', 'step_index', 'status',
    'mode', 'rule_id', 'metadata', 'timestamp'
  ];
  if (internalKeys.some((pattern) => k.includes(pattern))) {
    return DataClassification.INTERNAL;
  }

  return DataClassification.PUBLIC;
}

export function sanitizeDataStructure(data: unknown, currentDepth: number = 0): unknown {
  if (currentDepth > MAX_OBJECT_DEPTH) {
    return '[EXCEEDED_MAX_DEPTH]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeText(data);
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    const boundedArray = data.slice(0, MAX_ARRAY_ITEMS);
    return boundedArray.map((item) => sanitizeDataStructure(item, currentDepth + 1));
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const classification = classifyData(key, val);
      if (classification === DataClassification.HIGHLY_SENSITIVE) {
        sanitizedObj[key] = REDACTION_TOKEN;
      } else {
        sanitizedObj[key] = sanitizeDataStructure(val, currentDepth + 1);
      }
    }
    return sanitizedObj;
  }

  return String(data);
}
