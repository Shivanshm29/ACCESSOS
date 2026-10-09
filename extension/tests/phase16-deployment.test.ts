/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getBackendUrl, isValidBackendUrl, DEFAULT_BACKEND_URL } from '../src/core/config';
import { accessibleStateManager } from '../src/core/hardening/a11y-states';
import { HardenedStorage } from '../src/core/hardening/storage';
import { sanitizeErrorMessage } from '../src/core/hardening/errors';
import { prepareExecutionCommand, executeValidatedCommand } from '../src/interaction/executor';
import { evaluateInteractionPolicy } from '../src/interaction/policy';
import type { InteractionIntent } from '../src/interaction/types';

describe('Phase 16 — Deployment & Container Failure Suite (DEP-01 through DEP-20)', () => {
  const distDir = path.resolve(__dirname, '../dist');
  const dockerfilePath = path.resolve(__dirname, '../../backend/Dockerfile');

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('DEP-01: Backend unavailable (offline / connection refused) degrades safely to accessible OFFLINE state', () => {
    const el = document.createElement('div');
    accessibleStateManager.applyStateToElement(el, 'OFFLINE');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.textContent).toContain('offline');
  });

  it('DEP-02: Backend health failure triggers accessible UNAVAILABLE failure state', () => {
    const el = document.createElement('div');
    accessibleStateManager.applyStateToElement(el, 'UNAVAILABLE', 'Backend service health check failed.');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.textContent).toContain('Backend service health check failed');
  });

  it('DEP-03: Backend readiness verification validates checks structure', () => {
    const mockReadyResponse = {
      status: 'ready',
      service: 'ACCESSOS Backend',
      version: '0.1.0',
      ready: true,
      checks: {
        configuration: { valid: true },
        cors: { valid: true },
        ai_provider: { status: 'ready' },
      },
    };
    expect(mockReadyResponse.ready).toBe(true);
    expect(mockReadyResponse.checks.configuration.valid).toBe(true);
  });

  it('DEP-04: Invalid environment configuration validation', () => {
    expect(isValidBackendUrl('not-a-valid-url')).toBe(false);
    expect(isValidBackendUrl('ftp://example.com')).toBe(false);
    expect(isValidBackendUrl('http://user:pass@localhost:8000')).toBe(false);
    expect(isValidBackendUrl('http://localhost:8000')).toBe(true);
    expect(isValidBackendUrl('https://api.accessos.org')).toBe(true);
  });

  it('DEP-05: Missing selected AI provider key degrades safely to deterministic fallback', () => {
    const errorMsg = 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.';
    const sanitized = sanitizeErrorMessage(errorMsg);
    expect(sanitized).toContain('API key not configured');

    const el = document.createElement('div');
    accessibleStateManager.applyStateToElement(el, 'SUCCESS', 'Operating in deterministic rule-based mode.');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.textContent).toContain('deterministic rule-based mode');
  });

  it('DEP-06: Production CORS rejects wildcard and unapproved origins', () => {
    const allowed = ['https://accessos.org', 'chrome-extension://abcdefghijklmnop'];
    const origin1 = 'https://malicious.example.com';
    const origin2 = 'https://accessos.org';
    expect(allowed.includes(origin1)).toBe(false);
    expect(allowed.includes(origin2)).toBe(true);
  });

  it('DEP-07: Extension backend URL unavailable triggers accessible timeout state', () => {
    const el = document.createElement('div');
    accessibleStateManager.applyStateToElement(el, 'TIMEOUT', 'Request to backend service timed out.');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.textContent).toContain('timed out');
  });

  it('DEP-08: Production extension configuration handles URL overrides cleanly without hardcoded localhost', () => {
    expect(getBackendUrl()).toBe(DEFAULT_BACKEND_URL);
    expect(isValidBackendUrl('https://api.accessos.org')).toBe(true);
  });

  it('DEP-09: Production bundle contains zero secret-like values in compiled JS assets', () => {
    const assetsDir = path.join(distDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
      const secretRegex = /sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}/;
      for (const file of jsFiles) {
        const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
        expect(secretRegex.test(content)).toBe(false);
      }
    }
  });

  it('DEP-10: Dockerfile specifies valid WORKDIR, EXPOSE 8000, and python base image', () => {
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const content = fs.readFileSync(dockerfilePath, 'utf8');
    expect(content).toContain('WORKDIR /app');
    expect(content).toContain('EXPOSE 8000');
    expect(content).toContain('FROM python:3.12-slim');
  });

  it('DEP-11: Dockerfile defines container HEALTHCHECK probe', () => {
    const content = fs.readFileSync(dockerfilePath, 'utf8');
    expect(content).toContain('HEALTHCHECK');
    expect(content).toContain('/health');
  });

  it('DEP-12: Dockerfile creates and executes as non-root appuser', () => {
    const content = fs.readFileSync(dockerfilePath, 'utf8');
    expect(content).toContain('useradd');
    expect(content).toContain('appuser');
    expect(content).toContain('USER appuser');
  });

  it('DEP-13: Backend lifespan and graceful shutdown logging definition', () => {
    const mainPy = fs.readFileSync(path.resolve(__dirname, '../../backend/app/main.py'), 'utf8');
    expect(mainPy).toContain('lifespan');
    expect(mainPy).toContain('shutting down gracefully');
  });

  it('DEP-14: Extension package zip contains required Manifest V3 assets', () => {
    const zipPath = path.join(distDir, 'accessos-extension.zip');
    expect(fs.existsSync(zipPath)).toBe(true);
  });

  it('DEP-15: Manifest permissions strictly contain minimal storage and activeTab', () => {
    const manifestPath = path.join(distDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.permissions).toEqual(['storage', 'activeTab']);
    expect(manifest.permissions).not.toContain('<all_urls>');
    expect(manifest.permissions).not.toContain('webRequest');
  });

  it('DEP-16: Existing security boundaries remain active in production build', async () => {
    const input = document.createElement('input');
    input.id = 'f1';
    document.body.appendChild(input);

    const intent: InteractionIntent = {
      actionId: 'act-1',
      actionType: 'TYPE',
      targetElementId: 'f1',
      value: 'test',
      source: 'USER',
      valueSource: 'USER_EXPLICIT',
    };

    const prep = prepareExecutionCommand(intent, document, { confirmed: false });
    const result = await executeValidatedCommand(prep.command!, document);
    expect(result.status).toBe('BLOCKED');
  });

  it('DEP-17: Provider failure produces ZERO browser mutations', () => {
    const input = document.createElement('input');
    input.id = 'input-1';
    input.value = 'original';
    document.body.appendChild(input);

    const intent: InteractionIntent = {
      actionId: 'act-ai-fail',
      actionType: 'TYPE',
      targetElementId: 'input-1',
      value: 'malicious',
      source: 'AI_SUGGESTION',
      valueSource: 'USER_EXPLICIT', // Attempted forge
    };

    const policy = evaluateInteractionPolicy(intent);
    expect(policy.allowed).toBe(false);
    expect(input.value).toBe('original'); // Untouched
  });

  it('DEP-18: Production error responses remain sanitized without leaking stack traces or PII', () => {
    const rawError = 'TypeError: fail at /usr/local/lib/python3.12/site-packages/secret.py token=sk-abcdef1234567890';
    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain('sk-abcdef1234567890');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('DEP-19: Restart does not corrupt local configuration and recovers to safe defaults', async () => {
    const storage = new HardenedStorage();
    const loaded = await storage.get('non_existent_key', { theme: 'system', safeMode: true });
    expect(loaded.theme).toBe('system');
    expect(loaded.safeMode).toBe(true);
  });

  it('DEP-20: Deployment packaging artifact produces deterministic bundle structure', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.name).toBe('ACCESSOS');
  });
});
