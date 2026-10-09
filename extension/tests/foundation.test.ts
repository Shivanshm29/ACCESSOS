import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MessageType, createMessage } from '../src/core/messaging/index';

describe('Extension Foundation Test Suite', () => {
  it('proves the test framework works as expected', () => {
    expect(1 + 1).toBe(2);
    expect(true).toBe(true);
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('validates the Manifest V3 configuration', () => {
    const manifestPath = path.resolve(__dirname, '../manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const rawManifest = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(rawManifest);

    // Manifest V3 core requirements
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('ACCESSOS');
    expect(typeof manifest.version).toBe('string');
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.description).toBeDefined();

    // Actions & Background
    expect(manifest.action).toBeDefined();
    expect(manifest.action.default_popup).toBe('src/popup/popup.html');
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBe('assets/background.js');
    expect(manifest.background.type).toBe('module');

    // Permissions
    expect(Array.isArray(manifest.permissions)).toBe(true);
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');

    // Content Scripts
    expect(Array.isArray(manifest.content_scripts)).toBe(true);
    expect(manifest.content_scripts[0].matches).toContain('http://*/*');
    expect(manifest.content_scripts[0].matches).toContain('https://*/*');
    expect(manifest.content_scripts[0].js).toContain('assets/content.js');

    // Icons exist
    expect(manifest.icons).toBeDefined();
    ['16', '48', '128'].forEach((size) => {
      const iconRelPath = manifest.icons[size];
      const fullIconPath = path.resolve(__dirname, '..', iconRelPath);
      expect(fs.existsSync(fullIconPath)).toBe(true);
    });
  });

  it('verifies messaging helper generates valid typed message payloads', () => {
    const message = createMessage(MessageType.PING);
    expect(message.type).toBe(MessageType.PING);
    expect(typeof message.timestamp).toBe('number');
    expect(message.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
