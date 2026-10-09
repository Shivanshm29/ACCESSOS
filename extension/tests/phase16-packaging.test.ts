import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readZipNames(zipPath: string): string[] {
  const buf = fs.readFileSync(zipPath);
  const names: string[] = [];
  let pos = 0;

  while (pos < buf.length - 4) {
    const sig = buf.readUInt32LE(pos);
    if (sig === 0x04034b50) {
      // Local file header
      const nameLen = buf.readUInt16LE(pos + 26);
      const extraLen = buf.readUInt16LE(pos + 28);
      const compressedSize = buf.readUInt32LE(pos + 18);
      const name = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
      names.push(name);
      pos += 30 + nameLen + extraLen + compressedSize;
    } else {
      pos++;
    }
  }
  return names;
}

describe('Phase 16 — Extension Packaging & Bundle Hygiene Suite (PKG-01 through PKG-15)', () => {
  const zipPath = path.resolve(__dirname, '../dist/accessos-extension.zip');
  let zipFiles: string[] = [];

  it('PKG-01: Distributable zip archive exists at dist/accessos-extension.zip', () => {
    expect(fs.existsSync(zipPath)).toBe(true);
    zipFiles = readZipNames(zipPath);
    expect(zipFiles.length).toBeGreaterThan(0);
  });

  it('PKG-02: Zip archive contains root manifest.json', () => {
    expect(zipFiles).toContain('manifest.json');
  });

  it('PKG-03: Zip archive contains assets/background.js', () => {
    expect(zipFiles).toContain('assets/background.js');
  });

  it('PKG-04: Zip archive contains assets/content.js', () => {
    expect(zipFiles).toContain('assets/content.js');
  });

  it('PKG-05: Zip archive contains assets/popup.js', () => {
    expect(zipFiles).toContain('assets/popup.js');
  });

  it('PKG-06: Zip archive contains src/popup/popup.html', () => {
    expect(zipFiles).toContain('src/popup/popup.html');
  });

  it('PKG-07: Zip archive contains extension icons (16, 48, 128)', () => {
    expect(zipFiles).toContain('icons/icon16.png');
    expect(zipFiles).toContain('icons/icon48.png');
    expect(zipFiles).toContain('icons/icon128.png');
  });

  it('PKG-08: Zip archive contains zero .ts TypeScript source files', () => {
    const tsFiles = zipFiles.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
    expect(tsFiles).toHaveLength(0);
  });

  it('PKG-09: Zip archive contains zero .test. or test files', () => {
    const testFiles = zipFiles.filter((f) => f.includes('.test.') || f.includes('.spec.'));
    expect(testFiles).toHaveLength(0);
  });

  it('PKG-10: Zip archive contains zero .env or secret config files', () => {
    const envFiles = zipFiles.filter((f) => f.startsWith('.env') || f.endsWith('.env'));
    expect(envFiles).toHaveLength(0);
  });

  it('PKG-11: Zip archive contains zero .git repository metadata', () => {
    const gitFiles = zipFiles.filter((f) => f.includes('.git'));
    expect(gitFiles).toHaveLength(0);
  });

  it('PKG-12: Zip archive contains zero .map sourcemap files containing credentials', () => {
    const mapFiles = zipFiles.filter((f) => f.endsWith('.map'));
    expect(mapFiles).toHaveLength(0);
  });

  it('PKG-13: Package manifest has valid Manifest V3 structure', () => {
    const manifestPath = path.resolve(__dirname, '../dist/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('ACCESSOS');
    expect(manifest.version).toBe('0.1.0');
  });

  it('PKG-14: Package manifest permissions strictly match minimal model', () => {
    const manifestPath = path.resolve(__dirname, '../dist/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.permissions).toEqual(['storage', 'activeTab']);
  });

  it('PKG-15: Total uncompressed bundle size is bounded (< 5MB) for performance', () => {
    const distDir = path.resolve(__dirname, '../dist');
    let totalBytes = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && !entry.name.endsWith('.zip')) {
          totalBytes += fs.statSync(full).size;
        }
      }
    };
    walk(distDir);
    expect(totalBytes).toBeLessThan(5 * 1024 * 1024); // Less than 5 MB
    expect(totalBytes).toBeGreaterThan(10 * 1024);     // Sanity check
  });
});
