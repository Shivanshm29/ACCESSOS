/**
 * ACCESSOS Demo Reset System (Phase 17)
 *
 * Restores the extension and demo portal state to a deterministic, clean baseline.
 * Enforces safety boundaries:
 * - Never deletes unrelated user data or non-ACCESSOS keys.
 * - Never modifies arbitrary websites.
 * - Preserves all Phase 8 and Phase 11 security constraints.
 */

import { DEFAULT_PREFERENCES } from '../preferences/defaults';
import { hardenedStorage } from '../core/hardening/storage';

export interface DemoResetOptions {
  resetPreferences?: boolean;
  resetAnalytics?: boolean;
  resetDocuments?: boolean;
  clearAnalysisCache?: boolean;
  resetProfile?: boolean;
}

export interface DemoResetResult {
  success: boolean;
  timestamp: number;
  clearedItems: string[];
  message: string;
}

export class DemoResetManager {
  public static readonly DEMO_KEYS = [
    'accessos_preferences',
    'accessos_analytics',
    'accessos_documents',
    'accessos_last_analysis',
    'accessos_guided_state',
    'accessos_completion_cache',
    'accessos_user_profile',
  ];

  /**
   * Resets all demo-related storage items and optionally restores default preferences.
   */
  public async resetDemo(options: DemoResetOptions = {}): Promise<DemoResetResult> {
    const {
      resetPreferences = true,
      resetAnalytics = true,
      resetDocuments = true,
      clearAnalysisCache = true,
      resetProfile = true,
    } = options;

    const clearedItems: string[] = [];

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        // Clear specific demo keys only
        const keysToRemove: string[] = [];
        if (resetAnalytics) keysToRemove.push('accessos_analytics');
        if (resetDocuments) keysToRemove.push('accessos_documents');
        if (resetProfile) keysToRemove.push('accessos_user_profile');
        if (clearAnalysisCache) {
          keysToRemove.push('accessos_last_analysis', 'accessos_guided_state', 'accessos_completion_cache');
        }

        await new Promise<void>((resolve) => {
          chrome.storage.local.remove(keysToRemove, () => {
            clearedItems.push(...keysToRemove);
            resolve();
          });
        });

        if (resetPreferences) {
          await new Promise<void>((resolve) => {
            chrome.storage.local.set({ accessos_preferences: DEFAULT_PREFERENCES }, () => {
              clearedItems.push('accessos_preferences:reset_to_default');
              resolve();
            });
          });
        }
      } else {
        // In-memory fallback
        hardenedStorage.clear();
        clearedItems.push('in_memory_store');
        if (resetPreferences) {
          await hardenedStorage.set('accessos_preferences', DEFAULT_PREFERENCES);
          clearedItems.push('accessos_preferences:reset_to_default');
        }
      }

      return {
        success: true,
        timestamp: Date.now(),
        clearedItems,
        message: 'Demo state successfully restored to clean baseline.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during reset';
      return {
        success: false,
        timestamp: Date.now(),
        clearedItems,
        message: `Reset failed: ${msg}`,
      };
    }
  }

  /**
   * Resets the DOM of the National Student Scholarship Portal if present.
   */
  public resetPortalDom(doc: Document = document): boolean {
    const clearBtn = doc.getElementById('btn-clear-demo') as HTMLButtonElement | null;
    if (clearBtn) {
      try {
        clearBtn.click();
        return true;
      } catch {
        return false;
      }
    }

    const form = doc.getElementById('scholarship-application-form') as HTMLFormElement | null;
    if (form) {
      form.reset();
      return true;
    }
    return false;
  }
}

export const demoResetManager = new DemoResetManager();
