/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import { DemoResetManager, demoResetManager } from '../src/demo/reset';
import { DEFAULT_PREFERENCES } from '../src/preferences/defaults';

describe('Phase 17 — Demo Reset System Suite (RESET-01 through RESET-10)', () => {
  let mockStorage: Record<string, unknown>;

  beforeEach(() => {
    mockStorage = {
      accessos_preferences: { ...DEFAULT_PREFERENCES, uiLanguage: 'hi' },
      accessos_analytics: { totalEvents: 42 },
      accessos_documents: [{ id: 'doc-1' }],
      accessos_last_analysis: { timestamp: 12345 },
      accessos_guided_state: { step: 2 },
      accessos_completion_cache: { score: 85 },
      user_personal_unrelated_key: 'preserve-this-data',
    };

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const res: Record<string, unknown> = {};
            keys.forEach((k) => {
              if (mockStorage[k] !== undefined) res[k] = mockStorage[k];
            });
            cb(res);
          }),
          set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
            Object.assign(mockStorage, items);
            cb?.();
          }),
          remove: vi.fn((keys: string[], cb?: () => void) => {
            keys.forEach((k) => delete mockStorage[k]);
            cb?.();
          }),
        },
      },
    };
  });

  it('RESET-01: DemoResetManager exposes standard set of demo storage keys', () => {
    expect(DemoResetManager.DEMO_KEYS).toContain('accessos_preferences');
    expect(DemoResetManager.DEMO_KEYS).toContain('accessos_analytics');
    expect(DemoResetManager.DEMO_KEYS).toContain('accessos_documents');
    expect(DemoResetManager.DEMO_KEYS).toContain('accessos_last_analysis');
    expect(DemoResetManager.DEMO_KEYS).toContain('accessos_guided_state');
    expect(DemoResetManager.DEMO_KEYS).toContain('accessos_completion_cache');
  });

  it('RESET-02: resetDemo clears cached analysis, guided state, and completion cache', async () => {
    const res = await demoResetManager.resetDemo({ clearAnalysisCache: true });
    expect(res.success).toBe(true);
    expect(mockStorage['accessos_last_analysis']).toBeUndefined();
    expect(mockStorage['accessos_guided_state']).toBeUndefined();
    expect(mockStorage['accessos_completion_cache']).toBeUndefined();
  });

  it('RESET-03: resetDemo clears temporary document intelligence records', async () => {
    const res = await demoResetManager.resetDemo({ resetDocuments: true });
    expect(res.success).toBe(true);
    expect(mockStorage['accessos_documents']).toBeUndefined();
  });

  it('RESET-04: resetDemo clears local analytics metrics when requested', async () => {
    const res = await demoResetManager.resetDemo({ resetAnalytics: true });
    expect(res.success).toBe(true);
    expect(mockStorage['accessos_analytics']).toBeUndefined();
  });

  it('RESET-05: resetDemo restores default user preferences', async () => {
    mockStorage['accessos_preferences'] = { ...DEFAULT_PREFERENCES, language: 'hi' };
    expect((mockStorage['accessos_preferences'] as { language: string }).language).toBe('hi');
    const res = await demoResetManager.resetDemo({ resetPreferences: true });
    expect(res.success).toBe(true);
    expect(mockStorage['accessos_preferences']).toEqual(DEFAULT_PREFERENCES);
    expect((mockStorage['accessos_preferences'] as { language: string }).language).toBe('en');
  });

  it('RESET-06: resetDemo never deletes unrelated third-party keys from storage', async () => {
    await demoResetManager.resetDemo();
    expect(mockStorage['user_personal_unrelated_key']).toBe('preserve-this-data');
  });

  it('RESET-07: resetPortalDom triggers btn-clear-demo on scholarship portal when available', () => {
    const window = new Window();
    const doc = window.document as unknown as Document;
    const btn = doc.createElement('button');
    btn.id = 'btn-clear-demo';
    let clicked = false;
    btn.addEventListener('click', () => { clicked = true; });
    doc.body.appendChild(btn);

    const handled = demoResetManager.resetPortalDom(doc);
    expect(handled).toBe(true);
    expect(clicked).toBe(true);
  });

  it('RESET-08: resetPortalDom falls back to form reset when clear button is absent', () => {
    const window = new Window();
    const doc = window.document as unknown as Document;
    const form = doc.createElement('form') as HTMLFormElement;
    form.id = 'scholarship-application-form';
    let resetFired = false;
    form.addEventListener('reset', () => { resetFired = true; });
    doc.body.appendChild(form);

    const handled = demoResetManager.resetPortalDom(doc);
    expect(handled).toBe(true);
    expect(resetFired).toBe(true);
  });

  it('RESET-09: Demo reset returns structured result with timestamp and cleared items list', async () => {
    const res = await demoResetManager.resetDemo();
    expect(res.success).toBe(true);
    expect(res.timestamp).toBeGreaterThan(0);
    expect(res.clearedItems.length).toBeGreaterThan(0);
    expect(res.message).toContain('clean baseline');
  });

  it('RESET-10: Reset operation is idempotent across multiple successive executions', async () => {
    const res1 = await demoResetManager.resetDemo();
    const res2 = await demoResetManager.resetDemo();
    const res3 = await demoResetManager.resetDemo();

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);
    expect(mockStorage['accessos_preferences']).toEqual(DEFAULT_PREFERENCES);
    expect(mockStorage['accessos_analytics']).toBeUndefined();
    expect(mockStorage['user_personal_unrelated_key']).toBe('preserve-this-data');
  });
});
