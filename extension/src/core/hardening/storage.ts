/**
 * ACCESSOS Storage Robustness & Safe Fallback Manager (Phase 15 Production Hardening)
 * Features:
 * 1. Safe abstraction over chrome.storage.local with in-memory fallback.
 * 2. Corrupted JSON / schema failure recovery: resets to safe defaults fail-closed.
 * 3. Never recovers corrupted state by granting permissions or weakening security.
 * 4. Storage quota handling and safe error reporting.
 */

export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

export interface StorageRecord<T> {
  schemaVersion: number;
  data: T;
  timestamp: number;
}

export class HardenedStorage {
  private inMemoryFallback: Map<string, string> = new Map();

  /**
   * Reads a typed value from storage.
   * If storage is unavailable, corrupted, or fails validator, returns the provided safeDefault.
   */
  public async get<T>(
    key: string,
    safeDefault: T,
    validator?: (data: unknown) => data is T
  ): Promise<T> {
    try {
      let raw: unknown = null;

      if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
        const result = await chrome.storage.local.get(key);
        raw = result ? result[key] : null;
      } else {
        const mem = this.inMemoryFallback.get(key);
        if (mem) {
          raw = JSON.parse(mem);
        }
      }

      if (raw === null || raw === undefined) {
        return safeDefault;
      }

      // Check if wrapped in StorageRecord
      let candidate: unknown = raw;
      if (typeof raw === 'object' && raw !== null && 'schemaVersion' in raw && 'data' in raw) {
        candidate = (raw as StorageRecord<T>).data;
      }

      // Validate data structure if validator provided
      if (validator && !validator(candidate)) {
        // Corrupted record -> reset to safe default
        await this.set(key, safeDefault);
        return safeDefault;
      }

      return candidate as T;
    } catch {
      // Any parsing or storage error returns the safe default
      return safeDefault;
    }
  }

  /**
   * Writes a typed value to storage, wrapping it in a versioned record.
   */
  public async set<T>(key: string, value: T): Promise<boolean> {
    const record: StorageRecord<T> = {
      schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
      data: value,
      timestamp: Date.now(),
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) {
        await chrome.storage.local.set({ [key]: record });
        return true;
      } else {
        this.inMemoryFallback.set(key, JSON.stringify(record));
        return true;
      }
    } catch (err: unknown) {
      // In-memory fallback on quota or storage failure
      try {
        this.inMemoryFallback.set(key, JSON.stringify(record));
      } catch {
        // Ignored
      }
      return false;
    }
  }

  /**
   * Removes a key from storage.
   */
  public async remove(key: string): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local?.remove) {
        await chrome.storage.local.remove(key);
      }
    } catch {
      // Ignore
    }
    this.inMemoryFallback.delete(key);
  }

  /**
   * Clears storage.
   */
  public async clear(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local?.clear) {
        await chrome.storage.local.clear();
      }
    } catch {
      // Ignore
    }
    this.inMemoryFallback.clear();
  }
}

export const hardenedStorage = new HardenedStorage();
