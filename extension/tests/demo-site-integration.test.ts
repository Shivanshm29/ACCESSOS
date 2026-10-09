import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import type { PageRepresentation } from '../src/core/types/representation';

describe('Demo Site & ACCESSOS Semantic Extractor Integration Suite', () => {
  let window: Window;
  let document: Document;
  let representation: PageRepresentation;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    window = new Window({
      url: 'http://localhost:3000/',
    });
    document = window.document as unknown as Document;
    document.write(html);

    // Run ACCESSOS Phase 2 extraction
    representation = extractPageRepresentation(
      document,
      window.location as unknown as Location
    );
  });

  it('1. Extracts top-level Page Information correctly', () => {
    expect(representation.page.title).toContain('National Student Scholarship Portal');
    expect(representation.page.url).toBe('http://localhost:3000/');
    expect(representation.page.hostname).toBe('localhost');
  });

  it('2. Extracts all 8 application sections with headings and summaries', () => {
    const formSections = representation.sections.filter((s) => s.role === 'section');
    expect(formSections.length).toBe(8);

    const sectionHeadings = formSections.map((s) => s.heading || '');
    expect(sectionHeadings).toContain('Applicant Primary Information');
    expect(sectionHeadings).toContain('Personal Details & Domicile Classification');
    expect(sectionHeadings).toContain('Academic Enrollment & Institutional Details');
    expect(sectionHeadings).toContain('Family Background & Income Appraisal');
    expect(sectionHeadings).toContain('Residential & Communication Address');
    expect(sectionHeadings).toContain('Direct Benefit Transfer (DBT) Bank Account');
    expect(sectionHeadings).toContain('Supporting Documents Upload & Verification');
    expect(sectionHeadings).toContain('Statutory Declaration & Application Finalization');

    // Verify all sections have ACCESSOS stable IDs
    formSections.forEach((sec) => {
      expect(sec.id).toMatch(/^accessos-section-\d{3}$/);
      expect(sec.summary.length).toBeGreaterThan(0);
    });
  });

  it('3. Extracts 25-50 meaningful form fields across all sections', () => {
    // Total fields extracted
    expect(representation.fields.length).toBeGreaterThanOrEqual(25);
    expect(representation.fields.length).toBeLessThanOrEqual(50);

    // Verify key fields exist in extraction
    const fieldNames = representation.fields.map((f) => f.name || f.id);
    expect(fieldNames).toContain('applicant_full_name');
    expect(fieldNames).toContain('applicant_dob');
    expect(fieldNames).toContain('applicant_email');
    expect(fieldNames).toContain('academic_institution');
    expect(fieldNames).toContain('academic_cgpa');
    expect(fieldNames).toContain('family_annual_income');
    expect(fieldNames).toContain('address_pincode');
    expect(fieldNames).toContain('bank_account_number');
    expect(fieldNames).toContain('bank_ifsc_code');
    expect(fieldNames).toContain('doc_identity_proof');
    expect(fieldNames).toContain('decl_truthful_info');
  });

  it('4. Identifies required fields correctly', () => {
    const requiredFields = representation.fields.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThanOrEqual(20);

    const nameField = representation.fields.find((f) => f.name === 'applicant_full_name');
    expect(nameField?.required).toBe(true);

    const emailField = representation.fields.find((f) => f.name === 'applicant_email');
    expect(emailField?.required).toBe(true);

    const optionalContact = representation.fields.find((f) => f.name === 'applicant_alternate_contact');
    expect(optionalContact?.required).toBe(false);
  });

  it('5. Extracts interactive buttons with types and stable IDs', () => {
    expect(representation.buttons.length).toBeGreaterThanOrEqual(6);

    const buttonTexts = representation.buttons.map((b) => b.text);
    expect(buttonTexts.some((t) => t.includes('Load Example Data'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Reset Form'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Submit Application'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Save Draft'))).toBe(true);
  });

  it('6. Extracts external and regulatory links', () => {
    expect(representation.links.length).toBeGreaterThanOrEqual(4);

    const urls = representation.links.map((l) => l.href);
    expect(urls.some((u) => u.includes('faq'))).toBe(true);
    expect(urls.some((u) => u.includes('grievance'))).toBe(true);
  });

  it('7. Extracts instructions and dense explanatory notices', () => {
    expect(representation.instructions.length).toBeGreaterThanOrEqual(5);

    const texts = representation.instructions.map((i) => i.text);
    expect(texts.some((t) => t.includes('Pursuant to Ministerial Order'))).toBe(true);
  });

  it('8. Detects intentional accessibility barriers in the demo site', () => {
    const signals = representation.accessibilitySignals;

    // Barrier B: Image without alt text
    expect(signals.missingAltImages.length).toBeGreaterThanOrEqual(1);

    // Barrier A: Unlabeled field (Alternate contact phone without for attribute or placeholder)
    expect(signals.missingLabels.length).toBeGreaterThanOrEqual(1);

    // Barrier C: Button with unclear accessible name (mystery button)
    expect(signals.buttonsWithoutAccessibleName.length).toBeGreaterThanOrEqual(1);

    // Barrier D: Heading hierarchy skips (H1 -> H3)
    expect(signals.headingHierarchyAnomalies.length).toBeGreaterThanOrEqual(1);

    // Overall signal count
    expect(signals.totalSignalsCount).toBeGreaterThanOrEqual(4);
  });

  it('9. Computes form complexity indicators matching a dense institutional portal', () => {
    const complexity = representation.metrics.formComplexity;
    expect(complexity.fieldCount).toBeGreaterThanOrEqual(25);
    expect(complexity.requiredFieldCount).toBeGreaterThanOrEqual(20);
    expect(complexity.sectionCount).toBe(representation.sections.length);
    expect(complexity.conditionalSectionsCount).toBeGreaterThanOrEqual(1);
    expect(complexity.fileUploadCount).toBe(5);
  });

  it('10. Privacy Scrubber: Does not leak sensitive field values or plaintext passwords', () => {
    const pin = representation.fields.find((f) => f.name === 'address_pincode');

    expect(pin?.sensitive).toBe(true);

    // Ensure raw value is undefined and only hasValue boolean is captured
    expect((pin as any).value).toBeUndefined();
    expect(typeof pin?.hasValue).toBe('boolean');
  });

  it('11. Measures accurate page representation metrics for reporting', () => {
    const m = representation.metrics;
    const formSections = representation.sections.filter((s) => s.role === 'section');

    console.log('EXACT_METRICS_START');
    console.log(JSON.stringify({
      totalDomSections: m.sectionCount,
      applicationFormSections: formSections.length,
      totalFields: m.fieldCount,
      requiredFields: m.requiredFieldCount,
      totalButtons: m.buttonCount,
      totalLinks: m.linkCount,
      totalHeadings: m.headingCount,
      totalInstructions: m.instructionCount,
      totalErrors: m.errorCount,
      missingAltImages: representation.accessibilitySignals.missingAltImages.length,
      missingLabels: representation.accessibilitySignals.missingLabels.length,
      buttonsWithoutAccessibleName: representation.accessibilitySignals.buttonsWithoutAccessibleName.length,
      headingHierarchyAnomalies: representation.accessibilitySignals.headingHierarchyAnomalies.length,
      totalAccessibilitySignals: representation.accessibilitySignals.totalSignalsCount,
      fileUploadCount: m.formComplexity.fileUploadCount,
      conditionalSectionsCount: m.formComplexity.conditionalSectionsCount,
    }, null, 2));
    console.log('EXACT_METRICS_END');

    expect(m.sectionCount).toBe(representation.sections.length);
    expect(m.fieldCount).toBeGreaterThanOrEqual(25);
    expect(m.requiredFieldCount).toBeGreaterThanOrEqual(20);
    expect(m.buttonCount).toBeGreaterThanOrEqual(6);
    expect(m.linkCount).toBeGreaterThanOrEqual(4);
    expect(m.headingCount).toBeGreaterThanOrEqual(9);
  });
});
