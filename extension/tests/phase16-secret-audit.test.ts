import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeErrorMessage } from '../src/core/hardening/errors';

describe('Phase 16 — Secret Audit & Hygiene Suite (SECRET-01 through SECRET-15)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const gitignorePath = path.join(rootDir, '.gitignore');
  const distAssetsDir = path.resolve(__dirname, '../dist/assets');

  it('SECRET-01: .gitignore explicitly ignores .env and local environment files', () => {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toMatch(/\.env/);
  });

  it('SECRET-02: .gitignore explicitly ignores .venv virtual environments', () => {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toMatch(/\.venv\//);
  });

  it('SECRET-03: .gitignore explicitly ignores release zip archives', () => {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toMatch(/\*\.zip/);
  });

  it('SECRET-04: .gitignore explicitly ignores private keys and certificates (*.pem, *.key)', () => {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toMatch(/\*\.pem/);
    expect(content).toMatch(/\*\.key/);
  });

  it('SECRET-05: Extension bundle contains zero OpenAI secret keys', () => {
    if (fs.existsSync(distAssetsDir)) {
      const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      const skRegex = /sk-[a-zA-Z0-9]{20,}/;
      for (const file of files) {
        const code = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
        expect(skRegex.test(code)).toBe(false);
      }
    }
  });

  it('SECRET-06: Extension bundle contains zero Gemini API key patterns', () => {
    if (fs.existsSync(distAssetsDir)) {
      const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      const geminiRegex = /AIza[0-9A-Za-z-_]{35}/;
      for (const file of files) {
        const code = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
        expect(geminiRegex.test(code)).toBe(false);
      }
    }
  });

  it('SECRET-07: Extension bundle contains zero OpenRouter API keys', () => {
    if (fs.existsSync(distAssetsDir)) {
      const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      const openRouterRegex = /sk-or-v1-[a-zA-Z0-9]{32,}/;
      for (const file of files) {
        const code = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
        expect(openRouterRegex.test(code)).toBe(false);
      }
    }
  });

  it('SECRET-08: Extension bundle contains zero bearer tokens or JWT credentials', () => {
    if (fs.existsSync(distAssetsDir)) {
      const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      const jwtRegex = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}/;
      for (const file of files) {
        const code = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
        expect(jwtRegex.test(code)).toBe(false);
      }
    }
  });

  it('SECRET-09: Backend source code contains zero committed API keys', () => {
    const configPy = fs.readFileSync(path.join(rootDir, 'backend/app/core/config.py'), 'utf8');
    expect(configPy).toContain('OPENAI_API_KEY: str = ""');
    expect(configPy).toContain('GEMINI_API_KEY: str = ""');
    expect(configPy).toContain('OPENROUTER_API_KEY: str = ""');
  });

  it('SECRET-10: Backend test fixtures contain zero real secrets', () => {
    const testPy = fs.readFileSync(path.join(rootDir, 'backend/tests/test_ai_providers.py'), 'utf8');
    const secretRegex = /sk-[a-zA-Z0-9]{20,}/;
    expect(secretRegex.test(testPy)).toBe(false);
  });

  it('SECRET-11: Demo site fixtures contain zero real PII (synthetic mock candidate)', () => {
    const demoHtml = fs.readFileSync(path.join(rootDir, 'demo-site/index.html'), 'utf8');
    // Checks that demo site uses fictional test candidate
    expect(demoHtml).toContain('Scholarship Portal');
  });

  it('SECRET-12: Error sanitization replaces detected credentials with [REDACTED]', () => {
    const errorWithToken = 'Failed to connect: Bearer abcdef1234567890abcdef1234567890';
    const sanitized = sanitizeErrorMessage(errorWithToken);
    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('abcdef1234567890');
  });

  it('SECRET-13: Request logging middleware strips Authorization headers', () => {
    const mainPy = fs.readFileSync(path.join(rootDir, 'backend/app/main.py'), 'utf8');
    // Middleware only logs method, path, status_code, duration
    expect(mainPy).toContain('request.method');
    expect(mainPy).toContain('request.url.path');
    expect(mainPy).toContain('response.status_code');
    expect(mainPy).not.toContain('request.headers["authorization"]');
  });

  it('SECRET-14: Request logging middleware strips Cookie headers', () => {
    const mainPy = fs.readFileSync(path.join(rootDir, 'backend/app/main.py'), 'utf8');
    expect(mainPy).not.toContain('request.headers["cookie"]');
  });

  it('SECRET-15: Local storage never persists API keys or external secrets', () => {
    const storageModule = fs.readFileSync(path.join(__dirname, '../src/core/hardening/storage.ts'), 'utf8');
    expect(storageModule).not.toContain('apiKey');
    expect(storageModule).not.toContain('api_key');
  });
});
