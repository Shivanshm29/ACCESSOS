/**
 * ACCESSOS Citizen Profile Vault Storage
 *
 * Persists user profile securely into chrome.storage.local with
 * localStorage and in-memory fallbacks for resilient offline operation and testing.
 */
import type { UserProfile } from './types';
import { DEFAULT_VERIFIED_PROFILE, EMPTY_PROFILE } from './defaults';

export const PROFILE_STORAGE_KEY = 'accessos_user_profile';

export class UserProfileStorage {
  private inMemoryCache: UserProfile | null = null;

  /**
   * Loads persisted profile. Falls back to DEFAULT_VERIFIED_PROFILE on first load
   * so users have an immediate realistic experience.
   */
  public async load(): Promise<UserProfile> {
    if (this.inMemoryCache) {
      return { ...this.inMemoryCache };
    }

    // 1. Chrome storage local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const result = await new Promise<Record<string, unknown>>((resolve) => {
          chrome.storage.local.get([PROFILE_STORAGE_KEY], (res) => resolve(res || {}));
        });
        const stored = result[PROFILE_STORAGE_KEY] as UserProfile | undefined;
        if (stored && typeof stored === 'object' && stored.personal) {
          this.inMemoryCache = stored;
          return { ...stored };
        }
      } catch {
        // Fall through to localStorage
      }
    }

    // 2. localStorage fallback
    if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (item) {
          const parsed = JSON.parse(item) as UserProfile;
          if (parsed && parsed.personal) {
            this.inMemoryCache = parsed;
            return { ...parsed };
          }
        }
      } catch {
        // Fall through to memory default
      }
    }

    // 3. Default verified profile
    this.inMemoryCache = { ...DEFAULT_VERIFIED_PROFILE };
    return { ...DEFAULT_VERIFIED_PROFILE };
  }

  /**
   * Persists profile updates.
   */
  public async save(profile: UserProfile): Promise<boolean> {
    const toSave: UserProfile = {
      ...profile,
      lastUpdated: Date.now(),
      isComplete: Boolean(profile.personal?.fullName && profile.contact?.phone),
    };
    this.inMemoryCache = { ...toSave };

    // 1. Chrome storage local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: toSave }, () => resolve());
        });
        return true;
      } catch {
        // Fall through
      }
    }

    // 2. localStorage fallback
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(toSave));
        return true;
      } catch {
        // Fall through
      }
    }

    return true;
  }

  /**
   * Restores default verified profile template.
   */
  public async resetToDefault(): Promise<UserProfile> {
    const def = { ...DEFAULT_VERIFIED_PROFILE, lastUpdated: Date.now() };
    await this.save(def);
    return def;
  }

  /**
   * Clears profile to empty state.
   */
  public async clear(): Promise<UserProfile> {
    const empty = { ...EMPTY_PROFILE, lastUpdated: Date.now() };
    await this.save(empty);
    return empty;
  }
}

export const userProfileStorage = new UserProfileStorage();
