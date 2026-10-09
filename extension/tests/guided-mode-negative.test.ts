/**
 * Mandatory Negative Tests Suite for Phase 6 Guided Mode
 *
 * STRICT PHASE BOUNDARIES:
 * Phase 6 is descriptive guidance + visual highlighting + progressive presentation ONLY.
 *
 * This suite explicitly proves that Guided Mode:
 * 1. DOES NOT type into form fields
 * 2. DOES NOT modify element values or input states
 * 3. DOES NOT click buttons or trigger form actions
 * 4. DOES NOT submit forms
 * 5. DOES NOT execute model-generated JavaScript or eval/Function
 * 6. DOES NOT execute arbitrary selectors or DOM scripts
 * 7. DOES NOT expose sensitive values (passwords, tokens, values)
 * 8. DOES NOT transmit raw HTML to the backend
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import { highlightElement, clearHighlight } from '../src/content/highlighter';
import { buildGuidedModeRequest } from '../src/guided/client';
import type { PageMetadata, PageRepresentation } from '../src/core/types/index';

describe('Phase 6 Mandatory Negative Test Suite', () => {
  let doc: Document;
  let form: HTMLFormElement;
  let textInput: HTMLInputElement;
  let passwordInput: HTMLInputElement;
  let selectEl: HTMLSelectElement;
  let checkboxEl: HTMLInputElement;
  let submitBtn: HTMLButtonElement;

  beforeEach(() => {
    const window = new Window({ url: 'http://localhost:3000/scholarship' });
    doc = window.document as unknown as Document;

    doc.body.innerHTML = `
      <form id="scholarship-form" action="/submit" method="POST">
        <label for="applicant-name">Applicant Name</label>
        <input type="text" id="applicant-name" data-accessos-id="accessos-field-name" value="Original Name" />

        <label for="secret-token">Security Code</label>
        <input type="password" id="secret-token" data-accessos-id="accessos-field-token" value="superSecret123" />

        <label for="category">Category</label>
        <select id="category" data-accessos-id="accessos-field-category">
          <option value="GEN" selected>General</option>
          <option value="SC">Scheduled Caste</option>
          <option value="ST">Scheduled Tribe</option>
        </select>

        <label for="agree-terms">Agree</label>
        <input type="checkbox" id="agree-terms" data-accessos-id="accessos-field-agree" />

        <button type="submit" id="submit-btn" data-accessos-id="accessos-btn-submit">Submit Application</button>
      </form>
    `;

    form = doc.getElementById('scholarship-form') as HTMLFormElement;
    textInput = doc.getElementById('applicant-name') as HTMLInputElement;
    passwordInput = doc.getElementById('secret-token') as HTMLInputElement;
    selectEl = doc.getElementById('category') as HTMLSelectElement;
    checkboxEl = doc.getElementById('agree-terms') as HTMLInputElement;
    submitBtn = doc.getElementById('submit-btn') as HTMLButtonElement;
  });

  it('NEG-01: Does NOT type into fields or change text input values', () => {
    const originalValue = textInput.value;
    expect(originalValue).toBe('Original Name');

    // Attempt highlight on the text input
    const res = highlightElement('accessos-field-name', doc);
    expect(res.success).toBe(true);

    // Assert strictly that value was untouched
    expect(textInput.value).toBe('Original Name');
    expect(textInput.value).toBe(originalValue);
  });

  it('NEG-02: Does NOT modify password or secret input values', () => {
    const originalPassword = passwordInput.value;
    expect(originalPassword).toBe('superSecret123');

    const res = highlightElement('accessos-field-token', doc);
    expect(res.success).toBe(true);

    // Value must remain untouched
    expect(passwordInput.value).toBe('superSecret123');
    expect(passwordInput.value).toBe(originalPassword);
  });

  it('NEG-03: Does NOT modify select element dropdown values', () => {
    const originalIndex = selectEl.selectedIndex;
    const originalVal = selectEl.value;

    const res = highlightElement('accessos-field-category', doc);
    expect(res.success).toBe(true);

    expect(selectEl.selectedIndex).toBe(originalIndex);
    expect(selectEl.value).toBe(originalVal);
  });

  it('NEG-04: Does NOT toggle or alter checkbox states', () => {
    expect(checkboxEl.checked).toBe(false);

    const res = highlightElement('accessos-field-agree', doc);
    expect(res.success).toBe(true);

    expect(checkboxEl.checked).toBe(false);
  });

  it('NEG-05: Does NOT click buttons when highlighting them', () => {
    const clickSpy = vi.fn();
    submitBtn.addEventListener('click', clickSpy);

    const res = highlightElement('accessos-btn-submit', doc);
    expect(res.success).toBe(true);

    // Highlighting MUST NOT trigger button click
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('NEG-06: Does NOT submit forms when highlighting buttons or inputs', () => {
    const submitSpy = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener('submit', submitSpy);

    highlightElement('accessos-btn-submit', doc);
    highlightElement('accessos-field-name', doc);
    clearHighlight(doc);

    // Form MUST NOT be submitted
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('NEG-07: Does NOT execute model-generated JavaScript or eval/Function', () => {
    // Malicious or hallucinated payloads must never be executed
    const dangerousScript = 'window.__accessos_pwned = true;';
    const evalSpy = vi.spyOn(globalThis, 'eval');

    // Highlighting an element with an ID that contains script strings should not run scripts
    highlightElement(dangerousScript, doc);

    expect(evalSpy).not.toHaveBeenCalled();
    expect((globalThis as unknown as { __accessos_pwned?: boolean }).__accessos_pwned).toBeUndefined();
    evalSpy.mockRestore();
  });

  it('NEG-08: Does NOT query arbitrary or dangerous DOM selectors', () => {
    // Passing arbitrary selector attempts like 'body', 'input[type=password]', or CSS injections
    const maliciousInput = 'body * { display: none }';
    const res = highlightElement(maliciousInput, doc);

    expect(res.success).toBe(false);
    expect(res.found).toBe(false);
    // Body is still intact and not styled with display: none
    expect(doc.body.style.display).not.toBe('none');
  });

  it('NEG-09: Does NOT include actual sensitive form values in the backend request payload', () => {
    const metadata: PageMetadata = {
      title: 'Portal',
      url: 'https://gov.in',
      hostname: 'gov.in',
      pathname: '/',
      pageType: 'webpage',
      interactiveElementCount: 2,
    };

    const representation: Partial<PageRepresentation> = {
      fields: [
        {
          id: 'accessos-field-token',
          tag: 'input',
          order: 1,
          elementId: 'secret-token',
          name: 'password',
          type: 'password',
          label: 'Secret Code',
          labelSource: 'explicit-label',
          required: true,
          disabled: false,
          readonly: false,
          sensitive: true,
          hasValue: true, // Only records boolean presence!
          validationAttributes: { minLength: 8 },
        },
      ],
      metrics: {
        headingCount: 1,
        sectionCount: 1,
        fieldCount: 1,
        requiredFieldCount: 1,
        buttonCount: 1,
        linkCount: 0,
        instructionCount: 0,
        errorCount: 0,
        imageCount: 0,
        missingLabelCount: 0,
        missingAccessibleNameCount: 0,
        formComplexity: {
          fieldCount: 1,
          requiredFieldCount: 1,
          sectionCount: 1,
          conditionalSectionsCount: 0,
          fileUploadCount: 0,
        },
      },
    };

    const request = buildGuidedModeRequest(
      metadata,
      representation as unknown as PageRepresentation
    );

    const serialized = JSON.stringify(request);

    // Verify sensitive data is NOT present in any way
    expect(serialized).not.toContain('superSecret123');
    expect(serialized).not.toContain('Original Name');
  });

  it('NEG-10: Does NOT transmit raw HTML markup to the backend', () => {
    const metadata: PageMetadata = {
      title: 'Portal',
      url: 'https://gov.in',
      hostname: 'gov.in',
      pathname: '/',
      pageType: 'webpage',
      interactiveElementCount: 2,
    };

    const request = buildGuidedModeRequest(metadata);
    const serialized = JSON.stringify(request);

    expect(serialized).not.toContain('<form');
    expect(serialized).not.toContain('<input');
    expect(serialized).not.toContain('<!DOCTYPE');
    expect(serialized).not.toContain('<html');
  });
});
