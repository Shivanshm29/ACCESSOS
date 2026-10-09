import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  extractPageRepresentation,
  isFieldSensitive,
  isElementVisible,
} from '../src/content/semantic-extractor';

describe('Phase 2 Semantic Extractor Suite', () => {
  function loadSemanticFixture() {
    const fixturePath = path.resolve(__dirname, '../../tests/fixtures/semantic-form-page.html');
    const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');
    const window = new Window({
      url: 'https://city-portal.gov/grants/apply',
    });
    const document = window.document;
    document.write(fixtureHtml);
    return { window, document };
  }

  it('1. Extracts full structured PageRepresentation matching domain schema', () => {
    const { window, document } = loadSemanticFixture();
    const representation = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    expect(representation).toBeDefined();
    expect(representation.page.title).toBe('Municipal Citizen Grant Application');
    expect(representation.page.url).toBe('https://city-portal.gov/grants/apply');
    expect(representation.page.hostname).toBe('city-portal.gov');
    expect(representation.page.pathname).toBe('/grants/apply');
    expect(typeof representation.extractedAt).toBe('number');

    // Structural arrays
    expect(Array.isArray(representation.headings)).toBe(true);
    expect(Array.isArray(representation.sections)).toBe(true);
    expect(Array.isArray(representation.fields)).toBe(true);
    expect(Array.isArray(representation.buttons)).toBe(true);
    expect(Array.isArray(representation.links)).toBe(true);
    expect(Array.isArray(representation.instructions)).toBe(true);
    expect(Array.isArray(representation.errors)).toBe(true);
    expect(representation.accessibilitySignals).toBeDefined();
    expect(representation.metrics).toBeDefined();
  });

  it('2. Extracts headings, hierarchy levels, and filters hidden headings', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    // Visible headings: 1 h1, 3 h2, 1 h3 = 5 total
    expect(rep.headings.length).toBe(5);
    expect(rep.headings[0].level).toBe(1);
    expect(rep.headings[0].text).toBe('Municipal Citizen Grant Application');
    expect(rep.headings[1].level).toBe(2);
    expect(rep.headings[1].text).toBe('Applicant Identification');
    expect(rep.headings[4].level).toBe(3);
    expect(rep.headings[4].text).toBe('Declaration & Submission');

    // Hidden heading "<h2 class="hidden-element">" must not be included
    const hiddenFound = rep.headings.some((h) => h.text.includes('Hidden Internal Section'));
    expect(hiddenFound).toBe(false);
  });

  it('3. Extracts semantic sections and associates member fields, buttons, and links', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    expect(rep.sections.length).toBeGreaterThanOrEqual(4);
    const applicantSec = rep.sections.find((s) => s.heading === 'Applicant Identification');
    expect(applicantSec).toBeDefined();
    expect(applicantSec?.fieldIds.length).toBeGreaterThan(0);

    const submissionSec = rep.sections.find((s) => s.heading === 'Declaration & Submission');
    expect(submissionSec).toBeDefined();
    expect(submissionSec?.buttonIds.length).toBe(3);
  });

  it('4. Resolves form field labels with correct precedence rules', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    // 1. Explicit label (for="full-name")
    const fullNameField = rep.fields.find((f) => f.elementId === 'full-name');
    expect(fullNameField?.label).toBe('Full Legal Name');
    expect(fullNameField?.labelSource).toBe('explicit-label');

    // 2. Wrapped label (<label>Email Address <input /></label>)
    const emailField = rep.fields.find((f) => f.elementId === 'email-address');
    expect(emailField?.label).toBe('Email Address');
    expect(emailField?.labelSource).toBe('wrapped-label');

    // 3. aria-labelledby ("label-hh-size")
    const hhField = rep.fields.find((f) => f.elementId === 'household-size');
    expect(hhField?.label).toBe('Total Household Size');
    expect(hhField?.labelSource).toBe('aria-labelledby');

    // 4. aria-label
    const incomeField = rep.fields.find((f) => f.elementId === 'annual-income');
    expect(incomeField?.label).toBe('Annual Household Income');
    expect(incomeField?.labelSource).toBe('aria-label');

    // 5. Unlabeled field
    const unlabeledField = rep.fields.find((f) => f.elementId === 'unlabeled-notes');
    expect(unlabeledField?.labelSource).toBe('placeholder'); // placeholder is last resort
  });

  it('5. Detects required fields deterministically', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    const requiredFullName = rep.fields.find((f) => f.elementId === 'full-name');
    expect(requiredFullName?.required).toBe(true);
    expect(requiredFullName?.requiredSource).toBe('required-attr');

    const optionalPhone = rep.fields.find((f) => f.elementId === 'phone-number');
    expect(optionalPhone?.required).toBe(false);

    const optionalIncome = rep.fields.find((f) => f.elementId === 'annual-income');
    expect(optionalIncome?.required).toBe(false);
  });

  it('6. Enforces privacy rules: sensitive fields and never extracting secret values', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    const pinField = rep.fields.find((f) => f.elementId === 'account-pin');
    expect(pinField).toBeDefined();
    expect(pinField?.type).toBe('password');
    expect(pinField?.sensitive).toBe(true);
    // Value "secret123" must NEVER appear in the field representation
    expect((pinField as unknown as Record<string, unknown>).value).toBeUndefined();
    expect(pinField?.hasValue).toBe(false); // sensitive fields force hasValue false

    // Confirm that no field in representation leaks raw values
    rep.fields.forEach((f) => {
      expect((f as unknown as Record<string, unknown>).value).toBeUndefined();
    });
  });

  it('7. Extracts buttons with correct types, labels, and disabled states', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    expect(rep.buttons.length).toBe(3);
    const submitBtn = rep.buttons.find((b) => b.text === 'Submit Application');
    expect(submitBtn?.type).toBe('submit');
    expect(submitBtn?.disabled).toBe(false);

    const draftBtn = rep.buttons.find((b) => b.text === 'Save Draft');
    expect(draftBtn?.type).toBe('button');

    const emptyBtn = rep.buttons.find((b) => b.id.includes('accessos-button-003'));
    expect(emptyBtn?.text).toBe('');
  });

  it('8. Extracts links and correctly classifies internal vs external links', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    expect(rep.links.length).toBe(4);
    const internalLink = rep.links.find((l) => l.text === 'Program Guidelines');
    expect(internalLink?.isExternal).toBe(false);

    const externalLink = rep.links.find((l) => l.text === 'External FAQ');
    expect(externalLink?.isExternal).toBe(true);

    const ariaLink = rep.links.find((l) => l.ariaLabel === 'Privacy Notice');
    expect(ariaLink?.text).toBe('Privacy');
  });

  it('9. Extracts visible instructions and truncates cleanly', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    expect(rep.instructions.length).toBeGreaterThanOrEqual(2);
    const banner = rep.instructions.find((i) => i.text.includes('PDF format and under 5MB'));
    expect(banner).toBeDefined();

    const hint = rep.instructions.find((i) => i.text.includes('500 words'));
    expect(hint?.source).toBe('help-text');
  });

  it('10. Extracts errors and associates them with fields via aria-describedby', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    expect(rep.errors.length).toBe(1);
    const emailErr = rep.errors[0];
    expect(emailErr.text).toBe('Please enter a valid official email address.');
    expect(emailErr.source).toBe('aria-alert');
    expect(emailErr.fieldId).toBeDefined();

    // Verify it links to the email field ID
    const emailField = rep.fields.find((f) => f.elementId === 'email-address');
    expect(emailErr.fieldId).toBe(emailField?.id);
  });

  it('11. Detects accessibility signals accurately', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    const sig = rep.accessibilitySignals;
    expect(sig.totalSignalsCount).toBeGreaterThan(0);

    // Missing alt text image
    expect(sig.missingAltImages.length).toBe(1);
    expect(sig.missingAltImages[0].src).toBe('/images/decorative-header.png');

    // Button without accessible name
    expect(sig.buttonsWithoutAccessibleName.length).toBe(1);

    // Link without accessible name
    expect(sig.linksWithoutAccessibleName.length).toBe(1);

    // aria-invalid field
    expect(sig.ariaInvalidFields.length).toBe(1);
    const emailField = rep.fields.find((f) => f.elementId === 'email-address');
    expect(sig.ariaInvalidFields[0].fieldId).toBe(emailField?.id);

    // Main landmark present
    expect(sig.hasMainLandmark).toBe(true);
  });

  it('12. Injects and reuses stable ACCESSOS element identifiers idempotently', () => {
    const { window, document } = loadSemanticFixture();

    // First extraction
    const rep1 = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    const firstFieldId = rep1.fields[0].id;
    const domNode = document.querySelector(`[data-accessos-id="${firstFieldId}"]`);
    expect(domNode).not.toBeNull();

    // Second extraction on the same DOM should reuse existing data-accessos-id
    const rep2 = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    expect(rep2.fields[0].id).toBe(firstFieldId);
  });

  it('13. Computes deterministic page metrics and form complexity indicators', () => {
    const { window, document } = loadSemanticFixture();
    const rep = extractPageRepresentation(
      document as unknown as Document,
      window.location as unknown as Location
    );

    const m = rep.metrics;
    expect(m.headingCount).toBe(rep.headings.length);
    expect(m.fieldCount).toBe(rep.fields.length);
    expect(m.requiredFieldCount).toBe(rep.fields.filter((f) => f.required).length);
    expect(m.buttonCount).toBe(rep.buttons.length);
    expect(m.linkCount).toBe(rep.links.length);
    expect(m.errorCount).toBe(rep.errors.length);

    // Form complexity
    expect(m.formComplexity.fieldCount).toBe(12);
    expect(m.formComplexity.fileUploadCount).toBe(1); // income-proof file input
    expect(m.formComplexity.requiredFieldCount).toBeGreaterThanOrEqual(6);
  });

  it('14. Filters hidden and non-rendered elements reliably', () => {
    const window = new Window();
    const document = window.document;

    document.body.innerHTML = `
      <input type="text" id="visible-input" />
      <input type="hidden" id="hidden-type-input" value="token" />
      <input type="text" id="hidden-attr-input" hidden />
      <input type="text" id="aria-hidden-input" aria-hidden="true" />
      <div style="display: none;">
        <input type="text" id="nested-hidden-input" />
      </div>
    `;

    expect(isElementVisible(document.getElementById('visible-input') as unknown as Element)).toBe(true);
    expect(isElementVisible(document.getElementById('hidden-type-input') as unknown as Element)).toBe(false);
    expect(isElementVisible(document.getElementById('hidden-attr-input') as unknown as Element)).toBe(false);
    expect(isElementVisible(document.getElementById('aria-hidden-input') as unknown as Element)).toBe(false);
  });

  it('15. Identifies sensitive fields through heuristics', () => {
    expect(isFieldSensitive('password')).toBe(true);
    expect(isFieldSensitive('text', 'user_pin')).toBe(true);
    expect(isFieldSensitive('text', 'cvv_code')).toBe(true);
    expect(isFieldSensitive('text', 'ssn_number')).toBe(true);
    expect(isFieldSensitive('text', 'first_name')).toBe(false);
    expect(isFieldSensitive('email', 'email_address')).toBe(false);
  });
});
