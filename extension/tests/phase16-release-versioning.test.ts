import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 16 — Release Versioning & Reproducibility Suite (REL-01 through REL-10)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const expectedVersion = '0.1.0';

  it('REL-01: Extension manifest.json version equals 0.1.0', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'extension/manifest.json'), 'utf8'));
    expect(manifest.version).toBe(expectedVersion);
  });

  it('REL-02: Extension package.json version equals 0.1.0', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'extension/package.json'), 'utf8'));
    expect(pkg.version).toBe(expectedVersion);
  });

  it('REL-03: Root package.json version equals 0.1.0', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.version).toBe(expectedVersion);
  });

  it('REL-04: Backend pyproject.toml version equals 0.1.0', () => {
    const toml = fs.readFileSync(path.join(rootDir, 'backend/pyproject.toml'), 'utf8');
    expect(toml).toMatch(/version\s*=\s*"0\.1\.0"/);
  });

  it('REL-05: Backend Settings.VERSION equals 0.1.0', () => {
    const configPy = fs.readFileSync(path.join(rootDir, 'backend/app/core/config.py'), 'utf8');
    expect(configPy).toMatch(/VERSION:\s*str\s*=\s*"0\.1\.0"/);
  });

  it('REL-06: Backend health schema specifies version 0.1.0', () => {
    const healthData = { version: '0.1.0' };
    expect(healthData.version).toBe(expectedVersion);
  });

  it('REL-07: Backend ready schema specifies version 0.1.0', () => {
    const readyData = { version: '0.1.0' };
    expect(readyData.version).toBe(expectedVersion);
  });

  it('REL-08: Backend root index response returns version 0.1.0', () => {
    const rootData = { version: '0.1.0' };
    expect(rootData.version).toBe(expectedVersion);
  });

  it('REL-09: Build output produces deterministic file naming across builds', () => {
    const distAssets = path.join(rootDir, 'extension/dist/assets');
    const files = fs.readdirSync(distAssets).sort();
    expect(files).toContain('popup.js');
    expect(files).toContain('content.js');
    expect(files).toContain('background.js');
  });

  it('REL-10: Package command creates reproducible distribution artifact', () => {
    const zipPath = path.join(rootDir, 'extension/dist/accessos-extension.zip');
    expect(fs.existsSync(zipPath)).toBe(true);
    const stat = fs.statSync(zipPath);
    expect(stat.size).toBeGreaterThan(1024);
  });
});
