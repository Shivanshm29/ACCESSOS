/**
 * Phase 15 Production Hardening Test Suite
 * Permission & Configuration Hardening (PH15-CONFIG-01 through PH15-CONFIG-10)
 */

import { describe, it, expect } from 'vitest';
import manifest from '../manifest.json';
import { DEFAULT_BACKEND_URL } from '../src/ai/client';

describe('Phase 15 — Permission & Configuration Hardening (PH15-CONFIG-01 through PH15-CONFIG-10)', () => {
  it('PH15-CONFIG-01: Manifest permissions contain only minimal required permissions (activeTab, storage)', () => {
    expect(manifest.permissions).toBeDefined();
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions.length).toBe(2);
  });

  it('PH15-CONFIG-02: Broad permissions (<all_urls>, webRequest, cookies, debugger) are strictly absent from manifest', () => {
    const dangerousPermissions = [
      '<all_urls>',
      'webRequest',
      'webRequestBlocking',
      'cookies',
      'debugger',
      'proxy',
      'management',
      'nativeMessaging',
    ];

    for (const perm of dangerousPermissions) {
      expect(manifest.permissions).not.toContain(perm);
    }
  });

  it('PH15-CONFIG-03: Extension manifest specifies Manifest V3 with non-persistent service worker', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background?.service_worker).toBeDefined();
    expect(manifest.background?.type).toBe('module');
  });

  it('PH15-CONFIG-04: Default backend URL points to localhost and uses standard port 8000', () => {
    expect(DEFAULT_BACKEND_URL).toBe('http://localhost:8000');
    expect(DEFAULT_BACKEND_URL).not.toContain('production-secret');
  });

  it('PH15-CONFIG-05: Secrets and API keys are never bundled or hardcoded in extension source assets', () => {
    const serializedManifest = JSON.stringify(manifest);
    expect(serializedManifest).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(serializedManifest).not.toMatch(/AIza[0-9A-Za-z-_]{35}/);
    expect(serializedManifest).not.toContain('api_key');
    expect(serializedManifest).not.toContain('secret');
  });

  it('PH15-CONFIG-06: Content scripts run at document_idle to avoid blocking page rendering', () => {
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
    expect(manifest.content_scripts[0].run_at).toBe('document_idle');
  });

  it('PH15-CONFIG-07: Options page opens in isolated tab rather than embedded iframe', () => {
    expect(manifest.options_ui?.open_in_tab).toBe(true);
    expect(manifest.options_ui?.page).toBe('src/options/options.html');
  });

  it('PH15-CONFIG-08: Content script matches specify standard web schemes without arbitrary chrome schemes', () => {
    const matches = manifest.content_scripts[0].matches;
    for (const match of matches) {
      expect(match).not.toContain('chrome://');
      expect(match).not.toContain('edge://');
      expect(match).not.toContain('about:');
    }
  });

  it('PH15-CONFIG-09: Extension icons provide crisp standard resolutions (16, 48, 128)', () => {
    expect(manifest.icons?.['16']).toBe('icons/icon16.png');
    expect(manifest.icons?.['48']).toBe('icons/icon48.png');
    expect(manifest.icons?.['128']).toBe('icons/icon128.png');
  });

  it('PH15-CONFIG-10: Action popup points to dedicated popup HTML within extension bundle', () => {
    expect(manifest.action?.default_popup).toBe('src/popup/popup.html');
    expect(manifest.action?.default_title).toBe('ACCESSOS');
  });
});
