/**
 * ACCESSOS Default Preferences & Safe Sanitizer (Phase 10)
 *
 * Implements deterministic safe defaults and error-resilient recovery from corrupt storage.
 */

import type { UserPreferences, LanguageCode, ExplanationComplexity, ConfirmationVerbosity } from './types';

export const PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: Readonly<UserPreferences> = Object.freeze({
  version: PREFERENCES_VERSION,
  language: 'en',
  explanationMode: 'STANDARD',
  highContrast: false,
  largerText: false,
  reducedDensity: false,
  guidedShowWhy: true,
  guidedShowWarnings: true,
  guidedShowProgress: true,
  confirmationVerbosity: 'STANDARD',
  documentShowEvidence: true,
  documentShowConfidence: true,
  analyticsEnabled: true,
});

export const ALLOWED_PREFERENCE_KEYS = new Set<string>([
  'version',
  'language',
  'explanationMode',
  'highContrast',
  'largerText',
  'reducedDensity',
  'guidedShowWhy',
  'guidedShowWarnings',
  'guidedShowProgress',
  'confirmationVerbosity',
  'documentShowEvidence',
  'documentShowConfidence',
  'analyticsEnabled',
]);

export const DISALLOWED_PREFERENCE_KEYWORDS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'auth',
  'jwt',
  'otp',
  'pin',
  'cvv',
  'card',
  'account',
  'bank',
  'document_content',
  'raw_document',
  'html',
  'raw_html',
  'script',
  'code',
  'eval',
  'filesystem',
  'path',
]);

export function containsDisallowedKeys(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    if (ALLOWED_PREFERENCE_KEYS.has(key)) {
      continue;
    }
    const lower = key.toLowerCase();
    for (const kw of DISALLOWED_PREFERENCE_KEYWORDS) {
      if (lower.includes(kw)) {
        return true;
      }
    }
  }
  return false;
}

export function validateAndSanitizePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_PREFERENCES };
  }

  const data = raw as Record<string, unknown>;

  // Immediately reject & reset to default if sensitive keys or credentials detected
  if (containsDisallowedKeys(data)) {
    return { ...DEFAULT_PREFERENCES };
  }

  const sanitized: UserPreferences = {
    version: PREFERENCES_VERSION,
    language: (data.language === 'hi' ? 'hi' : 'en') as LanguageCode,
    explanationMode: (
      data.explanationMode === 'SIMPLE' || data.explanationMode === 'DETAILED'
        ? data.explanationMode
        : 'STANDARD'
    ) as ExplanationComplexity,
    highContrast: typeof data.highContrast === 'boolean' ? data.highContrast : false,
    largerText: typeof data.largerText === 'boolean' ? data.largerText : false,
    reducedDensity: typeof data.reducedDensity === 'boolean' ? data.reducedDensity : false,
    guidedShowWhy: typeof data.guidedShowWhy === 'boolean' ? data.guidedShowWhy : true,
    guidedShowWarnings: typeof data.guidedShowWarnings === 'boolean' ? data.guidedShowWarnings : true,
    guidedShowProgress: typeof data.guidedShowProgress === 'boolean' ? data.guidedShowProgress : true,
    confirmationVerbosity: (
      data.confirmationVerbosity === 'DETAILED' ? 'DETAILED' : 'STANDARD'
    ) as ConfirmationVerbosity,
    documentShowEvidence: typeof data.documentShowEvidence === 'boolean' ? data.documentShowEvidence : true,
    documentShowConfidence: typeof data.documentShowConfidence === 'boolean' ? data.documentShowConfidence : true,
    analyticsEnabled: typeof data.analyticsEnabled === 'boolean' ? data.analyticsEnabled : true,
  };

  return sanitized;
}
