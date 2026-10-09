/**
 * ACCESSOS User Preferences Storage Manager (Phase 10)
 *
 * Persists bounded preferences locally without storing sensitive credentials or documents.
 * Seamlessly abstracts chrome.storage.local, localStorage, and in-memory fallback.
 */

import type { UserPreferences, PreferenceUpdate } from './types';
import { DEFAULT_PREFERENCES, validateAndSanitizePreferences } from './defaults';

export const STORAGE_KEY = 'accessos_user_preferences';

let memoryStore: Record<string, unknown> = {};

export class PreferencesStorage {
  /**
   * Retrieves stored preferences or falls back safely to defaults.
   */
  public static async getPreferences(): Promise<UserPreferences> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise<UserPreferences>((resolve) => {
          chrome.storage.local.get([STORAGE_KEY], (result) => {
            if (chrome.runtime.lastError || !result || !result[STORAGE_KEY]) {
              resolve({ ...DEFAULT_PREFERENCES });
              return;
            }
            resolve(validateAndSanitizePreferences(result[STORAGE_KEY]));
          });
        });
      }

      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(STORAGE_KEY);
        if (!item) return { ...DEFAULT_PREFERENCES };
        const parsed = JSON.parse(item);
        return validateAndSanitizePreferences(parsed);
      }

      const mem = memoryStore[STORAGE_KEY];
      return mem ? validateAndSanitizePreferences(mem) : { ...DEFAULT_PREFERENCES };
    } catch {
      // Any parsing or storage error safely falls back to defaults
      return { ...DEFAULT_PREFERENCES };
    }
  }

  /**
   * Saves clean, validated preferences to local storage.
   */
  public static async savePreferences(prefs: UserPreferences): Promise<boolean> {
    const clean = validateAndSanitizePreferences(prefs);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise<boolean>((resolve) => {
          chrome.storage.local.set({ [STORAGE_KEY]: clean }, () => {
            resolve(!chrome.runtime.lastError);
          });
        });
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        return true;
      }

      memoryStore[STORAGE_KEY] = clean;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Applies partial preference updates safely.
   */
  public static async updatePreferences(partial: PreferenceUpdate): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const merged = { ...current, ...partial };
    const validated = validateAndSanitizePreferences(merged);
    await this.savePreferences(validated);
    return validated;
  }

  /**
   * Resets stored preferences to safe default values.
   */
  public static async resetPreferences(): Promise<UserPreferences> {
    const defaults = { ...DEFAULT_PREFERENCES };
    await this.savePreferences(defaults);
    return defaults;
  }

  /**
   * Clears storage (used for unit test resets).
   */
  public static async clearStorage(): Promise<void> {
    memoryStore = {};
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.remove === 'function') {
      return new Promise<void>((resolve) => {
        chrome.storage.local.remove([STORAGE_KEY], () => resolve());
      });
    }
  }
}
