/**
 * ACCESSOS Preferences Applier (Phase 10)
 *
 * Applies visual accessibility modes (contrast, text size, density) and
 * UI localization updates to DOM documents.
 */

import type { UserPreferences, TranslationKey } from './types';
import { getLocalizedText } from './localization';

export function applyVisualPreferences(prefs: UserPreferences, doc: Document = document): void {
  if (!doc || !doc.body) return;

  const target = doc.body;

  // 1. High Contrast
  if (prefs.highContrast) {
    target.classList.add('accessos-high-contrast');
  } else {
    target.classList.remove('accessos-high-contrast');
  }

  // 2. Larger Text
  if (prefs.largerText) {
    target.classList.add('accessos-larger-text');
  } else {
    target.classList.remove('accessos-larger-text');
  }

  // 3. Reduced Density
  if (prefs.reducedDensity) {
    target.classList.add('accessos-reduced-density');
  } else {
    target.classList.remove('accessos-reduced-density');
  }
}

export function applyLocalization(prefs: UserPreferences, doc: Document = document): void {
  if (!doc) return;

  // Text content localization
  const i18nElements = doc.querySelectorAll<HTMLElement>('[data-i18n]');
  i18nElements.forEach((el) => {
    const key = el.getAttribute('data-i18n') as TranslationKey;
    if (key) {
      const translated = getLocalizedText(key, prefs.language);
      if (translated) {
        el.textContent = translated;
      }
    }
  });

  // Placeholder localization
  const placeholderElements = doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]');
  placeholderElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder') as TranslationKey;
    if (key) {
      const translated = getLocalizedText(key, prefs.language);
      if (translated) {
        el.placeholder = translated;
      }
    }
  });
}
