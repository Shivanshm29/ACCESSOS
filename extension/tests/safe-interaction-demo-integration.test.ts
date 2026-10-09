/**
 * Phase 8 Demo Site Integration Tests
 * Validates the Safe Interaction Engine against the real National Student Scholarship Portal DOM:
 * demo-site/index.html -> extractPageRepresentation -> validate -> confirm -> execute -> verify
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import {
  executeInteraction,
  evaluateInteractionPolicy,
  isSensitiveField,
  InteractionConfirmationDialog,
} from '../src/interaction/index';
import type { InteractionIntent } from '../src/interaction/types';
import type { PageRepresentation } from '../src/core/types/representation';

describe('Phase 8 Demo Site Safe Interaction Integration Suite', () => {
  let demoDoc: Document;
  let demoLocation: Location;
  let representation: PageRepresentation;

  beforeEach(() => {
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    const demoWindow = new Window({ url: 'http://localhost:3000/' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);
    demoLocation = demoWindow.location as unknown as Location;

    // Run semantic extraction to assign stable data-accessos-id attributes
    representation = extractPageRepresentation(demoDoc, demoLocation);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Safely executes TYPE on Applicant Full Name and leaves other fields intact', async () => {
    const nameField = representation.fields.find((f) => f.name === 'applicant_full_name');
    expect(nameField).toBeDefined();

    const nameEl = demoDoc.querySelector<HTMLInputElement>(`[data-accessos-id="${nameField!.id}"]`)!;
    expect(nameEl).not.toBeNull();
    expect(nameEl.value).toBe('');

    const emailEl = demoDoc.querySelector<HTMLInputElement>('#applicant_email')!;
    expect(emailEl.value).toBe('');

    const intent: InteractionIntent = {
      actionId: 'act-type-demo-1',
      actionType: 'TYPE',
      targetElementId: nameField!.id,
      value: 'Devansh Varma',
      valueSource: 'USER_EXPLICIT',
      reason: 'Enter primary applicant name',
      riskLevel: 'LOW',
      requiresConfirmation: true,
      source: 'USER',
    };

    // Policy check
    const policy = evaluateInteractionPolicy(intent, nameEl);
    expect(policy.allowed).toBe(true);
    expect(policy.requiresConfirmation).toBe(true);

    // Execution
    const result = await executeInteraction(intent, demoDoc, { confirmed: true });
    expect(result.status).toBe('SUCCESS');
    expect(result.changed).toBe(true);
    expect(nameEl.value).toBe('Devansh Varma');

    // Invariant: other fields must remain untouched
    expect(emailEl.value).toBe('');
  });

  it('2. Safely executes SELECT_OPTION on Gender Classification dropdown', async () => {
    const genderField = representation.fields.find((f) => f.name === 'applicant_gender');
    expect(genderField).toBeDefined();

    const genderEl = demoDoc.querySelector<HTMLSelectElement>(`[data-accessos-id="${genderField!.id}"]`)!;
    expect(genderEl).not.toBeNull();
    expect(genderEl.value).toBe('');

    const intent: InteractionIntent = {
      actionId: 'act-select-demo-1',
      actionType: 'SELECT_OPTION',
      targetElementId: genderField!.id,
      optionValue: 'female',
      reason: 'Select gender classification',
      riskLevel: 'LOW',
      requiresConfirmation: true,
      source: 'USER',
    };

    const result = await executeInteraction(intent, demoDoc, { confirmed: true });
    expect(result.status).toBe('SUCCESS');
    expect(result.changed).toBe(true);
    expect(genderEl.value).toBe('female');
  });

  it('3. Safely executes TOGGLE_CHECKBOX on truthful declaration checkbox in Section 8', async () => {
    const declField = representation.fields.find((f) => f.name === 'decl_truthful_info');
    expect(declField).toBeDefined();

    const declEl = demoDoc.querySelector<HTMLInputElement>(`[data-accessos-id="${declField!.id}"]`)!;
    expect(declEl).not.toBeNull();
    expect(declEl.checked).toBe(false);

    const intent: InteractionIntent = {
      actionId: 'act-check-demo-1',
      actionType: 'TOGGLE_CHECKBOX',
      targetElementId: declField!.id,
      checked: true,
      reason: 'Confirm truthfulness of submitted details',
      riskLevel: 'LOW',
      requiresConfirmation: true,
      source: 'USER',
    };

    const result = await executeInteraction(intent, demoDoc, { confirmed: true });
    expect(result.status).toBe('SUCCESS');
    expect(result.changed).toBe(true);
    expect(declEl.checked).toBe(true);
  });

  it('4. Safely executes FOCUS on Mobile Number field without mutating its value', async () => {
    const mobileField = representation.fields.find((f) => f.name === 'applicant_mobile');
    expect(mobileField).toBeDefined();

    const mobileEl = demoDoc.querySelector<HTMLInputElement>(`[data-accessos-id="${mobileField!.id}"]`)!;
    expect(mobileEl).not.toBeNull();
    const origVal = mobileEl.value;

    const intent: InteractionIntent = {
      actionId: 'act-focus-demo-1',
      actionType: 'FOCUS',
      targetElementId: mobileField!.id,
      source: 'GUIDED_MODE',
    };

    const result = await executeInteraction(intent, demoDoc);
    expect(result.status).toBe('SUCCESS');
    expect(result.changed).toBe(false);
    expect(mobileEl.value).toBe(origVal);
  });

  it('5. Strictly blocks automated TYPE into sensitive Bank Account Number field', async () => {
    const bankAccountEl = demoDoc.querySelector<HTMLInputElement>('#bank_account_number')!;
    expect(bankAccountEl).not.toBeNull();
    expect(isSensitiveField(bankAccountEl)).toBe(true);

    const bankField = representation.fields.find((f) => f.name === 'bank_account_number');
    const targetId = bankField ? bankField.id : 'bank_account_number';

    const intent: InteractionIntent = {
      actionId: 'act-bank-1',
      actionType: 'TYPE',
      targetElementId: targetId,
      value: '987654321098',
      source: 'AI_SUGGESTION',
    };

    const policy = evaluateInteractionPolicy(intent, bankAccountEl);
    expect(policy.allowed).toBe(false);
    expect(policy.riskLevel).toBe('BLOCKED');
    expect(policy.blockedReason).toContain('sensitive fields');

    const result = await executeInteraction(intent, demoDoc);
    expect(result.status).toBe('BLOCKED');
    expect(result.changed).toBe(false);
    expect(bankAccountEl.value).toBe('');
  });

  it('6. Strictly blocks automated clicking or typing into Submit button', async () => {
    const submitBtn = demoDoc.querySelector<HTMLButtonElement>('#btn-submit-application')!;
    expect(submitBtn).not.toBeNull();

    // Finding representation button or ID
    const intent: InteractionIntent = {
      actionId: 'act-sub-1',
      actionType: 'TYPE',
      targetElementId: 'btn-submit-application',
      value: 'Submit',
    };

    const res = await executeInteraction(intent, demoDoc);
    expect(res.status).toBe('TARGET_INVALID');
    expect(res.message).toContain('only allowed on editable text fields');
  });

  it('7. Safely rejects non-existent and stale target elements on demo portal', async () => {
    const intent: InteractionIntent = {
      actionId: 'act-missing-1',
      actionType: 'TYPE',
      targetElementId: 'accessos-field-999-missing',
      value: 'Test',
    };

    const res = await executeInteraction(intent, demoDoc);
    expect(res.status).toBe('TARGET_NOT_FOUND');
    expect(res.changed).toBe(false);
  });

  it('8. Operates accessible confirmation dialog in demo portal context', () => {
    const dialog = new InteractionConfirmationDialog();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const intent: InteractionIntent = {
      actionId: 'act-confirm-demo-1',
      actionType: 'TYPE',
      targetElementId: 'applicant_full_name',
      value: 'Devansh Varma',
      reason: 'Required primary name',
      riskLevel: 'LOW',
    };

    const modal = dialog.show({
      intent,
      targetLabel: 'Full Legal Name',
      onConfirm,
      onCancel,
      containerEl: demoDoc.body,
    });

    expect(demoDoc.body.contains(modal)).toBe(true);
    expect(modal.getAttribute('role')).toBe('alertdialog');
    expect(modal.textContent).toContain('Full Legal Name');
    expect(modal.textContent).toContain('Devansh Varma');

    // Simulate Escape key dismissal
    const KeyboardEventCtor = (demoDoc.defaultView as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent;
    const escEvent = new KeyboardEventCtor('keydown', { key: 'Escape', bubbles: true });
    demoDoc.dispatchEvent(escEvent);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(demoDoc.body.contains(modal)).toBe(false);
  });
});
