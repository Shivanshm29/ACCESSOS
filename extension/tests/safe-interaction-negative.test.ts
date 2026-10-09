/**
 * Phase 8 Mandatory Negative Tests Suite (NEG-01 to NEG-20)
 *
 * Verifies strict security invariants:
 * - AI is NOT an execution authority.
 * - No arbitrary JS, CSS, XPath, or HTML execution.
 * - Form submission is strictly blocked.
 * - Sensitive fields (password, OTP, CVV, card) cannot be automated.
 * - Autonomous looping / action chaining is prevented.
 * - Stale and cross-page targets are rejected.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import {
  executeInteraction,
  prepareExecutionCommand,
  executeValidatedCommand,
  validateTargetElement,
  validateTargetIdSyntax,
  evaluateInteractionPolicy,
  isSensitiveField,
  isBlockedAction,
  BLOCKED_ACTIONS,
  InteractionConfirmationDialog,
} from '../src/interaction/index';
import type { InteractionIntent, ActionType, ValidatedExecutionCommand } from '../src/interaction/types';

describe('Phase 8 Mandatory Negative Tests Suite (NEG-01 to NEG-30)', () => {
  let doc: Document;

  beforeEach(() => {
    const win = new Window({ url: 'http://localhost:3000/scholarship' });
    doc = win.document as unknown as Document;

    doc.body.innerHTML = `
      <form id="scholarship-form">
        <label for="applicant_name">Full Name</label>
        <input type="text" id="applicant_name" data-accessos-id="acc-name" name="applicant_name" value="" />

        <label for="user_pass">Password</label>
        <input type="password" id="user_pass" data-accessos-id="acc-password" name="password" value="" />

        <label for="otp_code">One Time Password (OTP)</label>
        <input type="text" id="otp_code" data-accessos-id="acc-otp" name="otp_code" placeholder="Enter 6-digit OTP" value="" />

        <label for="card_cvv">Card CVV / Security Code</label>
        <input type="text" id="card_cvv" data-accessos-id="acc-cvv" name="card_cvv" placeholder="CVV" value="" />

        <input type="hidden" id="csrf_token" data-accessos-id="acc-csrf" name="csrf_token" value="secret-token-123" />

        <label for="category_select">Category</label>
        <select id="category_select" data-accessos-id="acc-category">
          <option value="GEN">General</option>
          <option value="OBC">OBC</option>
        </select>

        <button type="submit" id="btn_submit" data-accessos-id="acc-submit">Submit Application</button>
      </form>
    `;
  });

  // NEG-01: AI cannot execute arbitrary JavaScript
  it('NEG-01: AI cannot execute arbitrary JavaScript', async () => {
    const maliciousIntent = {
      actionId: 'malicious-1',
      actionType: 'EXECUTE_SCRIPT' as ActionType,
      targetElementId: 'acc-name',
      value: 'alert(document.cookie);',
    } as unknown as InteractionIntent;

    expect(isBlockedAction('EXECUTE_SCRIPT')).toBe(true);

    const policy = evaluateInteractionPolicy(maliciousIntent);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');

    const result = await executeInteraction(maliciousIntent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
  });

  // NEG-02: AI cannot provide an arbitrary CSS selector
  it('NEG-02: AI cannot provide an arbitrary CSS selector', async () => {
    const maliciousSelectors = [
      '#applicant_name',
      'input[name="applicant_name"]',
      'form > input:first-child',
      '.form-control',
      'div.container input',
    ];

    for (const selector of maliciousSelectors) {
      expect(validateTargetIdSyntax(selector)).toBe(false);
      const res = validateTargetElement(selector, 'TYPE', doc);
      expect(res.valid).toBe(false);
      expect(res.errorStatus).toBe('TARGET_INVALID');
    }
  });

  // NEG-03: AI cannot provide XPath
  it('NEG-03: AI cannot provide XPath', async () => {
    const maliciousXPaths = [
      '//input[@id="applicant_name"]',
      '/html/body/form/input[1]',
      '//button[contains(text(),"Submit")]',
    ];

    for (const xpath of maliciousXPaths) {
      expect(validateTargetIdSyntax(xpath)).toBe(false);
      const res = validateTargetElement(xpath, 'TYPE', doc);
      expect(res.valid).toBe(false);
      expect(res.errorStatus).toBe('TARGET_INVALID');
    }
  });

  // NEG-04: AI cannot target an element using arbitrary DOM traversal
  it('NEG-04: AI cannot target an element using arbitrary DOM traversal', async () => {
    const maliciousTraversals = [
      'document.getElementById("acc-name").parentElement',
      'window.document.forms[0].elements[0]',
      'acc-name/..',
    ];

    for (const expr of maliciousTraversals) {
      expect(validateTargetIdSyntax(expr)).toBe(false);
      const res = validateTargetElement(expr, 'TYPE', doc);
      expect(res.valid).toBe(false);
    }
  });

  // NEG-05: AI cannot type into a password field
  it('NEG-05: AI cannot type into a password field', async () => {
    const passwordEl = doc.querySelector<HTMLInputElement>('#user_pass')!;
    expect(isSensitiveField(passwordEl)).toBe(true);

    const intent: InteractionIntent = {
      actionId: 'pass-1',
      actionType: 'TYPE',
      targetElementId: 'acc-password',
      value: 'MySecretPassword123!',
      source: 'AI_SUGGESTION',
    };

    const policy = evaluateInteractionPolicy(intent, passwordEl);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');
    expect(policy.blockedReason).toContain('sensitive fields');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
    expect(passwordEl.value).toBe('');
  });

  // NEG-06: AI cannot type into an OTP field
  it('NEG-06: AI cannot type into an OTP field', async () => {
    const otpEl = doc.querySelector<HTMLInputElement>('#otp_code')!;
    expect(isSensitiveField(otpEl)).toBe(true);

    const intent: InteractionIntent = {
      actionId: 'otp-1',
      actionType: 'TYPE',
      targetElementId: 'acc-otp',
      value: '123456',
      source: 'AI_SUGGESTION',
    };

    const policy = evaluateInteractionPolicy(intent, otpEl);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
    expect(otpEl.value).toBe('');
  });

  // NEG-07: AI cannot type into a CVV/card field
  it('NEG-07: AI cannot type into a CVV/card field', async () => {
    const cvvEl = doc.querySelector<HTMLInputElement>('#card_cvv')!;
    expect(isSensitiveField(cvvEl)).toBe(true);

    const intent: InteractionIntent = {
      actionId: 'cvv-1',
      actionType: 'TYPE',
      targetElementId: 'acc-cvv',
      value: '888',
      source: 'AI_SUGGESTION',
    };

    const policy = evaluateInteractionPolicy(intent, cvvEl);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
    expect(cvvEl.value).toBe('');
  });

  // NEG-08: AI cannot change a hidden field
  it('NEG-08: AI cannot change a hidden field', async () => {
    const csrfEl = doc.querySelector<HTMLInputElement>('#csrf_token')!;
    const origValue = csrfEl.value;

    const intent: InteractionIntent = {
      actionId: 'hidden-1',
      actionType: 'TYPE',
      targetElementId: 'acc-csrf',
      value: 'tampered-token',
      source: 'AI_SUGGESTION',
    };

    const targetCheck = validateTargetElement('acc-csrf', 'TYPE', doc);
    expect(targetCheck.valid).toBe(false);
    expect(targetCheck.errorStatus).toBe('TARGET_INVALID');
    expect(targetCheck.message).toContain('hidden input');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('TARGET_INVALID');
    expect(result.changed).toBe(false);
    expect(csrfEl.value).toBe(origValue);
  });

  // NEG-09: AI cannot click a submit button
  it('NEG-09: AI cannot click a submit button', async () => {
    // Action 'CLICK_SUBMIT' is strictly blocked
    expect(isBlockedAction('CLICK_SUBMIT')).toBe(true);

    // Furthermore, TYPE on a submit button is rejected by tag/type checks
    const targetCheck = validateTargetElement('acc-submit', 'TYPE', doc);
    expect(targetCheck.valid).toBe(false);
    expect(targetCheck.message).toContain('only allowed on editable text fields');
  });

  // NEG-10: AI cannot call form.submit()
  it('NEG-10: AI cannot call form.submit()', async () => {
    expect(isBlockedAction('SUBMIT')).toBe(true);
    expect(BLOCKED_ACTIONS.has('SUBMIT')).toBe(true);

    const intent = {
      actionId: 'sub-1',
      actionType: 'SUBMIT' as ActionType,
      targetElementId: 'scholarship-form',
    } as unknown as InteractionIntent;

    const policy = evaluateInteractionPolicy(intent);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');
    expect(policy.blockedReason).toContain('strictly blocked');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
  });

  // NEG-11: AI cannot call form.requestSubmit()
  it('NEG-11: AI cannot call form.requestSubmit()', async () => {
    // The executor has zero code calling requestSubmit()
    const formEl = doc.querySelector<HTMLFormElement>('#scholarship-form')!;
    let submitCalled = false;
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      submitCalled = true;
    });

    const intent = {
      actionId: 'req-sub-1',
      actionType: 'SUBMIT' as ActionType,
      targetElementId: 'scholarship-form',
    } as unknown as InteractionIntent;

    await executeInteraction(intent, doc);
    expect(submitCalled).toBe(false);
  });

  // NEG-12: AI cannot dispatch a submit event
  it('NEG-12: AI cannot dispatch a submit event', async () => {
    let submitDispatched = false;
    doc.addEventListener('submit', () => {
      submitDispatched = true;
    });

    // Execute allowable actions
    await executeInteraction(
      {
        actionId: '1',
        actionType: 'TYPE',
        targetElementId: 'acc-name',
        value: 'Test',
        valueSource: 'USER_EXPLICIT',
        source: 'USER',
      },
      doc,
      { confirmed: true }
    );

    await executeInteraction(
      {
        actionId: '2',
        actionType: 'SELECT_OPTION',
        targetElementId: 'acc-category',
        optionValue: 'GEN',
        source: 'USER',
      },
      doc,
      { confirmed: true }
    );

    expect(submitDispatched).toBe(false);
  });

  // NEG-13: AI cannot invent a value and populate it (empty/unsupplied value rejected)
  it('NEG-13: AI cannot invent a value and populate it without explicit approved source', async () => {
    const intentWithoutVal: InteractionIntent = {
      actionId: 'inv-1',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: '', // empty value
      valueSource: 'AI_GENERATED',
      source: 'AI_SUGGESTION',
    };

    const policy = evaluateInteractionPolicy(intentWithoutVal);
    expect(policy.allowed).toBe(false);
    expect(policy.blockedReason).toContain('explicit, non-empty value');

    const intentNullVal: InteractionIntent = {
      actionId: 'inv-2',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: undefined,
      valueSource: 'AI_GENERATED',
      source: 'AI_SUGGESTION',
    };
    const policyNull = evaluateInteractionPolicy(intentNullVal);
    expect(policyNull.allowed).toBe(false);
  });

  // NEG-14: AI cannot bypass user confirmation
  it('NEG-14: AI cannot bypass user confirmation for mutating actions', () => {
    const mutatingIntents: InteractionIntent[] = [
      { actionId: '1', actionType: 'TYPE', targetElementId: 'acc-name', value: 'Val', valueSource: 'USER_EXPLICIT', source: 'USER' },
      { actionId: '2', actionType: 'SELECT_OPTION', targetElementId: 'acc-cat', optionValue: 'OBC', source: 'USER' },
      { actionId: '3', actionType: 'TOGGLE_CHECKBOX', targetElementId: 'acc-chk', checked: true, source: 'USER' },
    ];

    for (const intent of mutatingIntents) {
      const policy = evaluateInteractionPolicy(intent);
      expect(policy.requiresConfirmation).toBe(true);
    }
  });

  // NEG-15: AI cannot execute multiple actions autonomously (engine is strictly atomic)
  it('NEG-15: AI cannot execute multiple actions autonomously (strictly atomic single execution)', async () => {
    // Engine only accepts single InteractionIntent per call, no sequence array API
    const intent: InteractionIntent = {
      actionId: 'single-1',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Alice',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };

    const result = await executeInteraction(intent, doc, { confirmed: true });
    expect(result.actionId).toBe('single-1');
    expect(result.status).toBe('SUCCESS');
    // Result object has exactly one actionId, no sub-actions or batching
    expect((result as unknown as { subActions?: unknown[] }).subActions).toBeUndefined();
  });

  // NEG-16: AI cannot continue after the target becomes stale
  it('NEG-16: AI cannot continue after the target becomes stale', async () => {
    const inputEl = doc.querySelector('[data-accessos-id="acc-name"]')!;
    // Remove element from DOM after intent creation
    inputEl.parentElement?.removeChild(inputEl);

    const intent: InteractionIntent = {
      actionId: 'stale-1',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'New Name',
    };

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('TARGET_NOT_FOUND');
    expect(result.changed).toBe(false);
  });

  // NEG-17: AI cannot act on an element from another page
  it('NEG-17: AI cannot act on an element from another page', async () => {
    const intentFromAnotherPage: InteractionIntent = {
      actionId: 'foreign-1',
      actionType: 'TYPE',
      targetElementId: 'foreign-bank-account-field-999',
      value: '12345678',
    };

    const result = await executeInteraction(intentFromAnotherPage, doc);
    expect(result.status).toBe('TARGET_NOT_FOUND');
    expect(result.changed).toBe(false);
  });

  // NEG-18: AI cannot modify available select options
  it('NEG-18: AI cannot modify available select options', async () => {
    const selectEl = doc.querySelector<HTMLSelectElement>('#category_select')!;
    const originalOptionsCount = selectEl.options.length;

    const intentInventedOption: InteractionIntent = {
      actionId: 'invent-opt-1',
      actionType: 'SELECT_OPTION',
      targetElementId: 'acc-category',
      optionValue: 'INVENTED_CATEGORY_NOT_IN_DOM',
    };

    const result = await executeInteraction(intentInventedOption, doc);
    expect(result.status).toBe('TARGET_INVALID');
    expect(result.changed).toBe(false);
    expect(selectEl.options.length).toBe(originalOptionsCount);
  });

  // NEG-19: AI cannot execute arbitrary model-generated HTML
  it('NEG-19: AI cannot execute arbitrary model-generated HTML', async () => {
    const htmlInjectionValue = '<img src=x onerror="alert(1)">';
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;

    const intent: InteractionIntent = {
      actionId: 'html-inj-1',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: htmlInjectionValue,
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };

    // Value must be assigned via standard input.value (which treats it as plain text literal, not innerHTML)
    const result = await executeInteraction(intent, doc, { confirmed: true });
    expect(result.status).toBe('SUCCESS');
    expect(inputEl.value).toBe(htmlInjectionValue);
    // Verified: No <img> element created inside the DOM
    expect(doc.querySelector('img')).toBeNull();
  });

  // NEG-20: AI cannot turn Explain Anything output into an automatic action
  it('NEG-20: AI cannot turn Explain Anything output into an automatic action', () => {
    // Explain Anything response structure does not implement InteractionIntent
    const explainResponse = {
      explanation: 'This checkbox confirms your declaration.',
      whyItMatters: 'It is required by the portal.',
      example: 'Check the box if truthful.',
    };

    // Passing explainResponse to validator or executor fails TypeScript and runtime
    expect((explainResponse as unknown as InteractionIntent).actionType).toBeUndefined();
    expect((explainResponse as unknown as InteractionIntent).targetElementId).toBeUndefined();

    const policy = evaluateInteractionPolicy(explainResponse as unknown as InteractionIntent);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');
  });

  // NEG-21: AI supplies a plausible personal value with non-empty content but no trusted user provenance -> BLOCKED
  it('NEG-21: AI supplies a plausible personal value with non-empty content but no trusted user provenance -> BLOCKED', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    const origVal = inputEl.value;

    const intent: InteractionIntent = {
      actionId: 'ai-prov-missing',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Shivansh Mishra',
      valueSource: 'NONE',
      source: 'AI_SUGGESTION',
    };

    const policy = evaluateInteractionPolicy(intent);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');
    expect(policy.blockedReason).toContain('USER_EXPLICIT');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
    expect(inputEl.value).toBe(origVal);
  });

  // NEG-22: AI supplies value + attempts to mark it USER_EXPLICIT -> BLOCKED
  it('NEG-22: AI supplies value and attempts to forge USER_EXPLICIT provenance -> BLOCKED', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    const origVal = inputEl.value;

    const intent: InteractionIntent = {
      actionId: 'ai-prov-forged',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Adversarial Name',
      valueSource: 'USER_EXPLICIT',
      source: 'AI_SUGGESTION', // AI attempting to mark its own generation as user-explicit!
    };

    const policy = evaluateInteractionPolicy(intent);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');
    expect(policy.blockedReason).toContain('forge');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
    expect(inputEl.value).toBe(origVal);
  });

  // NEG-23: Missing provenance -> BLOCKED
  it('NEG-23: Missing provenance -> BLOCKED', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    const origVal = inputEl.value;

    const intent: InteractionIntent = {
      actionId: 'missing-prov',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Some Name',
      // valueSource is undefined / omitted
      source: 'USER',
    };

    const policy = evaluateInteractionPolicy(intent);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');

    const result = await executeInteraction(intent, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
    expect(inputEl.value).toBe(origVal);
  });

  // NEG-24: Explicit user-provided value with USER_EXPLICIT provenance -> allowed to reach confirmation, then executes only after confirmation
  it('NEG-24: Explicit user-provided value with USER_EXPLICIT provenance -> executes only after confirmation', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    inputEl.value = '';

    const intent: InteractionIntent = {
      actionId: 'user-explicit-valid',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Priya Sharma',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      requiresConfirmation: true,
    };

    // Before confirmation: unconfirmed execution is blocked!
    const unconfirmedRes = await executeInteraction(intent, doc, { confirmed: false });
    expect(unconfirmedRes.status).toBe('BLOCKED');
    expect(unconfirmedRes.requiresConfirmation).toBe(true);
    expect(unconfirmedRes.changed).toBe(false);
    expect(inputEl.value).toBe('');

    // After explicit confirmation: executes successfully and mutates DOM!
    const confirmedRes = await executeInteraction(intent, doc, { confirmed: true });
    expect(confirmedRes.status).toBe('SUCCESS');
    expect(confirmedRes.changed).toBe(true);
    expect(inputEl.value).toBe('Priya Sharma');
  });

  // NEG-25: Cancel confirmation for a USER_EXPLICIT TYPE -> DOM remains unchanged
  it('NEG-25: Cancel confirmation for a USER_EXPLICIT TYPE -> DOM remains unchanged', () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    inputEl.value = 'Initial';

    const dialog = new InteractionConfirmationDialog();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const intent: InteractionIntent = {
      actionId: 'user-cancel-test',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Replacement Name',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };

    dialog.show({
      intent,
      targetLabel: 'Full Name',
      onConfirm,
      onCancel,
      containerEl: doc.body,
    });

    const cancelBtn = doc.querySelector<HTMLButtonElement>('.accessos-btn-cancel')!;
    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    // Invariant: DOM element remains completely unchanged
    expect(inputEl.value).toBe('Initial');
  });

  // NEG-26: Attempt to invoke the executor with an unvalidated AI intent -> rejected/no DOM mutation
  it('NEG-26: Attempt to invoke the executor with an unvalidated AI intent -> rejected/no DOM mutation', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    inputEl.value = '';

    const unvalidatedAiIntent = {
      actionId: 'unvalidated-ai-1',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Bypassed Name',
      valueSource: 'USER_EXPLICIT',
    };

    // Direct invocation of low-level executor without pipeline command token
    const result = await executeValidatedCommand(unvalidatedAiIntent as unknown as ValidatedExecutionCommand, doc);
    expect(result.status).toBe('NOT_ALLOWED');
    expect(result.changed).toBe(false);
    expect(result.message).toContain('not produced by the validation pipeline');
    expect(inputEl.value).toBe('');
  });

  // NEG-27: Attempt to invoke the executor with a blocked action -> rejected/no DOM mutation
  it('NEG-27: Attempt to invoke the executor with a blocked action -> rejected/no DOM mutation', async () => {
    const forgedSubmitCommand = {
      commandToken: 'cmd_tok_fake_123',
      actionId: 'blocked-act-1',
      actionType: 'SUBMIT' as ActionType,
      targetElementId: 'acc-name',
      targetElement: doc.querySelector('#applicant_name') as HTMLElement,
      requiresConfirmation: false,
      confirmed: true,
      riskLevel: 'BLOCKED' as const,
      timestamp: Date.now(),
    };

    const result = await executeValidatedCommand(forgedSubmitCommand as ValidatedExecutionCommand, doc);
    expect(['BLOCKED', 'NOT_ALLOWED']).toContain(result.status);
    expect(result.changed).toBe(false);
  });

  // NEG-28: Attempt to invoke TYPE executor path with AI_GENERATED value -> rejected/no DOM mutation
  it('NEG-28: Attempt to invoke TYPE executor path with AI_GENERATED value -> rejected/no DOM mutation', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    inputEl.value = '';

    const aiIntent: InteractionIntent = {
      actionId: 'ai-gen-attempt',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Hallucinated',
      valueSource: 'AI_GENERATED',
      source: 'AI_SUGGESTION',
    };

    // Via executeInteraction pipeline
    const result1 = await executeInteraction(aiIntent, doc, { confirmed: true });
    expect(result1.status).toBe('BLOCKED');
    expect(result1.changed).toBe(false);
    expect(inputEl.value).toBe('');

    // Direct execution without valid token also rejected
    const fakeCommand = {
      commandToken: 'fake_token',
      actionId: 'fake',
      actionType: 'TYPE' as ActionType,
      targetElementId: 'acc-name',
      targetElement: inputEl,
      value: 'Hallucinated',
      valueSource: 'AI_GENERATED' as const,
      requiresConfirmation: true,
      confirmed: true,
      riskLevel: 'LOW' as const,
      timestamp: Date.now(),
    };
    const result2 = await executeValidatedCommand(fakeCommand as ValidatedExecutionCommand, doc);
    expect(['BLOCKED', 'NOT_ALLOWED']).toContain(result2.status);
    expect(result2.changed).toBe(false);
    expect(inputEl.value).toBe('');
  });

  // NEG-29: Attempt to invoke executor with stale target -> rejected/no DOM mutation
  it('NEG-29: Attempt to invoke executor with stale target -> rejected/no DOM mutation', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;

    // Prepare valid command while attached
    const intent: InteractionIntent = {
      actionId: 'stale-cmd-1',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'Valid Value',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };

    const prep = prepareExecutionCommand(intent, doc, { confirmed: true });
    expect(prep.valid).toBe(true);
    expect(prep.command).toBeDefined();

    // Now detach element from DOM (creating staleness AFTER command generation)
    inputEl.parentElement?.removeChild(inputEl);

    // Invoke executor with stale command
    const result = await executeValidatedCommand(prep.command!, doc);
    expect(result.status).toBe('TARGET_NOT_FOUND');
    expect(result.changed).toBe(false);
  });

  // NEG-30: Attempt to bypass confirmation and directly execute a mutating command -> rejected/no DOM mutation
  it('NEG-30: Attempt to bypass confirmation and directly execute a mutating command -> rejected/no DOM mutation', async () => {
    const inputEl = doc.querySelector<HTMLInputElement>('#applicant_name')!;
    inputEl.value = 'BeforeBypass';

    const mutatingIntent: InteractionIntent = {
      actionId: 'bypass-confirm-1',
      actionType: 'TYPE',
      targetElementId: 'acc-name',
      value: 'BypassedValue',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      requiresConfirmation: true,
    };

    // Prepare command WITHOUT confirmation
    const prep = prepareExecutionCommand(mutatingIntent, doc, { confirmed: false });
    expect(prep.valid).toBe(true);
    expect(prep.command?.confirmed).toBe(false);

    // Directly attempt to execute the unconfirmed command
    const result = await executeValidatedCommand(prep.command!, doc);
    expect(result.status).toBe('BLOCKED');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.changed).toBe(false);
    expect(inputEl.value).toBe('BeforeBypass');
  });
});
