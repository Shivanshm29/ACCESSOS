import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import {
  analyzeAccessibility,
  calculateScore,
  resolveScoreBand,
  SEVERITY_WEIGHTS,
  type AccessibilityFinding,
} from '../src/accessibility/index';

describe('Phase 4 Accessibility Engine Unit & Rule Suite', () => {
  function createTestDom(html: string) {
    const window = new Window({ url: 'http://localhost:3000/test' });
    const doc = window.document as unknown as Document;
    doc.write(`<!DOCTYPE html><html><head><title>Test</title></head><body>${html}</body></html>`);
    const representation = extractPageRepresentation(doc, window.location as unknown as Location);
    return { window, doc, representation };
  }

  it('1. RULE 1 (FORM_MISSING_LABEL): Detects form field lacking an accessible label', () => {
    const { doc, representation } = createTestDom(`
      <form>
        <input type="text" id="unlabeled-field" name="unlabeled-field" />
      </form>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'FORM_MISSING_LABEL');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('HIGH');
    expect(finding?.category).toBe('FORMS');
    expect(finding?.affectedElementId).toBeDefined();
    expect(finding?.evidence.labelSource).toBe('none');
    expect(finding?.confidence).toBe(1.0);
    expect(finding?.deterministic).toBe(true);
  });

  it('2. RULE 1 (FORM_MISSING_LABEL): Does not flag properly labeled field', () => {
    const { doc, representation } = createTestDom(`
      <form>
        <label for="labeled-field">Full Legal Name</label>
        <input type="text" id="labeled-field" name="full_name" />
      </form>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'FORM_MISSING_LABEL');
    expect(finding).toBeUndefined();
  });

  it('3. RULE 2 (IMAGE_MISSING_ALT): Detects informative image missing an alt attribute', () => {
    const { doc, representation } = createTestDom(`
      <img src="chart.png" id="hero-img" />
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'IMAGE_MISSING_ALT');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('MEDIUM');
    expect(finding?.category).toBe('PERCEIVABILITY');
    expect(finding?.evidence.hasAltAttribute).toBe(false);
  });

  it('4. RULE 2 (IMAGE_MISSING_ALT): Differentiates and ignores decorative empty alt=""', () => {
    const { doc, representation } = createTestDom(`
      <img src="decorative-divider.png" alt="" />
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'IMAGE_MISSING_ALT');
    expect(finding).toBeUndefined();
  });

  it('5. RULE 3 (BUTTON_MISSING_NAME): Detects icon-only button without text or aria-label', () => {
    const { doc, representation } = createTestDom(`
      <button type="button" id="icon-btn"><span class="icon"></span></button>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'BUTTON_MISSING_NAME');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('HIGH');
    expect(finding?.category).toBe('OPERABILITY');
    expect(finding?.affectedElementId).toBeDefined();
  });

  it('6. RULE 3 (BUTTON_MISSING_NAME): Does not flag button with visible text or aria-label', () => {
    const { doc, representation } = createTestDom(`
      <button type="submit">Submit Application</button>
      <button type="button" aria-label="Close dialog">X</button>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'BUTTON_MISSING_NAME');
    expect(finding).toBeUndefined();
  });

  it('7. RULE 4 (LINK_MISSING_NAME): Detects anchor link without anchor text or aria-label', () => {
    const { doc, representation } = createTestDom(`
      <a href="https://example.com/info" id="empty-link"><span class="icon"></span></a>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'LINK_MISSING_NAME');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('MEDIUM');
    expect(finding?.category).toBe('NAVIGATION');
  });

  it('8. RULE 4 (LINK_MISSING_NAME): Does not flag valid descriptive links', () => {
    const { doc, representation } = createTestDom(`
      <a href="/faq">Frequently Asked Questions</a>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'LINK_MISSING_NAME');
    expect(finding).toBeUndefined();
  });

  it('9. RULE 5 (HEADING_HIERARCHY): Detects document missing an h1 heading', () => {
    const { doc, representation } = createTestDom(`
      <h2>Section Title Without H1</h2>
      <h3>Subsection</h3>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find(
      (f) => f.ruleId === 'HEADING_HIERARCHY' && f.title.includes('missing a top-level h1')
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('MEDIUM');
  });

  it('10. RULE 5 (HEADING_HIERARCHY): Detects heading level jump greater than one (h1 to h3)', () => {
    const { doc, representation } = createTestDom(`
      <h1>Main Application Title</h1>
      <h3>Urgent Alert Notice</h3>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find(
      (f) => f.ruleId === 'HEADING_HIERARCHY' && f.title.includes('skips hierarchy')
    );
    expect(finding).toBeDefined();
    expect(finding?.evidence.currentLevel).toBe(3);
    expect(finding?.evidence.previousLevel).toBe(1);
  });

  it('11. RULE 5 (HEADING_HIERARCHY): Accepts correct logical heading order without false positives', () => {
    const { doc, representation } = createTestDom(`
      <h1>Portal Title</h1>
      <h2>Section 1</h2>
      <h3>Subsection 1.1</h3>
      <h2>Section 2</h2>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'HEADING_HIERARCHY');
    expect(finding).toBeUndefined();
  });

  it('12. RULE 6 (MAIN_LANDMARK): Detects absence of a <main> landmark', () => {
    const { doc, representation } = createTestDom(`
      <header><h1>Header</h1></header>
      <div class="content"><p>Body text without main tag</p></div>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'MAIN_LANDMARK');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('MEDIUM');
    expect(finding?.category).toBe('NAVIGATION');
  });

  it('13. RULE 6 (MAIN_LANDMARK): Does not flag page that includes <main> element', () => {
    const { doc, representation } = createTestDom(`
      <header><h1>Header</h1></header>
      <main><h2>Main Content</h2></main>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'MAIN_LANDMARK');
    expect(finding).toBeUndefined();
  });

  it('14. RULE 7 (INVALID_FORM_CONTROL): Detects field marked aria-invalid="true"', () => {
    const { doc, representation } = createTestDom(`
      <label for="email-input">Email Address</label>
      <input type="email" id="email-input" aria-invalid="true" value="bad-email" />
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'INVALID_FORM_CONTROL');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('MEDIUM');
    expect(finding?.category).toBe('VALIDATION');
    expect(finding?.evidence.ariaInvalid).toBe(true);
  });

  it('15. RULE 8 (ERROR_ASSOCIATION): Detects unassociated error message', () => {
    const { doc, representation } = createTestDom(`
      <label for="age-field">Age</label>
      <input type="number" id="age-field" />
      <span class="field-error-message visible" id="err-age">Must be 18 or older.</span>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'ERROR_ASSOCIATION');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('MEDIUM');
    expect(finding?.evidence.hasProgrammaticAssociation).toBe(false);
  });

  it('16. RULE 8 (ERROR_ASSOCIATION): Does not flag error associated via aria-describedby', () => {
    const { doc, representation } = createTestDom(`
      <label for="age-field">Age</label>
      <input type="number" id="age-field" aria-describedby="err-age" />
      <span class="field-error-message visible" id="err-age">Must be 18 or older.</span>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'ERROR_ASSOCIATION');
    expect(finding).toBeUndefined();
  });

  it('17. RULE 9 (DUPLICATE_ID): Detects duplicate HTML ID attributes', () => {
    const { doc, representation } = createTestDom(`
      <div id="duplicate-ident">First Element</div>
      <div id="duplicate-ident">Second Element</div>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'DUPLICATE_ID');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('HIGH');
    expect(finding?.category).toBe('ROBUSTNESS');
    expect(finding?.evidence.occurrencesCount).toBe(2);
  });

  it('18. RULE 10 (EMPTY_INTERACTIVE): Detects custom interactive element with no accessible content', () => {
    const { doc, representation } = createTestDom(`
      <div role="button" tabindex="0"></div>
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'EMPTY_INTERACTIVE');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('MEDIUM');
    expect(finding?.category).toBe('OPERABILITY');
  });

  it('19. RULE 11 (FILE_INSTRUCTION_ASSOCIATION): Detects detached file upload guidelines', () => {
    const { doc, representation } = createTestDom(`
      <div class="document-spec-panel">
        <p class="description">Formats: PDF only, max 2MB.</p>
      </div>
      <label for="doc-file">Upload Certificate</label>
      <input type="file" id="doc-file" name="doc_file" />
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'FILE_INSTRUCTION_ASSOCIATION');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('LOW');
    expect(finding?.category).toBe('COGNITIVE_LOAD');
    expect(finding?.evidence.hasAriaDescribedBy).toBe(false);
  });

  it('20. RULE 12 (REQUIRED_FIELD_INDICATION): Detects required field without visible marker', () => {
    const { doc, representation } = createTestDom(`
      <label for="req-field">Residential District</label>
      <input type="text" id="req-field" name="req_field" required />
    `);
    const report = analyzeAccessibility(representation, doc);
    const finding = report.findings.find((f) => f.ruleId === 'REQUIRED_FIELD_INDICATION');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('LOW');
    expect(finding?.category).toBe('FORMS');
    expect(finding?.evidence.hasVisibleIndicator).toBe(false);
  });

  it('21. Verifies fixed rule-level severity weights', () => {
    expect(SEVERITY_WEIGHTS.CRITICAL).toBe(20);
    expect(SEVERITY_WEIGHTS.HIGH).toBe(10);
    expect(SEVERITY_WEIGHTS.MEDIUM).toBe(5);
    expect(SEVERITY_WEIGHTS.LOW).toBe(2);
    expect(SEVERITY_WEIGHTS.INFO).toBe(0);
  });

  it('22. Calculates explainable score accurately with exact formula', () => {
    const mockFindings: AccessibilityFinding[] = [
      {
        id: 'f-1',
        ruleId: 'FORM_MISSING_LABEL',
        category: 'FORMS',
        severity: 'HIGH', // 10
        title: 'T1',
        description: 'D1',
        evidence: {},
        remediation: 'R1',
        confidence: 1.0,
        deterministic: true,
      },
      {
        id: 'f-2',
        ruleId: 'IMAGE_MISSING_ALT',
        category: 'PERCEIVABILITY',
        severity: 'MEDIUM', // 5
        title: 'T2',
        description: 'D2',
        evidence: {},
        remediation: 'R2',
        confidence: 1.0,
        deterministic: true,
      },
      {
        id: 'f-3',
        ruleId: 'FILE_INSTRUCTION_ASSOCIATION',
        category: 'COGNITIVE_LOAD',
        severity: 'LOW', // 2
        title: 'T3',
        description: 'D3',
        evidence: {},
        remediation: 'R3',
        confidence: 1.0,
        deterministic: true,
      },
    ];

    const score = calculateScore(mockFindings);
    // Deduction = 10 + 5 + 2 = 17 => 100 - 17 = 83
    expect(score.rawScore).toBe(83);
    expect(score.finalScore).toBe(83);
    expect(score.penalties.totalDeduction).toBe(17);
    expect(score.band).toBe('Minor barriers');
  });

  it('23. Enforces score boundary clamping between 0 and 100', () => {
    // Empty findings = 100
    const perfectScore = calculateScore([]);
    expect(perfectScore.finalScore).toBe(100);
    expect(perfectScore.band).toBe('Strong baseline');
    expect(resolveScoreBand(100)).toBe('Strong baseline');
    expect(resolveScoreBand(90)).toBe('Strong baseline');
    expect(resolveScoreBand(85)).toBe('Minor barriers');
    expect(resolveScoreBand(65)).toBe('Significant barriers');
    expect(resolveScoreBand(35)).toBe('Major barriers');
    expect(resolveScoreBand(15)).toBe('Severe barriers');

    // Excessive findings = clamped to 0
    const manyCriticals: AccessibilityFinding[] = Array.from({ length: 10 }, (_, i) => ({
      id: `crit-${i}`,
      ruleId: 'DUPLICATE_ID',
      category: 'ROBUSTNESS',
      severity: 'CRITICAL', // 10 * 20 = 200 deduction
      title: 'Crit',
      description: 'Desc',
      evidence: {},
      remediation: 'Rem',
      confidence: 1.0,
      deterministic: true,
    }));

    const zeroScore = calculateScore(manyCriticals);
    expect(zeroScore.rawScore).toBe(-100);
    expect(zeroScore.finalScore).toBe(0);
    expect(zeroScore.band).toBe('Severe barriers');
  });

  it('24. Deduplicates identical findings for the same element and rule', () => {
    const { doc, representation } = createTestDom(`
      <input type="text" id="bad-field" />
    `);
    const report = analyzeAccessibility(representation, doc);
    const missingLabelFindings = report.findings.filter(
      (f) => f.ruleId === 'FORM_MISSING_LABEL' && f.affectedElementId === 'accessos-field-001'
    );
    expect(missingLabelFindings.length).toBe(1);
  });

  it('25. Generates stable, reproducible finding IDs across repeated runs', () => {
    const { doc, representation } = createTestDom(`
      <input type="text" id="test-field" />
      <img src="pic.jpg" />
    `);
    const report1 = analyzeAccessibility(representation, doc);
    const report2 = analyzeAccessibility(representation, doc);

    expect(report1.findings.map((f) => f.id)).toEqual(report2.findings.map((f) => f.id));
    expect(report1.score.finalScore).toBe(report2.score.finalScore);
  });
});
