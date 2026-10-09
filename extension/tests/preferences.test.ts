import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_VERSION,
  validateAndSanitizePreferences,
  containsDisallowedKeys,
} from '../src/preferences/defaults';
import {
  PreferencesStorage,
  STORAGE_KEY,
} from '../src/preferences/storage';
import {
  getLocalizedText,
  getAllTranslations,
  TRANSLATIONS,
} from '../src/preferences/localization';
import {
  applyVisualPreferences,
  applyLocalization,
} from '../src/preferences/applier';
import type { UserPreferences, TranslationKey } from '../src/preferences/types';

describe('Phase 10 — User Preferences Core & Defaults', () => {
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
  });

  describe('Defaults and Validation', () => {
    it('provides safe deterministic default preferences', () => {
      expect(DEFAULT_PREFERENCES.version).toBe(PREFERENCES_VERSION);
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

    it('sanitizes valid partial preferences safely', () => {
      const sanitized = validateAndSanitizePreferences({
        language: 'hi',
        explanationMode: 'DETAILED',
        highContrast: true,
      });

      expect(sanitized.language).toBe('hi');
      expect(sanitized.explanationMode).toBe('DETAILED');
      expect(sanitized.highContrast).toBe(true);
      expect(sanitized.largerText).toBe(false); // default retained
      expect(sanitized.version).toBe(PREFERENCES_VERSION);
    });

    it('falls back to safe defaults when given null, undefined, or primitive input', () => {
      expect(validateAndSanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
      expect(validateAndSanitizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
      expect(validateAndSanitizePreferences('invalid')).toEqual(DEFAULT_PREFERENCES);
      expect(validateAndSanitizePreferences(12345)).toEqual(DEFAULT_PREFERENCES);
      expect(validateAndSanitizePreferences([])).toEqual(DEFAULT_PREFERENCES);
    });

    it('falls back to defaults for invalid enums', () => {
      const sanitized = validateAndSanitizePreferences({
        language: 'french',
        explanationMode: 'SUPER_COMPLEX',
        confirmationVerbosity: 'SILENT_AUTO_APPROVE',
      });

      expect(sanitized.language).toBe('en');
      expect(sanitized.explanationMode).toBe('STANDARD');
      expect(sanitized.confirmationVerbosity).toBe('STANDARD');
    });

    it('detects disallowed sensitive keywords and triggers clean fallback', () => {
      expect(containsDisallowedKeys({ password: '123' })).toBe(true);
      expect(containsDisallowedKeys({ authToken: 'xyz' })).toBe(true);
      expect(containsDisallowedKeys({ bank_account: '999' })).toBe(true);
      expect(containsDisallowedKeys({ raw_html: '<div>' })).toBe(true);
      expect(containsDisallowedKeys({ language: 'en', explanationMode: 'SIMPLE' })).toBe(false);

      const sanitized = validateAndSanitizePreferences({
        language: 'hi',
        storedPassword: 'secret',
      });
      expect(sanitized).toEqual(DEFAULT_PREFERENCES);
    });
  });

  describe('Storage Lifecycle', () => {
    it('retrieves default preferences if storage is empty', async () => {
      const prefs = await PreferencesStorage.getPreferences();
      expect(prefs).toEqual(DEFAULT_PREFERENCES);
    });

    it('saves and retrieves modified preferences', async () => {
      const modified: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        language: 'hi',
        highContrast: true,
        explanationMode: 'SIMPLE',
      };

      const saved = await PreferencesStorage.savePreferences(modified);
      expect(saved).toBe(true);

      const retrieved = await PreferencesStorage.getPreferences();
      expect(retrieved.language).toBe('hi');
      expect(retrieved.highContrast).toBe(true);
      expect(retrieved.explanationMode).toBe('SIMPLE');
    });

    it('updates partial preferences cleanly', async () => {
      await PreferencesStorage.updatePreferences({ largerText: true });
      let prefs = await PreferencesStorage.getPreferences();
      expect(prefs.largerText).toBe(true);
      expect(prefs.highContrast).toBe(false);

      await PreferencesStorage.updatePreferences({ confirmationVerbosity: 'DETAILED' });
      prefs = await PreferencesStorage.getPreferences();
      expect(prefs.largerText).toBe(true);
      expect(prefs.confirmationVerbosity).toBe('DETAILED');
    });

    it('resets preferences back to safe defaults', async () => {
      await PreferencesStorage.updatePreferences({
        language: 'hi',
        highContrast: true,
        largerText: true,
        guidedShowWhy: false,
      });

      const reset = await PreferencesStorage.resetPreferences();
      expect(reset).toEqual(DEFAULT_PREFERENCES);

      const stored = await PreferencesStorage.getPreferences();
      expect(stored).toEqual(DEFAULT_PREFERENCES);
    });

    it('recovers safely from corrupt JSON in storage', async () => {
      chromeStorageMock[STORAGE_KEY] = 'corrupted-non-object-data';
      const prefs = await PreferencesStorage.getPreferences();
      expect(prefs).toEqual(DEFAULT_PREFERENCES);
    });
  });

  describe('Localization Dictionary', () => {
    it('provides English translations for all defined keys', () => {
      const en = TRANSLATIONS.en;
      expect(en.app_title).toBe('ACCESSOS');
      expect(en.tab_guided).toBe('Guided Mode');
      expect(en.pref_language_label).toBe('Language');
      expect(en.safety_immutable_notice).toContain('Safety controls and confirmation gates remain strictly mandatory');
    });

    it('provides Hindi translations for all defined keys', () => {
      const hi = TRANSLATIONS.hi;
      expect(hi.app_title).toContain('एक्सेस ओएस');
      expect(hi.tab_guided).toBe('गाइडेड मोड');
      expect(hi.pref_language_label).toBe('भाषा');
      expect(hi.safety_immutable_notice).toContain('सुरक्षा नियंत्रण और पुष्टि द्वार हमेशा अनिवार्य रहते हैं');
    });

    it('falls back to English when translation key is queried in unsupported or missing case', () => {
      const textEn = getLocalizedText('pref_saved_toast', 'en');
      expect(textEn).toBe('Preferences saved');

      const textHi = getLocalizedText('pref_saved_toast', 'hi');
      expect(textHi).toBe('प्राथमिकताएं सहेजी गईं');

      // Casting an unknown key should return the key itself safely without throwing
      const unknownKey = 'unknown_key_xyz' as TranslationKey;
      const textFallback = getLocalizedText(unknownKey, 'hi');
      expect(textFallback).toBe(unknownKey);
    });

    it('returns complete translation dictionary using getAllTranslations', () => {
      const dict = getAllTranslations('hi');
      expect(dict.pref_high_contrast_label).toBe('उच्च कंट्रास्ट मोड');
      expect(dict.pref_reset_btn).toBe('डिफ़ॉल्ट पर रीसेट करें');
    });
  });

  describe('Visual Applier & DOM Localization', () => {
    it('applies visual classes to document body according to preferences', () => {
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        highContrast: true,
        largerText: true,
        reducedDensity: true,
      };

      applyVisualPreferences(prefs, document);
      expect(document.body.classList.contains('accessos-high-contrast')).toBe(true);
      expect(document.body.classList.contains('accessos-larger-text')).toBe(true);
      expect(document.body.classList.contains('accessos-reduced-density')).toBe(true);

      const resetPrefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        highContrast: false,
        largerText: false,
        reducedDensity: false,
      };

      applyVisualPreferences(resetPrefs, document);
      expect(document.body.classList.contains('accessos-high-contrast')).toBe(false);
      expect(document.body.classList.contains('accessos-larger-text')).toBe(false);
      expect(document.body.classList.contains('accessos-reduced-density')).toBe(false);
    });

    it('applies localization to data-i18n and data-i18n-placeholder elements', () => {
      document.body.innerHTML = `
        <h1 data-i18n="app_title">Original Title</h1>
        <button data-i18n="tab_guided">Original Tab</button>
        <input type="text" data-i18n-placeholder="explain_input_placeholder" placeholder="Original Placeholder" />
      `;

      // Apply Hindi
      applyLocalization({ ...DEFAULT_PREFERENCES, language: 'hi' }, document);
      expect(document.querySelector('h1')!.textContent).toContain('एक्सेस ओएस');
      expect(document.querySelector('button')!.textContent).toBe('गाइडेड मोड');
      expect((document.querySelector('input') as HTMLInputElement).placeholder).toContain('वेबपेज पर टेक्स्ट चुनें');

      // Re-apply English
      applyLocalization({ ...DEFAULT_PREFERENCES, language: 'en' }, document);
      expect(document.querySelector('h1')!.textContent).toBe('ACCESSOS');
      expect(document.querySelector('button')!.textContent).toBe('Guided Mode');
      expect((document.querySelector('input') as HTMLInputElement).placeholder).toContain('Select text on webpage');
    });
  });

  describe('Performance Benchmarks', () => {
    it('measures preference load, save, localization lookup, and applier performance', async () => {
      const N = 500;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        getLocalizedText('tab_guided', 'hi');
      }
      const locLookupMs = (performance.now() - t0) / N;

      const t1 = performance.now();
      for (let i = 0; i < N; i++) {
        await PreferencesStorage.savePreferences({ ...DEFAULT_PREFERENCES, largerText: i % 2 === 0 });
      }
      const saveMs = (performance.now() - t1) / N;

      const t2 = performance.now();
      for (let i = 0; i < N; i++) {
        await PreferencesStorage.getPreferences();
      }
      const loadMs = (performance.now() - t2) / N;

      const t3 = performance.now();
      for (let i = 0; i < N; i++) {
        applyVisualPreferences({ ...DEFAULT_PREFERENCES, highContrast: true }, doc);
      }
      const applyVisualMs = (performance.now() - t3) / N;

      console.log('PREFERENCE_BENCHMARKS:', JSON.stringify({
        localizationLookupMs: Number(locLookupMs.toFixed(4)),
        preferenceSaveMs: Number(saveMs.toFixed(4)),
        preferenceLoadMs: Number(loadMs.toFixed(4)),
        applyVisualMs: Number(applyVisualMs.toFixed(4)),
      }));

      expect(locLookupMs).toBeLessThan(0.1);
      expect(saveMs).toBeLessThan(1.0);
      expect(loadMs).toBeLessThan(1.0);
      expect(applyVisualMs).toBeLessThan(0.5);
    });
  });
});
