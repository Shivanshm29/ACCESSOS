import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import {
  DEFAULT_PREFERENCES,
  validateAndSanitizePreferences,
  containsDisallowedKeys,
} from '../src/preferences/defaults';
import {
  PreferencesStorage,
  STORAGE_KEY,
} from '../src/preferences/storage';
import {
  getLocalizedText,
} from '../src/preferences/localization';
import {
  applyVisualPreferences,
  applyLocalization,
} from '../src/preferences/applier';
import type { UserPreferences, TranslationKey } from '../src/preferences/types';
import { evaluateInteractionPolicy } from '../src/interaction/policy';
import type { InteractionIntent } from '../src/interaction/types';

describe('Phase 10 — Preferences Security & Invariants (PREF-01 to PREF-20)', () => {
  let doc: Document;
  let chromeStorageMock: Record<string, unknown> = {};

  beforeEach(async () => {
    const win = new Window({ url: 'http://localhost:3000/' });
    doc = win.document as unknown as Document;
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', win.localStorage);

    chromeStorageMock = {};
    (globalThis as any).chrome = {
      runtime: { lastError: null },
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const res: Record<string, unknown> = {};
            for (const k of keys) {
              if (chromeStorageMock[k] !== undefined) {
                res[k] = chromeStorageMock[k];
              }
            }
            cb(res);
          }),
          set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
            Object.assign(chromeStorageMock, items);
            if (cb) cb();
          }),
          remove: vi.fn((keys: string[], cb?: () => void) => {
            for (const k of keys) delete chromeStorageMock[k];
            if (cb) cb();
          }),
        },
      },
    };

    await PreferencesStorage.clearStorage();
    doc.body.className = '';
    doc.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // PREF-01: Default preferences are safe.
  it('PREF-01: Default preferences are safe', () => {
    expect(DEFAULT_PREFERENCES.version).toBe(1);
    expect(DEFAULT_PREFERENCES.language).toBe('en');
    expect(DEFAULT_PREFERENCES.explanationMode).toBe('STANDARD');
    expect(DEFAULT_PREFERENCES.highContrast).toBe(false);
    expect(DEFAULT_PREFERENCES.largerText).toBe(false);
    expect(DEFAULT_PREFERENCES.reducedDensity).toBe(false);
    expect(DEFAULT_PREFERENCES.guidedShowWhy).toBe(true);
    expect(DEFAULT_PREFERENCES.guidedShowWarnings).toBe(true);
    expect(DEFAULT_PREFERENCES.guidedShowProgress).toBe(true);
    expect(DEFAULT_PREFERENCES.confirmationVerbosity).toBe('STANDARD');
    expect(DEFAULT_PREFERENCES.documentShowEvidence).toBe(true);
    expect(DEFAULT_PREFERENCES.documentShowConfidence).toBe(true);
  });

  // PREF-02: Invalid preference enum is rejected.
  it('PREF-02: Invalid preference enum is rejected and safely clamped', () => {
    const invalidInputs = [
      { language: 'invalid_lang', explanationMode: 'EXTREME', confirmationVerbosity: 'NONE' },
      { language: 123, explanationMode: null, confirmationVerbosity: {} },
      { language: 'es', explanationMode: 'DEBUG_INTERNAL', confirmationVerbosity: 'AUTO_APPROVE' },
    ];

    for (const raw of invalidInputs) {
      const sanitized = validateAndSanitizePreferences(raw);
      expect(sanitized.language).toBe('en');
      expect(sanitized.explanationMode).toBe('STANDARD');
      expect(sanitized.confirmationVerbosity).toBe('STANDARD');
    }
  });

  // PREF-03: Unknown preference field is rejected.
  it('PREF-03: Unknown preference field is rejected', () => {
    const inputWithUnknown = {
      language: 'en',
      allowSubmissions: true,
      bypassConfirmation: true,
      arbitraryAdminRole: 'superuser',
      autoUploadDocuments: true,
    };

    const sanitized = validateAndSanitizePreferences(inputWithUnknown) as unknown as Record<string, unknown>;
    expect(sanitized.allowSubmissions).toBeUndefined();
    expect(sanitized.bypassConfirmation).toBeUndefined();
    expect(sanitized.arbitraryAdminRole).toBeUndefined();
    expect(sanitized.autoUploadDocuments).toBeUndefined();
    expect(sanitized.language).toBe('en');
  });

  // PREF-04: Corrupt stored preferences fall back safely.
  it('PREF-04: Corrupt stored preferences fall back safely without crashing', async () => {
    chromeStorageMock[STORAGE_KEY] = 'malformed-string';
    const prefs1 = await PreferencesStorage.getPreferences();
    expect(prefs1).toEqual(DEFAULT_PREFERENCES);

    chromeStorageMock[STORAGE_KEY] = 98765;
    const prefs2 = await PreferencesStorage.getPreferences();
    expect(prefs2).toEqual(DEFAULT_PREFERENCES);

    chromeStorageMock[STORAGE_KEY] = [1, 2, 3];
    const prefs3 = await PreferencesStorage.getPreferences();
    expect(prefs3).toEqual(DEFAULT_PREFERENCES);
  });

  // PREF-05: Preferences cannot enable SUBMIT.
  it('PREF-05: Preferences cannot enable SUBMIT', () => {
    const intent: InteractionIntent = {
      actionId: 'act-submit-1',
      actionType: 'SUBMIT' as any,
      targetElementId: 'submit-btn',
      reason: 'User attempted submit',
    };

    const evalResult = evaluateInteractionPolicy(intent);
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.riskLevel).toBe('BLOCKED');
    expect(evalResult.blockedReason).toContain('blocked');
  });

  // PREF-06: Preferences cannot enable automatic upload.
  it('PREF-06: Preferences cannot enable automatic upload', () => {
    const uploadIntent: InteractionIntent = {
      actionId: 'act-upload-1',
      actionType: 'UPLOAD' as any,
      targetElementId: 'file-upload',
      reason: 'Auto upload document',
    };

    const evalResult = evaluateInteractionPolicy(uploadIntent);
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.riskLevel).toBe('BLOCKED');
  });

  // PREF-07: Preferences cannot disable required TYPE confirmation.
  it('PREF-07: Preferences cannot disable required TYPE confirmation', () => {
    const typeIntent: InteractionIntent = {
      actionId: 'act-type-1',
      actionType: 'TYPE',
      targetElementId: 'first-name',
      value: 'Aarav',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      reason: 'Enter name',
    };

    const evalResult = evaluateInteractionPolicy(typeIntent);
    expect(evalResult.allowed).toBe(true);
    expect(evalResult.requiresConfirmation).toBe(true);
  });

  // PREF-08: Preferences cannot disable SELECT_OPTION confirmation.
  it('PREF-08: Preferences cannot disable SELECT_OPTION confirmation', () => {
    const selectIntent: InteractionIntent = {
      actionId: 'act-select-1',
      actionType: 'SELECT_OPTION',
      targetElementId: 'category-select',
      optionValue: 'GENERAL',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      reason: 'Select category',
    };

    const evalResult = evaluateInteractionPolicy(selectIntent);
    expect(evalResult.allowed).toBe(true);
    expect(evalResult.requiresConfirmation).toBe(true);
  });

  // PREF-09: Preferences cannot disable TOGGLE_CHECKBOX confirmation.
  it('PREF-09: Preferences cannot disable TOGGLE_CHECKBOX confirmation', () => {
    const checkboxIntent: InteractionIntent = {
      actionId: 'act-cb-1',
      actionType: 'TOGGLE_CHECKBOX',
      targetElementId: 'terms-checkbox',
      checked: true,
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      reason: 'Toggle checkbox',
    };

    const evalResult = evaluateInteractionPolicy(checkboxIntent);
    expect(evalResult.allowed).toBe(true);
    expect(evalResult.requiresConfirmation).toBe(true);
  });

  // PREF-10: Preferences cannot bypass sensitive-field blocking.
  it('PREF-10: Preferences cannot bypass sensitive-field blocking', () => {
    const pwdInput = doc.createElement('input');
    pwdInput.type = 'password';
    pwdInput.id = 'account-password';
    doc.body.appendChild(pwdInput);

    const sensitiveTypeIntent: InteractionIntent = {
      actionId: 'act-type-pwd',
      actionType: 'TYPE',
      targetElementId: 'account-password',
      value: 'SecretPass123',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      reason: 'Enter password',
    };

    const evalResult = evaluateInteractionPolicy(sensitiveTypeIntent, pwdInput);
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.riskLevel).toBe('BLOCKED');
    expect(evalResult.blockedReason).toContain('sensitive');
  });

  // PREF-11: Preferences cannot enable arbitrary script execution.
  it('PREF-11: Preferences cannot enable arbitrary script execution', () => {
    const scriptIntent: InteractionIntent = {
      actionId: 'act-script-1',
      actionType: 'EXECUTE_SCRIPT' as any,
      targetElementId: 'body',
      reason: 'Run injected script',
    };

    const evalResult = evaluateInteractionPolicy(scriptIntent);
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.riskLevel).toBe('BLOCKED');
  });

  // PREF-12: Preferences cannot enable filesystem scanning.
  it('PREF-12: Preferences cannot enable filesystem scanning', () => {
    const inputWithFsScan = {
      language: 'en',
      scanFilesystem: true,
      allowLocalDirectorySearch: true,
    };

    const sanitized = validateAndSanitizePreferences(inputWithFsScan) as unknown as Record<string, unknown>;
    expect(sanitized.scanFilesystem).toBeUndefined();
    expect(sanitized.allowLocalDirectorySearch).toBeUndefined();
    expect(containsDisallowedKeys({ filesystem: 'C:/Windows' })).toBe(true);
  });

  // PREF-13: Preferences cannot contain passwords.
  it('PREF-13: Preferences cannot contain passwords', () => {
    const inputWithPassword = {
      language: 'en',
      user_password: 'super-secret-password-123',
    };

    expect(containsDisallowedKeys(inputWithPassword)).toBe(true);
    const sanitized = validateAndSanitizePreferences(inputWithPassword);
    expect(sanitized).toEqual(DEFAULT_PREFERENCES);
    expect((sanitized as unknown as Record<string, unknown>).user_password).toBeUndefined();
  });

  // PREF-14: Preferences cannot contain tokens.
  it('PREF-14: Preferences cannot contain tokens', () => {
    const inputWithToken = {
      language: 'en',
      authToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    };

    expect(containsDisallowedKeys(inputWithToken)).toBe(true);
    const sanitized = validateAndSanitizePreferences(inputWithToken);
    expect(sanitized).toEqual(DEFAULT_PREFERENCES);
    expect((sanitized as unknown as Record<string, unknown>).authToken).toBeUndefined();
  });

  // PREF-15: Preferences cannot contain document contents.
  it('PREF-15: Preferences cannot contain document contents', () => {
    const inputWithDoc = {
      language: 'en',
      document_content: 'Extracted raw tax return data and income statements',
    };

    expect(containsDisallowedKeys(inputWithDoc)).toBe(true);
    const sanitized = validateAndSanitizePreferences(inputWithDoc);
    expect(sanitized).toEqual(DEFAULT_PREFERENCES);
    expect((sanitized as unknown as Record<string, unknown>).document_content).toBeUndefined();
  });

  // PREF-16: Preferences cannot contain raw HTML.
  it('PREF-16: Preferences cannot contain raw HTML', () => {
    const inputWithHtml = {
      language: 'en',
      raw_html: '<script>alert("exploit")</script>',
    };

    expect(containsDisallowedKeys(inputWithHtml)).toBe(true);
    const sanitized = validateAndSanitizePreferences(inputWithHtml);
    expect(sanitized).toEqual(DEFAULT_PREFERENCES);
    expect((sanitized as unknown as Record<string, unknown>).raw_html).toBeUndefined();
  });

  // PREF-17: Preference changes cannot mutate webpage values.
  it('PREF-17: Preference changes cannot mutate webpage values', () => {
    const pageInput = doc.createElement('input');
    pageInput.id = 'applicant-name';
    pageInput.value = 'Original User Value';
    doc.body.appendChild(pageInput);

    const updatedPrefs: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      language: 'hi',
      highContrast: true,
      largerText: true,
      reducedDensity: true,
    };

    applyVisualPreferences(updatedPrefs, doc);
    applyLocalization(updatedPrefs, doc);

    // Ensure the webpage field value is completely untouched
    expect(pageInput.value).toBe('Original User Value');
  });

  // PREF-18: Preference changes cannot trigger browser navigation.
  it('PREF-18: Preference changes cannot trigger browser navigation', async () => {
    const initialHref = window.location.href;
    await PreferencesStorage.updatePreferences({ language: 'hi', highContrast: true });
    expect(window.location.href).toBe(initialHref);
  });

  // PREF-19: Missing localization falls back to English.
  it('PREF-19: Missing localization falls back to English', () => {
    const nonExistentKey = 'non_existent_pref_string' as TranslationKey;
    const text = getLocalizedText(nonExistentKey, 'hi');
    expect(text).toBe(nonExistentKey);

    // Known key falls back if language dict was empty
    const knownKey = 'pref_saved_toast' as TranslationKey;
    const textFallback = getLocalizedText(knownKey, 'fr' as any);
    expect(textFallback).toBe('Preferences saved');
  });

  // PREF-20: Preference changes cannot weaken Phase 8 validation.
  it('PREF-20: Preference changes cannot weaken Phase 8 validation', async () => {
    // Attempt setting preferences to various combinations
    await PreferencesStorage.updatePreferences({
      confirmationVerbosity: 'DETAILED',
      guidedShowWarnings: false,
      guidedShowWhy: false,
    });

    const maliciousIntents: InteractionIntent[] = [
      { actionId: 'act-m1', actionType: 'SUBMIT' as any, targetElementId: 'form', reason: 'submit' },
      { actionId: 'act-m2', actionType: 'DELETE' as any, targetElementId: 'row', reason: 'delete' },
      { actionId: 'act-m3', actionType: 'NAVIGATE' as any, targetElementId: 'link', reason: 'navigate' },
      {
        actionId: 'act-m4',
        actionType: 'TYPE',
        targetElementId: 'target',
        value: 'AI forged text',
        valueSource: 'AI_GENERATED',
        source: 'AI_SUGGESTION',
        reason: 'Type unverified value',
      },
    ];

    for (const intent of maliciousIntents) {
      const evalRes = evaluateInteractionPolicy(intent);
      expect(evalRes.allowed).toBe(false);
      expect(evalRes.riskLevel).toBe('BLOCKED');
    }
  });
});
