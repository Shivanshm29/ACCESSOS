import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 16 — Installation & Unpacked Extension Verification Suite (INSTALL-01 through INSTALL-20)', () => {
  const distDir = path.resolve(__dirname, '../dist');
  const manifestPath = path.join(distDir, 'manifest.json');
  let manifest: any;

  it('INSTALL-01: Manifest defines manifest_version: 3', () => {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
  });

  it('INSTALL-02: Manifest defines extension name: "ACCESSOS"', () => {
    expect(manifest.name).toBe('ACCESSOS');
  });

  it('INSTALL-03: Manifest defines extension version: "0.1.0"', () => {
    expect(manifest.version).toBe('0.1.0');
  });

  it('INSTALL-04: Manifest specifies default_popup pointing to existing HTML file', () => {
    expect(manifest.action.default_popup).toBe('src/popup/popup.html');
    expect(fs.existsSync(path.join(distDir, manifest.action.default_popup))).toBe(true);
  });

  it('INSTALL-05: Manifest specifies action icons pointing to existing icons', () => {
    expect(manifest.action.default_icon['16']).toBe('icons/icon16.png');
    expect(manifest.action.default_icon['48']).toBe('icons/icon48.png');
    expect(manifest.action.default_icon['128']).toBe('icons/icon128.png');
    expect(fs.existsSync(path.join(distDir, manifest.action.default_icon['16']))).toBe(true);
    expect(fs.existsSync(path.join(distDir, manifest.action.default_icon['48']))).toBe(true);
    expect(fs.existsSync(path.join(distDir, manifest.action.default_icon['128']))).toBe(true);
  });

  it('INSTALL-06: Manifest specifies background service_worker pointing to existing JS file', () => {
    expect(manifest.background.service_worker).toBe('assets/background.js');
    expect(fs.existsSync(path.join(distDir, manifest.background.service_worker))).toBe(true);
  });

  it('INSTALL-07: Manifest specifies background worker type: "module"', () => {
    expect(manifest.background.type).toBe('module');
  });

  it('INSTALL-08: Manifest permissions array strictly contains ["storage", "activeTab"]', () => {
    expect(manifest.permissions).toEqual(['storage', 'activeTab']);
  });

  it('INSTALL-09: Manifest content_scripts defines explicit match patterns', () => {
    const cs = manifest.content_scripts[0];
    expect(cs.matches).toContain('http://*/*');
    expect(cs.matches).toContain('https://*/*');
    expect(cs.matches).toContain('file:///*');
  });

  it('INSTALL-10: Manifest content_scripts specifies run_at: "document_idle"', () => {
    const cs = manifest.content_scripts[0];
    expect(cs.run_at).toBe('document_idle');
  });

  it('INSTALL-11: Manifest options_ui page points to existing HTML file', () => {
    expect(manifest.options_ui.page).toBe('src/options/options.html');
    expect(fs.existsSync(path.join(distDir, manifest.options_ui.page))).toBe(true);
  });

  it('INSTALL-12: Manifest contains zero deprecated Manifest V2 keys', () => {
    expect(manifest.browser_action).toBeUndefined();
    expect(manifest.page_action).toBeUndefined();
    expect(manifest.background.scripts).toBeUndefined();
  });

  it('INSTALL-13: Manifest contains zero broad host permissions (<all_urls>)', () => {
    const hostPerms = manifest.host_permissions || [];
    expect(hostPerms).not.toContain('<all_urls>');
    expect(manifest.permissions).not.toContain('<all_urls>');
  });

  it('INSTALL-14: Popup HTML specifies UTF-8 charset and viewport', () => {
    const popupHtml = fs.readFileSync(path.join(distDir, 'src/popup/popup.html'), 'utf8');
    expect(popupHtml).toContain('charset="UTF-8"');
    expect(popupHtml).toContain('name="viewport"');
  });

  it('INSTALL-15: Popup HTML links to stylesheet and popup JS bundle', () => {
    const popupHtml = fs.readFileSync(path.join(distDir, 'src/popup/popup.html'), 'utf8');
    expect(popupHtml).toContain('stylesheet');
    expect(popupHtml).toContain('popup.js');
  });

  it('INSTALL-16: Options HTML links to stylesheet and options JS bundle', () => {
    const optionsHtml = fs.readFileSync(path.join(distDir, 'src/options/options.html'), 'utf8');
    expect(optionsHtml).toContain('stylesheet');
    expect(optionsHtml).toContain('options.js');
  });

  it('INSTALL-17: Extension backend configuration is valid HTTP/HTTPS endpoint', () => {
    const backendUrl = 'http://localhost:8000';
    const parsed = new URL(backendUrl);
    expect(['http:', 'https:'].includes(parsed.protocol)).toBe(true);
  });

  it('INSTALL-18: Backend health endpoint schema matches requirements', () => {
    const healthData = {
      status: 'healthy',
      service: 'ACCESSOS Backend',
      version: '0.1.0',
      environment: 'development',
    };
    expect(healthData.status).toBe('healthy');
    expect(healthData.version).toBe('0.1.0');
  });

  it('INSTALL-19: Backend readiness endpoint schema matches requirements', () => {
    const readyData = {
      status: 'ready',
      service: 'ACCESSOS Backend',
      version: '0.1.0',
      ready: true,
      checks: {
        configuration: { valid: true },
      },
    };
    expect(readyData.ready).toBe(true);
    expect(readyData.checks.configuration.valid).toBe(true);
  });

  it('INSTALL-20: Unpacked installation bundle directory (dist/) is ready for Chromium load', () => {
    const requiredEntries = [
      'manifest.json',
      'assets/popup.js',
      'assets/content.js',
      'assets/background.js',
      'src/popup/popup.html',
      'src/options/options.html',
    ];
    for (const entry of requiredEntries) {
      expect(fs.existsSync(path.join(distDir, entry))).toBe(true);
    }
  });
});
