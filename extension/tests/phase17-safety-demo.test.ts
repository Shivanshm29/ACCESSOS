/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import {
  prepareExecutionCommand,
  executeValidatedCommand,
  validateTargetElement,
  validateTargetIdSyntax,
  evaluateInteractionPolicy,
  isBlockedAction,
  isSensitiveField,
} from '../src/interaction/index';
import type { InteractionIntent } from '../src/interaction/types';
import { DemoHealthChecker } from '../src/demo/health';

describe('Phase 17 — Safety & Trust Boundary Demo Suite (SAFETYDEMO-01 through SAFETYDEMO-15)', () => {
  let doc: Document;

  beforeEach(() => {
    const win = new Window({ url: 'http://localhost:3000/' });
    doc = win.document as unknown as Document;

    doc.body.innerHTML = `
      <form id="scholarship-form">
        <label for="first_name">First Name</label>
        <input type="text" id="first_name" data-accessos-id="acc-first-name" name="first_name" value="" />

        <label for="acc_password">Portal Password</label>
        <input type="password" id="acc_password" data-accessos-id="acc-password" name="password" />

        <label for="acc_bank_pin">Bank Account PIN</label>
        <input type="text" id="acc_bank_pin" data-accessos-id="acc-bank-pin" name="bank_pin" autocomplete="off" />

        <label for="doc_marksheet">Upload Marksheet</label>
        <input type="file" id="doc_marksheet" data-accessos-id="acc-doc-marksheet" name="doc_marksheet" />

        <button type="submit" id="btn-submit-app" data-accessos-id="acc-btn-submit">Final Submit</button>
      </form>
    `;
  });

  it('SAFETYDEMO-01: Safe interaction requires USER_EXPLICIT provenance for TYPE actions', () => {
    const intent: InteractionIntent = {
      actionId: 'safe-type-01',
      actionType: 'TYPE',
      targetElementId: 'acc-first-name',
      value: 'Aarav',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };
    const policy = evaluateInteractionPolicy(intent, doc);
    expect(policy.allowed).toBe(true);
    expect(policy.requiresConfirmation).toBe(true);
  });

  it('SAFETYDEMO-02: AI-generated values cannot forge USER_EXPLICIT provenance (AI_GENERATED is rejected)', () => {
    const intent: InteractionIntent = {
      actionId: 'ai-type-02',
      actionType: 'TYPE',
      targetElementId: 'acc-first-name',
      value: 'Hallucinated Name',
      valueSource: 'AI_GENERATED',
      source: 'AI_SUGGESTION',
    };
    const policy = evaluateInteractionPolicy(intent, doc);
    expect(policy.allowed).toBe(false);
    expect(policy.blockedReason).toContain('USER_EXPLICIT');
  });

  it('SAFETYDEMO-03: Document-derived values cannot forge USER_EXPLICIT provenance (DOCUMENT_DERIVED is rejected)', () => {
    const intent: InteractionIntent = {
      actionId: 'doc-type-03',
      actionType: 'TYPE',
      targetElementId: 'acc-first-name',
      value: 'Extracted From PDF',
      valueSource: 'DOCUMENT_DERIVED' as any,
      source: 'DOCUMENT_ANALYSIS' as any,
    };
    const policy = evaluateInteractionPolicy(intent, doc);
    expect(policy.allowed).toBe(false);
    expect(policy.blockedReason).toContain('USER_EXPLICIT');
  });

  it('SAFETYDEMO-04: Capability token is mandatory for executing browser interaction', async () => {
    const intent: InteractionIntent = {
      actionId: 'cap-token-04',
      actionType: 'TYPE',
      targetElementId: 'acc-first-name',
      value: 'Aarav',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };
    const prep = prepareExecutionCommand(intent, doc, { confirmed: true });
    expect(prep.valid).toBe(true);
    expect(prep.command).toBeDefined();
    expect(prep.command?.commandToken).toBeDefined();
    expect(prep.command?.commandToken.length).toBeGreaterThan(10);
  });

  it('SAFETYDEMO-05: Capability tokens are single-use; replay attempts fail immediately', async () => {
    const intent: InteractionIntent = {
      actionId: 'token-replay-05',
      actionType: 'TYPE',
      targetElementId: 'acc-first-name',
      value: 'Aarav',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };
    const prep = prepareExecutionCommand(intent, doc, { confirmed: true });
    expect(prep.valid).toBe(true);

    // First execution succeeds
    const res1 = await executeValidatedCommand(prep.command!, doc);
    expect(res1.status).toBe('SUCCESS');

    // Second execution with identical token fails (token consumed)
    const res2 = await executeValidatedCommand(prep.command!, doc);
    expect(res2.status).toBe('NOT_ALLOWED');
    expect(res2.message).toContain('Direct unvalidated execution is strictly forbidden');
  });

  it('SAFETYDEMO-06: Consequential SUBMIT operations are unconditionally blocked', () => {
    expect(isBlockedAction('SUBMIT')).toBe(true);
    expect(isBlockedAction('CLICK_SUBMIT')).toBe(true);

    const submitIntent: InteractionIntent = {
      actionId: 'submit-06',
      actionType: 'SUBMIT' as any,
      targetElementId: 'acc-btn-submit',
      source: 'USER',
    };
    const policy = evaluateInteractionPolicy(submitIntent, doc);
    expect(policy.allowed).toBe(false);
    expect(policy.blockedReason).toContain('strictly blocked in Phase 8');
  });

  it('SAFETYDEMO-07: File UPLOAD operations are unconditionally blocked from automated execution', () => {
    expect(isBlockedAction('UPLOAD')).toBe(true);

    const uploadIntent: InteractionIntent = {
      actionId: 'upload-07',
      actionType: 'UPLOAD' as any,
      targetElementId: 'acc-doc-marksheet',
      source: 'USER',
    };
    const policy = evaluateInteractionPolicy(uploadIntent, doc);
    expect(policy.allowed).toBe(false);
    expect(policy.blockedReason).toContain('strictly blocked in Phase 8');
  });

  it('SAFETYDEMO-08: Sensitive password and financial input fields are blocked by policy', () => {
    const pwdEl = doc.querySelector<HTMLInputElement>('#acc_password')!;
    expect(isSensitiveField(pwdEl)).toBe(true);

    const pinEl = doc.querySelector<HTMLInputElement>('#acc_bank_pin')!;
    expect(isSensitiveField(pinEl)).toBe(true);

    const pwdIntent: InteractionIntent = {
      actionId: 'pwd-08',
      actionType: 'TYPE',
      targetElementId: 'acc-password',
      value: 'Secret123',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };
    const policy = evaluateInteractionPolicy(pwdIntent, doc);
    expect(policy.allowed).toBe(false);
    expect(policy.blockedReason).toContain('sensitive fields');
  });

  it('SAFETYDEMO-09: Arbitrary CSS selector targeting outside allowed IDs is rejected', () => {
    expect(validateTargetIdSyntax('input[name="first_name"]')).toBe(false);
    expect(validateTargetIdSyntax('#first_name > div')).toBe(false);
    expect(validateTargetIdSyntax('.btn-primary')).toBe(false);
  });

  it('SAFETYDEMO-10: Arbitrary XPath execution is blocked', () => {
    expect(validateTargetIdSyntax('//input[@id="first_name"]')).toBe(false);
    expect(validateTargetIdSyntax('//button[text()="Submit"]')).toBe(false);
  });

  it('SAFETYDEMO-11: Phase 8 remains sole mutation authority; unvalidated elements are rejected', () => {
    const res = validateTargetElement('non-existent-id', 'TYPE', doc);
    expect(res.valid).toBe(false);
    expect(res.errorStatus).toBe('TARGET_NOT_FOUND');
  });

  it('SAFETYDEMO-12: Multi-step autonomous chains are blocked; requiresConfirmation is true for mutating actions', () => {
    const mutatingActions: InteractionIntent[] = [
      { actionId: 'm1', actionType: 'TYPE', targetElementId: 'acc-first-name', value: 'Test', valueSource: 'USER_EXPLICIT' },
      { actionId: 'm2', actionType: 'SELECT_OPTION', targetElementId: 'acc-category', optionValue: 'OBC' },
      { actionId: 'm3', actionType: 'TOGGLE_CHECKBOX', targetElementId: 'acc-declaration', checked: true },
    ];

    mutatingActions.forEach((intent) => {
      const policy = evaluateInteractionPolicy(intent, doc);
      expect(policy.requiresConfirmation).toBe(true);
    });
  });

  it('SAFETYDEMO-13: Demo health check verifies all 10 operational invariants', async () => {
    // Mock healthy fetch
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'healthy', version: '0.1.0' }),
        });
      }
      if (url.endsWith('/ready')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'ready',
            ready: true,
            checks: {
              configuration: { valid: true },
              cors: { valid: true },
              ai_provider: { status: 'ready' },
            },
          }),
        });
      }
      if (url.includes(':3000')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('<html>demo</html>') });
      }
      return Promise.reject(new Error('Unknown url'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const checker = new DemoHealthChecker('http://localhost:8000');
    const result = await checker.runHealthCheck();

    expect(result.totalCount).toBe(10);
    expect(result.checks.length).toBe(10);
    expect(result.overallStatus).toBe('DEMO READY');
  });

  it('SAFETYDEMO-14: Demo health check reports DEMO NOT READY when dependencies fail', async () => {
    // Mock offline fetch
    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', fetchMock);

    const checker = new DemoHealthChecker('http://localhost:9999');
    const result = await checker.runHealthCheck();

    expect(result.overallStatus).toBe('DEMO NOT READY');
    expect(result.passedCount).toBeLessThan(result.totalCount);
    const check1 = result.checks.find((c) => c.id === 'CHECK-01');
    expect(check1?.passed).toBe(false);
  });

  it('SAFETYDEMO-15: System safely handles predictable runtime failures (DEMO-ERR-01..10) without uncaught exceptions', async () => {
    // Unconfirmed mutating interaction should fail gracefully upon execution
    const unconfirmedIntent: InteractionIntent = {
      actionId: 'err-01',
      actionType: 'TYPE',
      targetElementId: 'acc-first-name',
      value: 'Unconfirmed',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };
    const prep = prepareExecutionCommand(unconfirmedIntent, doc, { confirmed: false });
    expect(prep.valid).toBe(true); // Token prepared with confirmed=false
    const res = await executeValidatedCommand(prep.command!, doc);
    expect(res.status).toBe('BLOCKED');
    expect(res.message).toContain('explicit user confirmation');

    // Stale element target failure
    const staleIntent: InteractionIntent = {
      actionId: 'err-02',
      actionType: 'TYPE',
      targetElementId: 'stale-elem-xyz',
      value: 'Val',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };
    const prepStale = prepareExecutionCommand(staleIntent, doc, { confirmed: true });
    expect(prepStale.valid).toBe(false);
    expect(prepStale.errorStatus).toBe('TARGET_NOT_FOUND');
  });
});
