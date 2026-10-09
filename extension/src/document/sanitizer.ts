/**
 * ACCESSOS Document Intelligence Sanitization Utilities (Phase 9)
 *
 * Privacy, truncation, and safety boundaries for documents and sensitive identifiers.
 */

import { MAX_EVIDENCE_LENGTH } from './types';

const CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const AADHAAR_REGEX = /\b\d{4}\s\d{4}\s\d{4}\b/g;
const ACCOUNT_REGEX = /\b\d{9,18}\b/g;
const SECRET_REGEX = /(password|secret|token|otp|cvv)\s*[:=]\s*(\S+)/gi;

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_document';
  // Strip paths
  const cleaned = filename.replace(/\\/g, '/').split('/').pop() || '';
  // Remove null bytes and path traversal
  return cleaned.replace(/[\x00-\x1f\x7f]/g, '').replace(/\.\./g, '').trim() || 'unnamed_document';
}

export function truncateEvidence(text: string, maxLength: number = MAX_EVIDENCE_LENGTH): string {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function redactSensitiveValue(valueOrType: string, maybeValue?: string): string {
  const value = maybeValue !== undefined ? maybeValue : valueOrType;
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `****${digits.slice(-4)}`;
  }
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export function sanitizeForLogging(text: string): string {
  if (!text) return '';
  return text
    .replace(CARD_REGEX, '[CARD-REDACTED]')
    .replace(AADHAAR_REGEX, '[ID-REDACTED]')
    .replace(SECRET_REGEX, '$1: [REDACTED]')
    .replace(ACCOUNT_REGEX, '[ACCOUNT-REDACTED]');
}
