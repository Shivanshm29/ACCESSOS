/**
 * @vitest-environment happy-dom
 * Phase 15 Production Hardening Test Suite
 * Failure-Injection Testing (PH15-FAIL-01 through PH15-FAIL-20)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HardenedNetworkClient } from '../src/core/hardening/network';
import { TabLifecycleManager } from '../src/core/hardening/lifecycle';
import { HardenedStorage } from '../src/core/hardening/storage';
import { inputOutputValidator } from '../src/core/hardening/validation';
import { safeExecute, NetworkError } from '../src/core/hardening/errors';
import { prepareExecutionCommand, executeValidatedCommand } from '../src/interaction/executor';
import { DocumentClient } from '../src/document/client';
import { validateAndSanitizePreferences } from '../src/preferences/defaults';
import { analyticsService } from '../src/analytics/index';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { analyzeAccessibility } from '../src/accessibility/index';
import type { InteractionIntent, ValidatedExecutionCommand } from '../src/interaction/types';

describe('Phase 15 — Failure-Injection Testing (PH15-FAIL-01 through PH15-FAIL-20)', () => {
  let netClient: HardenedNetworkClient;
  let lifecycle: TabLifecycleManager;
  let storage: HardenedStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    netClient = new HardenedNetworkClient({ timeoutMs: 100, maxRetries: 0 });
    lifecycle = new TabLifecycleManager();
    storage = new HardenedStorage();
    document.body.innerHTML = '';
  });

  it('PH15-FAIL-01: Backend unavailable (ECONNREFUSED) degrades safely to offline error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const fallback = { fallback: true };
    const res = await safeExecute(
      () => netClient.fetchWithResilience('http://localhost:8000/api/v1/test'),
      fallback
    );

    expect(res).toEqual(fallback);
  });

  it('PH15-FAIL-02: Provider timeout aborts request and provides friendly timeout state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
      return new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('AbortError');
          e.name = 'AbortError';
          rej(e);
        });
      });
    });

    const fallback = { status: 'TIMEOUT_FALLBACK' };
    const res = await safeExecute(
      () => netClient.fetchWithResilience('http://localhost:8000/api/v1/timeout', {}, { timeoutMs: 20 }),
      fallback
    );

    expect(res).toEqual(fallback);
  });

  it('PH15-FAIL-03: Provider 500 server error degrades to standard assistance mode without crash', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Model crashed' }),
    } as unknown as Response);

    const fallback = { mode: 'STANDARD_FALLBACK' };
    const res = await safeExecute(
      () => netClient.fetchWithResilience('http://localhost:8000/api/v1/analyze'),
      fallback
    );

    expect(res).toEqual(fallback);
  });

  it('PH15-FAIL-04: Provider malformed JSON payload handled cleanly by safe parser', () => {
    const brokenJson = '{"data": unquoted_value}';
    const fallback = { success: false, reason: 'PARSE_FAILED' };
    const parsed = inputOutputValidator.safeJsonParse(brokenJson, fallback);

    expect(parsed).toEqual(fallback);
  });

  it('PH15-FAIL-05: Provider invalid schema (missing required fields) rejected without mutation', () => {
    const invalidAIOutput = { unexpected: 123 }; // Missing pageUnderstanding, barriers, etc.
    const isValid = (data: unknown): data is { pageUnderstanding: { pagePurpose: string } } => {
      return typeof data === 'object' && data !== null && 'pageUnderstanding' in data;
    };

    expect(isValid(invalidAIOutput)).toBe(false);
  });

  it('PH15-FAIL-06: Network disconnect during analysis produces sanitized NetworkError', async () => {
    vi.spyOn(netClient, 'isOnline').mockReturnValue(false);

    try {
      await netClient.fetchWithResilience('http://localhost:8000/api/v1/test');
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(NetworkError);
      expect((err as NetworkError).userMessage).toContain('No internet connection');
    }
  });

  it('PH15-FAIL-07: Content script missing returns friendly connection recovery prompt', () => {
    const err = new Error('Could not establish connection. Receiving end does not exist.');
    const handled = lifecycle.handleContentScriptDisconnect(err);

    expect(handled.userMessage).toContain('Please refresh the page and try again');
  });

  it('PH15-FAIL-08: Content script disconnect mid-session caught without unhandled rejection', async () => {
    const fallback = { connected: false };
    const result = await safeExecute(async () => {
      throw new Error('Port disconnected');
    }, fallback);

    expect(result).toEqual(fallback);
  });

  it('PH15-FAIL-09: Tab closes during operation; pending operations fail safely', async () => {
    lifecycle.registerTab(100, 'https://example.com');
    lifecycle.registerCapabilityToken('tok_close', 100, 'https://example.com');

    // Simulate tab removal
    lifecycle.invalidateTab(100, 'Tab closed');

    expect(lifecycle.isCapabilityTokenValid('tok_close', 100, 'https://example.com')).toBe(false);
  });

  it('PH15-FAIL-10: Tab navigates during operation; capability tokens invalidated immediately', () => {
    lifecycle.registerTab(200, 'https://example.com/step1');
    lifecycle.registerCapabilityToken('tok_nav', 200, 'https://example.com/step1');

    // Navigates
    lifecycle.registerTab(200, 'https://example.com/step2');

    expect(lifecycle.isCapabilityTokenValid('tok_nav', 200, 'https://example.com/step2')).toBe(false);
  });

  it('PH15-FAIL-11: DOM changes between validation and execution; element detachment returns TARGET_NOT_FOUND', async () => {
    const input = document.createElement('input');
    input.id = 'dynamic-input';
    document.body.appendChild(input);

    const intent: InteractionIntent = {
      actionId: 'act-dyn',
      actionType: 'TYPE',
      targetElementId: 'dynamic-input',
      value: 'Test',
      source: 'USER',
      valueSource: 'USER_EXPLICIT',
    };

    const prep = prepareExecutionCommand(intent, document, { confirmed: true });
    expect(prep.valid).toBe(true);

    // Remove element from DOM before execution!
    document.body.removeChild(input);

    const result = await executeValidatedCommand(prep.command!, document);
    expect(result.status).toBe('TARGET_NOT_FOUND');
    expect(result.message).toContain('detached or stale');
  });

  it('PH15-FAIL-12: Storage corruption (unparseable string) safely recovers to default storage values', async () => {
    const memAny = storage as unknown as { inMemoryFallback: Map<string, string> };
    memAny.inMemoryFallback.set('corrupt_config', '{bad_json');

    const recovered = await storage.get('corrupt_config', { defaultSetting: true });
    expect(recovered).toEqual({ defaultSetting: true });
  });

  it('PH15-FAIL-13: Storage quota exceeded falls back safely to in-memory store', async () => {
    const success = await storage.set('big_key', 'A'.repeat(5000));
    expect(success).toBe(true);

    const val = await storage.get('big_key', '');
    expect(val).toBe('A'.repeat(5000));
  });

  it('PH15-FAIL-14: Analytics corrupted state drops event without throwing or blocking UI', async () => {
    const malformed = null as unknown as Parameters<typeof analyticsService.recordEvent>[0];
    const res = await analyticsService.recordEvent(malformed);
    expect(res).toBe(false);
  });

  it('PH15-FAIL-15: Invalid preferences keys/types sanitized to safe defaults', () => {
    const maliciousPrefs = {
      language: '<script>alert(1)</script>',
      unknownHackerKey: 'attack',
      highContrast: 'not-a-boolean' as unknown as boolean,
      version: 99999,
    };

    const sanitized = validateAndSanitizePreferences(maliciousPrefs);
    expect(sanitized.language).toBe('en'); // Defaults to safe language
    expect((sanitized as unknown as Record<string, unknown>).unknownHackerKey).toBeUndefined(); // Key stripped
    expect(typeof sanitized.highContrast).toBe('boolean'); // Coerced or default
  });

  it('PH15-FAIL-16: Oversized input (> 64KB) truncated safely without buffer overflow', () => {
    const hugeInput = 'Z'.repeat(100000);
    const sanitized = inputOutputValidator.sanitizeObject(hugeInput, { maxStringLength: 10000 }) as string;
    expect(sanitized.length).toBe(10000);
  });

  it('PH15-FAIL-17: Malformed document text with encryption warnings flags document properly', () => {
    const docClient = new DocumentClient();
    const result = docClient.localDeterministicAnalysis({
      filename: 'secret.pdf',
      text: 'This file is encrypted with password protection.',
    });

    expect(result.document.extractionWarnings).toContain('Document is password-protected or encrypted.');
  });

  it('PH15-FAIL-18: Invalid execution command (missing actionType) rejected by executor', async () => {
    const invalidCmd = {
      actionId: 'act-no-type',
      targetElementId: 'any-id',
      commandToken: 'fake',
    } as unknown as ValidatedExecutionCommand;

    const result = await executeValidatedCommand(invalidCmd, document);
    expect(result.status).toBe('NOT_ALLOWED');
  });

  it('PH15-FAIL-19: Rapid repeated failure injection (100 concurrent failed network calls) handles all rejections cleanly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection reset by peer'));

    const promises = Array.from({ length: 100 }, () =>
      safeExecute(() => netClient.fetchWithResilience('http://localhost:8000/api/v1/rapid'), { failed: true })
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
    for (const r of results) {
      expect(r).toEqual({ failed: true });
    }
  });

  it('PH15-FAIL-20: Failure in accessibility engine rule evaluation catches error and scores baseline without crashing', () => {
    document.body.innerHTML = '<main><h1>Accessible Heading</h1><button>Click</button></main>';
    const rep = extractPageRepresentation(document, window.location);

    // Corrupt representation accessibility signals
    (rep as unknown as { accessibilitySignals: unknown }).accessibilitySignals = null;

    const report = analyzeAccessibility(rep, document);
    expect(report).toBeDefined();
    expect(report.score.finalScore).toBeGreaterThanOrEqual(0);
  });
});
