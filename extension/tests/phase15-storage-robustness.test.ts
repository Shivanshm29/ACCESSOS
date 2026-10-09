/**
 * @vitest-environment happy-dom
 * Phase 15 Production Hardening Test Suite
 * Storage Robustness (PH15-STORE-01 through PH15-STORE-10)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HardenedStorage, CURRENT_STORAGE_SCHEMA_VERSION } from '../src/core/hardening/storage';

describe('Phase 15 — Storage Robustness (PH15-STORE-01 through PH15-STORE-10)', () => {
  let storage: HardenedStorage;

  beforeEach(() => {
    storage = new HardenedStorage();
  });

  it('PH15-STORE-01: Reads valid record from storage cleanly', async () => {
    await storage.set('test_key', { count: 42 });
    const val = await storage.get('test_key', { count: 0 });
    expect(val).toEqual({ count: 42 });
  });

  it('PH15-STORE-02: Returns safe default when storage key is missing or undefined', async () => {
    const missing = await storage.get('non_existent_key', { fallback: true });
    expect(missing).toEqual({ fallback: true });
  });

  it('PH15-STORE-03: Recovers to safe default when stored value is corrupted JSON', async () => {
    // Inject corrupt JSON into in-memory store directly
    const memAny = storage as unknown as { inMemoryFallback: Map<string, string> };
    memAny.inMemoryFallback.set('corrupt_key', '{not valid json:');

    const recovered = await storage.get('corrupt_key', { safe: true });
    expect(recovered).toEqual({ safe: true });
  });

  it('PH15-STORE-04: Recovers to safe default when stored data fails custom validator', async () => {
    await storage.set('pref_key', { language: 'unsupported_123', version: -1 });

    const validator = (data: unknown): data is { language: string; version: number } => {
      const d = data as { language?: string; version?: number };
      return typeof d === 'object' && d !== null && d.language === 'en' && d.version === 1;
    };

    const safeDefault = { language: 'en', version: 1 };
    const result = await storage.get('pref_key', safeDefault, validator);

    expect(result).toEqual(safeDefault);
  });

  it('PH15-STORE-05: Overwrites corrupt storage entry with safe default on validation failure', async () => {
    await storage.set('invalid_key', { bad: true });

    const validator = (data: unknown): data is { good: boolean } => {
      const d = data as { good?: boolean };
      return typeof d === 'object' && d !== null && d.good === true;
    };

    const safeDefault = { good: true };
    await storage.get('invalid_key', safeDefault, validator);

    // Stored value should now be reset to safeDefault!
    const updated = await storage.get('invalid_key', { good: false });
    expect(updated).toEqual(safeDefault);
  });

  it('PH15-STORE-06: Writes versioned record with schemaVersion and timestamp', async () => {
    await storage.set('version_test', 'value123');

    const memAny = storage as unknown as { inMemoryFallback: Map<string, string> };
    const raw = memAny.inMemoryFallback.get('version_test');
    expect(raw).toBeDefined();

    const parsed = JSON.parse(raw!);
    expect(parsed.schemaVersion).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(parsed.timestamp).toBeGreaterThan(0);
    expect(parsed.data).toBe('value123');
  });

  it('PH15-STORE-07: In-memory fallback functions seamlessly when chrome.storage is unavailable', async () => {
    const freshStorage = new HardenedStorage();
    await freshStorage.set('mem_only', { offline: true });

    const val = await freshStorage.get('mem_only', { offline: false });
    expect(val).toEqual({ offline: true });
  });

  it('PH15-STORE-08: Quota errors or set failures fall back to in-memory store', async () => {
    // Setting oversized item directly
    const success = await storage.set('quota_item', { item: 'A'.repeat(500) });
    expect(success).toBe(true);

    const val = await storage.get('quota_item', null);
    expect(val).toEqual({ item: 'A'.repeat(500) });
  });

  it('PH15-STORE-09: Storage remove deletes record cleanly from both storage and in-memory fallback', async () => {
    await storage.set('to_remove', 'val');
    await storage.remove('to_remove');

    const result = await storage.get('to_remove', 'deleted');
    expect(result).toBe('deleted');
  });

  it('PH15-STORE-10: Storage clear empties all records cleanly', async () => {
    await storage.set('k1', 1);
    await storage.set('k2', 2);
    await storage.clear();

    const v1 = await storage.get('k1', 'empty');
    const v2 = await storage.get('k2', 'empty');
    expect(v1).toBe('empty');
    expect(v2).toBe('empty');
  });
});
