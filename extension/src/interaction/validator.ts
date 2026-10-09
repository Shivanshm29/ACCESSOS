/**
 * ACCESSOS Target Element Validator (Phase 8).
 * Independently validates that target element IDs are valid ACCESSOS IDs (not CSS/XPath),
 * that elements currently exist in the active DOM, are visible and interactable,
 * and that their HTML tag/type conforms to the requested action.
 */

import type { ActionType, TargetValidationResult } from './types';

const STABLE_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const FORBIDDEN_SELECTOR_CHARS = [' ', '>', '+', '~', '#', '.', '[', ']', ':', '/', '\\', '(', ')', ';', '<', '>'];

/**
 * Validates the syntax of a targetElementId.
 * Rejects CSS selectors, XPath expressions, and script injections.
 */
export function validateTargetIdSyntax(targetElementId: string): boolean {
  if (!targetElementId || typeof targetElementId !== 'string') return false;
  const clean = targetElementId.trim();
  if (clean.length === 0 || clean.length > 150) return false;

  for (const char of FORBIDDEN_SELECTOR_CHARS) {
    if (clean.includes(char)) return false;
  }

  return STABLE_ID_REGEX.test(clean);
}

/**
 * Resolves and validates a target DOM element against the requested action type.
 */
export function validateTargetElement(
  targetElementId: string,
  actionType: ActionType,
  doc: Document = document,
  optionValue?: string
): TargetValidationResult {
  // 1. Syntax validation (prevents arbitrary CSS/XPath injection)
  if (!validateTargetIdSyntax(targetElementId)) {
    return {
      valid: false,
      element: null,
      errorStatus: 'TARGET_INVALID',
      message: `Target element ID '${targetElementId}' is not a valid stable ACCESSOS ID format.`,
    };
  }

  // 2. Locate DOM element via stable ACCESSOS ID attribute first, then getElementById
  let el: HTMLElement | null = doc.querySelector(`[data-accessos-id="${targetElementId}"]`);
  if (!el) {
    el = doc.getElementById(targetElementId);
  }

  if (!el) {
    return {
      valid: false,
      element: null,
      errorStatus: 'TARGET_NOT_FOUND',
      message: `Element '${targetElementId}' was not found in the current page DOM.`,
    };
  }

  // 3. Staleness & connectivity check
  if (!doc.contains(el)) {
    return {
      valid: false,
      element: null,
      errorStatus: 'TARGET_INVALID',
      message: `Element '${targetElementId}' is detached from the active document (stale reference).`,
    };
  }

  // 4. Visibility & interactability checks
  const style = el.style;
  if (style && (style.display === 'none' || style.visibility === 'hidden')) {
    return {
      valid: false,
      element: el,
      errorStatus: 'TARGET_INVALID',
      message: `Target element '${targetElementId}' is hidden via CSS styling.`,
    };
  }

  if (el.hasAttribute('hidden')) {
    return {
      valid: false,
      element: el,
      errorStatus: 'TARGET_INVALID',
      message: `Target element '${targetElementId}' has hidden attribute.`,
    };
  }

  // Check disabled state for form elements
  if ('disabled' in el && (el as HTMLInputElement).disabled) {
    return {
      valid: false,
      element: el,
      errorStatus: 'TARGET_INVALID',
      message: `Target element '${targetElementId}' is disabled.`,
    };
  }

  const tagName = el.tagName ? el.tagName.toLowerCase() : '';
  const inputType =
    tagName === 'input'
      ? (((el as HTMLInputElement).type || el.getAttribute('type') || 'text').toLowerCase())
      : undefined;

  // Check hidden inputs
  if (inputType === 'hidden') {
    return {
      valid: false,
      element: el,
      errorStatus: 'TARGET_INVALID',
      message: `Cannot interact with hidden input field.`,
    };
  }

  // 5. Action-specific tag and type checks
  if (actionType === 'TYPE') {
    if (inputType === 'password') {
      return {
        valid: false,
        element: el,
        errorStatus: 'BLOCKED',
        message: 'Automated data entry into password fields is strictly blocked.',
      };
    }

    const isTextInput =
      tagName === 'input' &&
      !['button', 'submit', 'reset', 'hidden', 'file', 'checkbox', 'radio', 'image'].includes(
        inputType || ''
      );
    const isTextArea = tagName === 'textarea';

    if (!isTextInput && !isTextArea) {
      return {
        valid: false,
        element: el,
        errorStatus: 'TARGET_INVALID',
        message: `TYPE action is only allowed on editable text fields or textareas (target is <${tagName}>).`,
      };
    }
  }

  if (actionType === 'SELECT_OPTION') {
    if (tagName !== 'select') {
      return {
        valid: false,
        element: el,
        errorStatus: 'TARGET_INVALID',
        message: `SELECT_OPTION action requires a <select> element (target is <${tagName}>).`,
      };
    }

    const selectEl = el as HTMLSelectElement;
    // Verify option exists in the select element
    if (optionValue !== undefined && selectEl.options) {
      let optionExists = false;
      let optionDisabled = false;
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        if (opt.value === optionValue || opt.text.trim() === optionValue.trim()) {
          optionExists = true;
          if (opt.disabled) optionDisabled = true;
          break;
        }
      }

      if (!optionExists) {
        return {
          valid: false,
          element: el,
          errorStatus: 'TARGET_INVALID',
          message: `Option '${optionValue}' does not exist in <select id="${targetElementId}">.`,
        };
      }

      if (optionDisabled) {
        return {
          valid: false,
          element: el,
          errorStatus: 'TARGET_INVALID',
          message: `Option '${optionValue}' in <select id="${targetElementId}"> is disabled.`,
        };
      }
    }
  }

  if (actionType === 'TOGGLE_CHECKBOX') {
    if (tagName !== 'input' || inputType !== 'checkbox') {
      return {
        valid: false,
        element: el,
        errorStatus: 'TARGET_INVALID',
        message: `TOGGLE_CHECKBOX requires an <input type="checkbox"> (target is <${tagName} type="${inputType}">).`,
      };
    }
  }

  return {
    valid: true,
    element: el,
    tagName,
    inputType,
  };
}
