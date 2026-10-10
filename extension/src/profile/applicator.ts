/**
 * ACCESSOS Citizen Profile Applicator Engine
 *
 * Safely applies verified profile field mappings to live form elements
 * in the active DOM. Dispatches synthetic input & change events for reactive
 * frameworks and highlights modified fields with assistive styling.
 */
import type { ProfileFieldMapping, ApplyProfileResult } from './types';
import { isFieldBlocked } from './matcher';

export function applyProfileFields(
  doc: Document,
  mappings: ProfileFieldMapping[]
): ApplyProfileResult {
  const modifiedFields: string[] = [];
  const errors: string[] = [];

  if (!doc || !Array.isArray(mappings)) {
    return {
      success: false,
      appliedCount: 0,
      modifiedFields: [],
      errors: ['Invalid document or mappings payload'],
      timestamp: Date.now(),
    };
  }

  for (const mapping of mappings) {
    try {
      let el: HTMLElement | null = null;

      if (mapping.formFieldId) {
        el = doc.getElementById(mapping.formFieldId);
      }
      if (!el && mapping.formFieldName) {
        el = doc.querySelector(`[name="${CSS.escape(mapping.formFieldName)}"]`);
      }
      if (!el && mapping.targetSelector) {
        try {
          el = doc.querySelector(mapping.targetSelector);
        } catch {
          // Bad selector
        }
      }

      if (!el) {
        errors.push(`Field not found in DOM: ${mapping.formFieldId || mapping.formFieldName || mapping.profileKey}`);
        continue;
      }

      const inputType = ((el as HTMLInputElement).type || '').toLowerCase();
      if (isFieldBlocked({ type: inputType, name: mapping.formFieldName, id: mapping.formFieldId })) {
        errors.push(`Skipped blocked/sensitive field: ${mapping.formFieldId || mapping.formFieldName}`);
        continue;
      }

      if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) {
        continue;
      }

      const val = mapping.profileValue;

      // 1. SELECT elements
      if (el instanceof HTMLSelectElement || el.tagName.toLowerCase() === 'select') {
        const select = el as HTMLSelectElement;
        const normVal = val.toLowerCase().trim();
        let matchedIndex = -1;

        for (let i = 0; i < select.options.length; i++) {
          const opt = select.options[i];
          if (
            opt.value.toLowerCase().trim() === normVal ||
            opt.text.toLowerCase().trim() === normVal ||
            opt.text.toLowerCase().includes(normVal)
          ) {
            matchedIndex = i;
            break;
          }
        }

        if (matchedIndex >= 0) {
          select.selectedIndex = matchedIndex;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.classList.add('accessos-field-populated');
          modifiedFields.push(mapping.formFieldId || mapping.formFieldName || mapping.profileKey);
        }
        continue;
      }

      // 2. CHECKBOX & RADIO elements
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        const normVal = val.toLowerCase().trim();
        if (normVal === 'true' || normVal === 'yes' || normVal === '1' || el.value.toLowerCase() === normVal) {
          el.checked = true;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.classList.add('accessos-field-populated');
          modifiedFields.push(mapping.formFieldId || mapping.formFieldName || mapping.profileKey);
        }
        continue;
      }

      // 3. TEXT, DATE, EMAIL, TEL, NUMBER, TEXTAREA elements
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        (el as HTMLInputElement).value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.classList.add('accessos-field-populated');
        modifiedFields.push(mapping.formFieldId || mapping.formFieldName || mapping.profileKey);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error setting field ${mapping.profileKey}: ${msg}`);
    }
  }

  return {
    success: modifiedFields.length > 0,
    appliedCount: modifiedFields.length,
    modifiedFields,
    errors,
    timestamp: Date.now(),
  };
}
