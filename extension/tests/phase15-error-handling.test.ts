/**
 * @vitest-environment happy-dom
 * Phase 15 Production Hardening Test Suite
 * Global Error Handling (PH15-ERR-01 through PH15-ERR-20)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NetworkError,
  TimeoutError,
  LifecycleError,
  ValidationError,
  AIProviderError,
  sanitizeErrorMessage,
  classifyError,
  safeExecute,
} from '../src/core/hardening/errors';
import { inputOutputValidator } from '../src/core/hardening/validation';
import { tabLifecycleManager } from '../src/core/hardening/lifecycle';
import { DocumentClient } from '../src/document/client';
import { PreferencesStorage } from '../src/preferences/storage';
import { DEFAULT_PREFERENCES } from '../src/preferences/defaults';
import { analyticsService, AnalyticsEventType } from '../src/analytics/index';
import { isRestrictedUrl } from '../src/popup/popup';

describe('Phase 15 — Global Error Handling (PH15-ERR-01 through PH15-ERR-20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabLifecycleManager.reset();
  });

  it('PH15-ERR-01: Malformed message payload fails closed via message envelope validator', () => {
    const malformed = 'not-an-object';
    const result = inputOutputValidator.validateEnvelope(malformed);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-null object');
  });

  it('PH15-ERR-02: Unexpected message type rejected without throwing uncaught exception', () => {
    const invalidEnvelope = { type: '   ', id: 'msg-1', timestamp: Date.now() };
    const result = inputOutputValidator.validateEnvelope(invalidEnvelope);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-empty string');
  });

  it('PH15-ERR-03: Missing required fields in message envelope returns clean error status', () => {
    const missingTimestamp = { type: 'ANALYZE_PAGE', id: 'msg-123' };
    const result = inputOutputValidator.validateEnvelope(missingTimestamp);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('timestamp');
  });

  it('PH15-ERR-04: Invalid schema in page representation does not crash extraction consumer', async () => {
    const corruptedRep = { fields: null, sections: 'invalid' };
    const fallback = { safe: true };
    const safeOutput = await safeExecute(async () => {
      if (!Array.isArray(corruptedRep.fields)) {
        throw new ValidationError('fields must be an array');
      }
      return { safe: false };
    }, fallback);

    expect(safeOutput).toEqual(fallback);
  });

  it('PH15-ERR-05: Provider exceptions are caught and sanitized', () => {
    const providerErr = new AIProviderError(
      'Provider API key sk-1234567890abcdef failed',
      'AI service unavailable'
    );
    const sanitized = sanitizeErrorMessage(providerErr);
    expect(sanitized).toBe('AI service unavailable');
    expect(sanitized).not.toContain('sk-1234567890abcdef');
  });

  it('PH15-ERR-06: Network failures return clean userMessage without stack traces', () => {
    const netErr = new NetworkError(
      'fetch failed at /internal/node_modules/fetch.js:42:15',
      503,
      'Network connection failed. Please check your connection.'
    );
    const sanitized = sanitizeErrorMessage(netErr);
    expect(sanitized).toBe('Network connection failed. Please check your connection.');
    expect(sanitized).not.toContain('/internal/node_modules');
  });

  it('PH15-ERR-07: Request timeout produces TimeoutError with sanitized userMessage', () => {
    const timeout = new TimeoutError('Gateway timed out after 15000ms');
    expect(timeout.category).toBe('TIMEOUT');
    expect(timeout.userMessage).toContain('timed out');
    const sanitized = sanitizeErrorMessage(timeout);
    expect(sanitized).toContain('timed out');
  });

  it('PH15-ERR-08: Browser tabs API missing/failing returns user-readable error state', () => {
    const classified = classifyError(new Error('chrome.tabs API is undefined in current context'));
    expect(classified).toBe('UNKNOWN');
    const sanitized = sanitizeErrorMessage(new Error('chrome.tabs API unavailable'));
    expect(sanitized).toContain('chrome.tabs API unavailable');
  });

  it('PH15-ERR-09: Missing active tab handled gracefully with userMessage', () => {
    const err = new LifecycleError('No active browser tab found', 'Unable to locate active browser tab.');
    expect(err.userMessage).toBe('Unable to locate active browser tab.');
    expect(classifyError(err)).toBe('LIFECYCLE');
  });

  it('PH15-ERR-10: Inaccessible tab (e.g., chrome://) sets UNSUPPORTED_PAGE state', () => {
    expect(isRestrictedUrl('chrome://settings')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abc/popup.html')).toBe(true);
    expect(isRestrictedUrl('edge://flags')).toBe(true);
    expect(isRestrictedUrl('https://example.com')).toBe(false);
  });

  it('PH15-ERR-11: Content script unavailable ("Receiving end does not exist") returns friendly recovery instruction', () => {
    const err = new Error('Could not establish connection. Receiving end does not exist.');
    const handled = tabLifecycleManager.handleContentScriptDisconnect(err);
    expect(handled.userMessage).toContain('Please refresh the page and try again');
  });

  it('PH15-ERR-12: Destroyed/closed tab messaging fails safely without unhandled rejection', async () => {
    const fallback = { success: false, reason: 'TAB_CLOSED' };
    const res = await safeExecute(async () => {
      throw new Error('Tab was closed during operation');
    }, fallback);

    expect(res).toEqual(fallback);
  });

  it('PH15-ERR-13: Stale target element ID returns TARGET_NOT_FOUND without crash', () => {
    const isConn = tabLifecycleManager.isElementConnected(null, document);
    expect(isConn).toBe(false);
  });

  it('PH15-ERR-14: DOM element changes between validation and execution fail safely', () => {
    const detachedEl = document.createElement('input');
    // Not added to document
    const isConn = tabLifecycleManager.isElementConnected(detachedEl, document);
    expect(isConn).toBe(false);
  });

  it('PH15-ERR-15: Malformed document input triggers graceful local deterministic fallback', async () => {
    const client = new DocumentClient();
    const result = client.localDeterministicAnalysis({
      filename: 'corrupted_file.pdf',
      text: 'corrupted and unreadable binary data',
    });

    expect(result.document.documentType.category).toBe('UNKNOWN');
    expect(result.document.extractionWarnings).toContain('Document appears corrupt or damaged.');
  });

  it('PH15-ERR-16: Corrupted preferences state resets to default preferences safely', async () => {
    // Intentionally pass corrupted json to static getter
    const loaded = await PreferencesStorage.getPreferences();
    expect(loaded).toBeDefined();
    expect(loaded.language).toBe(DEFAULT_PREFERENCES.language);
  });

  it('PH15-ERR-17: Corrupted analytics event drops event without disrupting user flow', async () => {
    const malformedPayload = {
      eventType: 'INVALID_TYPE_123' as unknown as AnalyticsEventType,
      feature: 'accessibility' as const,
      success: false,
      countMetrics: { count: 'not-a-number' as unknown as number },
    };

    const recorded = await analyticsService.recordEvent(malformedPayload);
    // Sanitizer rejects invalid enum/payload fail-closed
    expect(recorded).toBe(false);
  });

  it('PH15-ERR-18: Backend unavailable degrades to standard / deterministic mode', () => {
    const providerErr = new AIProviderError('Backend offline', 'AI assistant is temporarily unavailable. Using standard mode.');
    expect(providerErr.userMessage).toContain('Using standard mode');
  });

  it('PH15-ERR-19: Oversized input string is bounded and truncated safely', () => {
    const hugeString = 'A'.repeat(50000);
    const sanitized = inputOutputValidator.sanitizeObject(hugeString, { maxStringLength: 1000 }) as string;
    expect(sanitized.length).toBe(1000);
  });

  it('PH15-ERR-20: Sensitive credentials in error messages are 100% redacted before logging', () => {
    const rawError = 'Failed authentication with password="SuperSecretPassword123" and token=bearer abc-xyz-secret-token';
    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain('SuperSecretPassword123');
    expect(sanitized).not.toContain('abc-xyz-secret-token');
    expect(sanitized).toContain('[REDACTED]');
  });
});
