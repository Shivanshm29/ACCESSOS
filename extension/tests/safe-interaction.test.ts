/**
 * Phase 8 Safe Interaction Engine Unit Tests
 * Tests allowed atomic interactions, target validation, policy enforcement,
 * user confirmation dialog, and execution result verification.
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
  InteractionConfirmationDialog,
} from '../src/interaction/index';
import type { InteractionIntent } from '../src/interaction/types';
import { HIGHLIGHT_CLASS } from '../src/content/highlighter';

describe('Safe Interaction Engine Core Suite', () => {
  let doc: Document;

  beforeEach(() => {
    const win = new Window({ url: 'http://localhost:3000/' });
    doc = win.document as unknown as Document;

    doc.body.innerHTML = `
      <form id="app-form">
        <label for="applicant_name">Full Name</label>
        <input type="text" id="applicant_name" data-accessos-id="acc-name" name="applicant_name" value="" />

        <label for="applicant_email">Email</label>
        <input type="email" id="applicant_email" data-accessos-id="acc-email" name="applicant_email" value="" />

        <label for="applicant_category">Category</label>
        <select id="applicant_category" data-accessos-id="acc-category" name="applicant_category">
          <option value="">Select Category</option>
          <option value="GENERAL">General</option>
          <option value="OBC">Other Backward Class</option>
          <option value="SC">Scheduled Caste</option>
          <option value="ST" disabled>Scheduled Tribe (Disabled)</option>
        </select>

        <label for="applicant_declaration">
          <input type="checkbox" id="applicant_declaration" data-accessos-id="acc-declaration" name="applicant_declaration" />
          I declare that information is accurate
        </label>

        <label for="disabled_field">Disabled Field</label>
        <input type="text" id="disabled_field" data-accessos-id="acc-disabled" disabled value="Fixed" />

        <label for="hidden_field">Hidden Field</label>
        <input type="text" id="hidden_field" data-accessos-id="acc-hidden" style="display: none;" value="" />

        <button type="button" id="regular_btn" data-accessos-id="acc-btn">Action Button</button>
        <button type="submit" id="submit_btn" data-accessos-id="acc-submit">Submit Application</button>
      </form>
    `;
  });

  describe('1. Target ID Syntax Validation', () => {
    it('accepts valid stable ACCESSOS element IDs', () => {
      expect(validateTargetIdSyntax('acc-name')).toBe(true);
      expect(validateTargetIdSyntax('applicant_email')).toBe(true);
      expect(validateTargetIdSyntax('field_123_abc')).toBe(true);
    });

    it('rejects CSS selectors, XPath expressions, whitespace, and special characters', () => {
      expect(validateTargetIdSyntax('#applicant_name')).toBe(false);
      expect(validateTargetIdSyntax('input.form-control')).toBe(false);
      expect(validateTargetIdSyntax('div > input')).toBe(false);
      expect(validateTargetIdSyntax('//input[@id="fname"]')).toBe(false);
      expect(validateTargetIdSyntax('acc name with space')).toBe(false);
      expect(validateTargetIdSyntax('acc;drop table')).toBe(false);
      expect(validateTargetIdSyntax('<script>')).toBe(false);
      expect(validateTargetIdSyntax('')).toBe(false);
    });
  });

  describe('2. Target DOM Validation & Type Constraints', () => {
    it('validates existing elements by data-accessos-id and HTML id', () => {
      const res1 = validateTargetElement('acc-name', 'TYPE', doc);
      expect(res1.valid).toBe(true);
      expect(res1.element).not.toBeNull();

      const res2 = validateTargetElement('applicant_name', 'TYPE', doc);
      expect(res2.valid).toBe(true);
      expect(res2.element).not.toBeNull();
    });

    it('rejects non-existent targets with TARGET_NOT_FOUND', () => {
      const res = validateTargetElement('acc-nonexistent', 'TYPE', doc);
      expect(res.valid).toBe(false);
      expect(res.errorStatus).toBe('TARGET_NOT_FOUND');
    });

    it('rejects disabled elements with TARGET_INVALID', () => {
      const res = validateTargetElement('acc-disabled', 'TYPE', doc);
      expect(res.valid).toBe(false);
      expect(res.errorStatus).toBe('TARGET_INVALID');
      expect(res.message).toContain('disabled');
    });

    it('rejects hidden elements with TARGET_INVALID', () => {
      const res = validateTargetElement('acc-hidden', 'TYPE', doc);
      expect(res.valid).toBe(false);
      expect(res.errorStatus).toBe('TARGET_INVALID');
      expect(res.message).toContain('hidden');
    });

    it('rejects detached/stale elements', () => {
      const detached = doc.createElement('input');
      detached.setAttribute('data-accessos-id', 'acc-detached');
      // Not appended to doc
      const res = validateTargetElement('acc-detached', 'TYPE', doc);
      expect(res.valid).toBe(false);
      expect(res.errorStatus).toBe('TARGET_NOT_FOUND');
    });

    it('enforces element tag and type constraints for each action', () => {
      // TYPE on button -> invalid
      const typeOnBtn = validateTargetElement('acc-btn', 'TYPE', doc);
      expect(typeOnBtn.valid).toBe(false);
      expect(typeOnBtn.message).toContain('only allowed on editable text fields');

      // SELECT_OPTION on text input -> invalid
      const selectOnInput = validateTargetElement('acc-name', 'SELECT_OPTION', doc, 'GENERAL');
      expect(selectOnInput.valid).toBe(false);
      expect(selectOnInput.message).toContain('requires a <select> element');

      // SELECT_OPTION with non-existent option -> invalid
      const selectNonExistentOpt = validateTargetElement('acc-category', 'SELECT_OPTION', doc, 'NON_EXISTENT');
      expect(selectNonExistentOpt.valid).toBe(false);
      expect(selectNonExistentOpt.message).toContain('does not exist in <select');

      // SELECT_OPTION with disabled option -> invalid
      const selectDisabledOpt = validateTargetElement('acc-category', 'SELECT_OPTION', doc, 'ST');
      expect(selectDisabledOpt.valid).toBe(false);
      expect(selectDisabledOpt.message).toContain('is disabled');

      // TOGGLE_CHECKBOX on text input -> invalid
      const toggleOnInput = validateTargetElement('acc-name', 'TOGGLE_CHECKBOX', doc);
      expect(toggleOnInput.valid).toBe(false);
      expect(toggleOnInput.message).toContain('requires an <input type="checkbox">');
    });
  });

  describe('3. Execution of Allowlisted Actions', () => {
    it('executes FOCUS safely without modifying values', async () => {
      const intent: InteractionIntent = {
        actionId: 'act-focus-1',
        actionType: 'FOCUS',
        targetElementId: 'acc-name',
        source: 'GUIDED_MODE',
      };

      const result = await executeInteraction(intent, doc);
      expect(result.status).toBe('SUCCESS');
      expect(result.changed).toBe(false);
      expect(result.actionType).toBe('FOCUS');
    });

    it('executes HIGHLIGHT and CLEAR_HIGHLIGHT visually without mutations', async () => {
      const highlightIntent: InteractionIntent = {
        actionId: 'act-hl-1',
        actionType: 'HIGHLIGHT',
        targetElementId: 'acc-name',
        source: 'GUIDED_MODE',
      };

      const hlResult = await executeInteraction(highlightIntent, doc);
      expect(hlResult.status).toBe('SUCCESS');
      expect(hlResult.changed).toBe(false);
      const el = doc.querySelector('[data-accessos-id="acc-name"]');
      expect(el?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

      const clearIntent: InteractionIntent = {
        actionId: 'act-clear-1',
        actionType: 'CLEAR_HIGHLIGHT',
        targetElementId: 'acc-name',
      };
      const clearResult = await executeInteraction(clearIntent, doc);
      expect(clearResult.status).toBe('SUCCESS');
      expect(el?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
    });

    it('executes TYPE safely on allowed text input and dispatches events', async () => {
      const inputEl = doc.querySelector<HTMLInputElement>('[data-accessos-id="acc-name"]')!;
      let inputDispatched = false;
      let changeDispatched = false;

      inputEl.addEventListener('input', () => {
        inputDispatched = true;
      });
      inputEl.addEventListener('change', () => {
        changeDispatched = true;
      });

      const intent: InteractionIntent = {
        actionId: 'act-type-1',
        actionType: 'TYPE',
        targetElementId: 'acc-name',
        value: 'Priya Sharma',
        valueSource: 'USER_EXPLICIT',
        requiresConfirmation: true,
        source: 'USER',
      };

      const result = await executeInteraction(intent, doc, { confirmed: true });
      expect(result.status).toBe('SUCCESS');
      expect(result.changed).toBe(true);
      expect(inputEl.value).toBe('Priya Sharma');
      expect(inputDispatched).toBe(true);
      expect(changeDispatched).toBe(true);
    });

    it('executes SELECT_OPTION safely on select and verifies choice', async () => {
      const selectEl = doc.querySelector<HTMLSelectElement>('[data-accessos-id="acc-category"]')!;
      let changeDispatched = false;
      selectEl.addEventListener('change', () => {
        changeDispatched = true;
      });

      const intent: InteractionIntent = {
        actionId: 'act-select-1',
        actionType: 'SELECT_OPTION',
        targetElementId: 'acc-category',
        optionValue: 'OBC',
        requiresConfirmation: true,
        source: 'USER',
      };

      const result = await executeInteraction(intent, doc, { confirmed: true });
      expect(result.status).toBe('SUCCESS');
      expect(result.changed).toBe(true);
      expect(selectEl.value).toBe('OBC');
      expect(changeDispatched).toBe(true);
    });

    it('executes TOGGLE_CHECKBOX safely on native checkbox and verifies state', async () => {
      const checkboxEl = doc.querySelector<HTMLInputElement>('[data-accessos-id="acc-declaration"]')!;
      expect(checkboxEl.checked).toBe(false);

      const intent: InteractionIntent = {
        actionId: 'act-check-1',
        actionType: 'TOGGLE_CHECKBOX',
        targetElementId: 'acc-declaration',
        checked: true,
        requiresConfirmation: true,
        source: 'USER',
      };

      const result = await executeInteraction(intent, doc, { confirmed: true });
      expect(result.status).toBe('SUCCESS');
      expect(result.changed).toBe(true);
      expect(checkboxEl.checked).toBe(true);
    });
  });

  describe('4. Confirmation UI Dialog', () => {
    it('renders accessible confirmation dialog with action details, risk tag, and buttons', () => {
      const dialog = new InteractionConfirmationDialog();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      const intent: InteractionIntent = {
        actionId: 'act-confirm-test',
        actionType: 'TYPE',
        targetElementId: 'acc-name',
        value: 'Aarav Patel',
        reason: 'Required applicant name',
        riskLevel: 'LOW',
      };

      const modalEl = dialog.show({
        intent,
        targetLabel: 'Full Name',
        onConfirm,
        onCancel,
        containerEl: doc.body,
      });

      expect(modalEl).not.toBeNull();
      expect(modalEl.getAttribute('role')).toBe('alertdialog');
      expect(modalEl.getAttribute('aria-modal')).toBe('true');
      expect(modalEl.textContent).toContain('Aarav Patel');
      expect(modalEl.textContent).toContain('Full Name');
      expect(modalEl.textContent).toContain('Risk: LOW');
      expect(modalEl.textContent).toContain('Required applicant name');

      dialog.dismiss();
      expect(doc.body.querySelector('#accessos-interaction-confirmation-modal')).toBeNull();
    });

    it('dismisses modal and calls onCancel when Cancel button is clicked', () => {
      const dialog = new InteractionConfirmationDialog();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      dialog.show({
        intent: {
          actionId: 'act-1',
          actionType: 'TYPE',
          targetElementId: 'acc-name',
          value: 'Test',
        },
        targetLabel: 'Name',
        onConfirm,
        onCancel,
        containerEl: doc.body,
      });

      const cancelBtn = doc.querySelector<HTMLButtonElement>('.accessos-btn-cancel')!;
      expect(cancelBtn).not.toBeNull();
      cancelBtn.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(doc.body.querySelector('#accessos-interaction-confirmation-modal')).toBeNull();
    });
  });

  describe('5. Policy Evaluation Rules', () => {
    it('requires confirmation for TYPE, SELECT_OPTION, TOGGLE_CHECKBOX', () => {
      const typeEval = evaluateInteractionPolicy({
        actionId: '1',
        actionType: 'TYPE',
        targetElementId: 'acc-name',
        value: 'Hello',
        valueSource: 'USER_EXPLICIT',
        source: 'USER',
      });
      expect(typeEval.allowed).toBe(true);
      expect(typeEval.requiresConfirmation).toBe(true);

      const selectEval = evaluateInteractionPolicy({
        actionId: '2',
        actionType: 'SELECT_OPTION',
        targetElementId: 'acc-cat',
        optionValue: 'GEN',
      });
      expect(selectEval.allowed).toBe(true);
      expect(selectEval.requiresConfirmation).toBe(true);

      const checkEval = evaluateInteractionPolicy({
        actionId: '3',
        actionType: 'TOGGLE_CHECKBOX',
        targetElementId: 'acc-dec',
        checked: true,
      });
      expect(checkEval.allowed).toBe(true);
      expect(checkEval.requiresConfirmation).toBe(true);
    });

    it('does NOT require confirmation for non-mutating FOCUS or HIGHLIGHT', () => {
      const focusEval = evaluateInteractionPolicy({
        actionId: '1',
        actionType: 'FOCUS',
        targetElementId: 'acc-name',
      });
      expect(focusEval.allowed).toBe(true);
      expect(focusEval.requiresConfirmation).toBe(false);

      const hlEval = evaluateInteractionPolicy({
        actionId: '2',
        actionType: 'HIGHLIGHT',
        targetElementId: 'acc-name',
      });
      expect(hlEval.allowed).toBe(true);
      expect(hlEval.requiresConfirmation).toBe(false);
    });
  });

  describe('6. Execution Boundary & Capability Token Pipeline', () => {
    it('prepares validated command token and executes atomically', async () => {
      const intent: InteractionIntent = {
        actionId: 'prep-1',
        actionType: 'TYPE',
        targetElementId: 'acc-name',
        value: 'Confirmed Value',
        valueSource: 'USER_EXPLICIT',
        source: 'USER',
      };

      const prep = prepareExecutionCommand(intent, doc, { confirmed: true });
      expect(prep.valid).toBe(true);
      expect(prep.command).toBeDefined();
      expect(prep.command?.commandToken).toBeDefined();

      const res = await executeValidatedCommand(prep.command!, doc);
      expect(res.status).toBe('SUCCESS');
      expect(res.changed).toBe(true);
    });
  });
});
