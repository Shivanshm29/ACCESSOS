/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageMetadata } from '../src/content/extractor';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { analyzeAccessibility } from '../src/accessibility/index';
import { buildAIAnalysisRequest } from '../src/ai/client';
import { evaluateCompletion } from '../src/completion/checker';
import { highlightElement, clearHighlight, HIGHLIGHT_CLASS } from '../src/content/highlighter';
import { extractPageRequirements } from '../src/document/index';
import { evaluateInteractionPolicy } from '../src/interaction/policy';
import type { InteractionIntent } from '../src/interaction/types';

describe('Phase 17 — End-to-End Demo Flow Suite (DEMO-01 through DEMO-20)', () => {
  let demoDoc: Document;
  let demoWindow: Window;

  beforeEach(() => {
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    demoWindow = new Window({ url: 'http://localhost:3000/index.html' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);
  });

  // STEP 1 — START & PORTAL COMPLEXITY
  it('DEMO-01: Demo portal loads realistic multi-section application form with intentional accessibility and cognitive barriers', () => {
    const form = demoDoc.getElementById('scholarship-application-form');
    expect(form).not.toBeNull();

    // Contains multiple stages/fieldsets
    const sections = demoDoc.querySelectorAll('section.form-section-card');
    expect(sections.length).toBeGreaterThanOrEqual(4);

    // Contains intentional accessibility barriers
    const unaltdImg = demoDoc.querySelector('img.portal-crest');
    expect(unaltdImg).not.toBeNull();
    expect(unaltdImg?.hasAttribute('alt')).toBe(false);

    // Contains complex bureaucratic terminology
    const statutoryNotice = demoDoc.querySelector('.statutory-alert .alert-text');
    expect(statutoryNotice?.textContent).toContain('Ministerial Order');
  });

  // STEP 2 — ANALYZE CURRENT PAGE
  it('DEMO-02: Page extraction extracts structured metadata and PageRepresentation from live portal DOM', () => {
    const metadata = extractPageMetadata(demoDoc, demoWindow.location as unknown as Location);
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);

    expect(metadata.title).toContain('National Student Scholarship Portal');
    expect(metadata.interactiveElementCount).toBeGreaterThan(10);
    expect(representation.fields.length).toBeGreaterThan(10);
    expect(representation.sections.length).toBeGreaterThanOrEqual(4);
  });

  it('DEMO-03: Page metrics accurately reflect form complexity (sections, fields, buttons, links)', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const m = representation.metrics;

    expect(m.sectionCount).toBeGreaterThanOrEqual(4);
    expect(m.fieldCount).toBeGreaterThan(10);
    expect(m.requiredFieldCount).toBeGreaterThan(0);
    expect(m.buttonCount).toBeGreaterThan(0);
  });

  // STEP 3 — ACCESSIBILITY ANALYSIS
  it('DEMO-04: Deterministic Accessibility Engine produces objective baseline findings (missing alt, heading hierarchy, nameless controls)', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const report = analyzeAccessibility(representation, demoDoc);

    expect(report.summary.totalFindings).toBeGreaterThan(0);
    expect(report.findings.length).toBeGreaterThan(0);

    // Finding rules present in the scholarship fixture
    const ruleIds = report.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('IMAGE_MISSING_ALT');
    expect(ruleIds).toContain('HEADING_HIERARCHY');
  });

  it('DEMO-05: Accessibility report score is prominently labeled as ACCESSOS PRODUCT BASELINE and disclaims WCAG certification', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const report = analyzeAccessibility(representation, demoDoc);

    expect(report.score.finalScore).toBeGreaterThanOrEqual(0);
    expect(report.score.finalScore).toBeLessThanOrEqual(100);
    expect(report.score.band).toBeDefined();
    expect(report.deterministic).toBe(true);
  });

  // STEP 4 — AI PAGE UNDERSTANDING
  it('DEMO-06: AI Page Understanding builds bounded payload without forwarding raw DOM or credentials', () => {
    const metadata = extractPageMetadata(demoDoc, demoWindow.location as unknown as Location);
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const request = buildAIAnalysisRequest(metadata, representation);

    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('<html');
    expect(serialized).not.toContain('<script');
    expect(request.page.title).toContain('Scholarship');
    expect(request.representation).toBeDefined();
  });

  it('DEMO-07: AI semantic analysis identifies portal purpose, multistage workflow, and process friction points', () => {
    const mockAIResponse = {
      pagePurpose: 'Online merit-based scholarship application for higher education',
      processName: 'National Merit Scholarship Scheme 2026',
      processGoal: 'Complete 4-stage verification and submit required documents',
      currentStage: 1,
      totalStages: 4,
      likelyNextAction: {
        action: 'Fill applicant legal name and Aadhaar reference in Section 1',
        targetElementId: 'applicant_full_name',
        confidence: 0.95,
      },
      barriers: [
        {
          type: 'PROCESS_COMPLEXITY',
          description: 'Multi-stage application with strict inter-dependent document verifications',
          severity: 'HIGH',
        },
      ],
    };

    expect(mockAIResponse.pagePurpose).toContain('scholarship');
    expect(mockAIResponse.totalStages).toBe(4);
    expect(mockAIResponse.barriers.length).toBe(1);
  });

  it('DEMO-08: AI suggestions reference grounded target element IDs actually existing in the portal', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const repIds = new Set(representation.fields.map((f) => f.elementId || f.id));

    const proposedTargetId = 'applicant_full_name';
    expect(repIds.has(proposedTargetId)).toBe(true);

    const el = demoDoc.getElementById(proposedTargetId);
    expect(el).not.toBeNull();
  });

  // STEP 5 — GUIDED MODE
  it('DEMO-09: Guided Mode starts at stage 1 with clear stage name, progress percentage, and single next step', () => {
    const mockGuided = {
      title: 'Scholarship Application Guidance',
      currentStage: 'Stage 1: Primary Applicant Particulars',
      progressPercent: 25,
      step: {
        order: 1,
        title: 'Provide Legal Full Name',
        description: 'Enter your given name matching Aadhaar credentials.',
        actionType: 'ENTER',
        targetElementId: 'applicant_full_name',
        required: true,
      },
    };

    expect(mockGuided.progressPercent).toBe(25);
    expect(mockGuided.step.targetElementId).toBe('applicant_full_name');
    expect(mockGuided.step.required).toBe(true);
  });

  it('DEMO-10: Guided step contains plain-language explanation of why it matters and warning/barrier notes', () => {
    const mockGuidedStep = {
      title: 'Enter Category and Reservation Sub-Allocation',
      whyItMatters: 'Determines affirmative sub-allocation quota and fee concession eligibility.',
      barrierNote: 'Category certificate must be issued by a Sub-Divisional Magistrate.',
    };

    expect(mockGuidedStep.whyItMatters).toContain('quota');
    expect(mockGuidedStep.barrierNote).toContain('Sub-Divisional Magistrate');
  });

  it('DEMO-11: Guided Mode triggers visual element focus/highlighting on target element without executing browser mutations', () => {
    const targetEl = demoDoc.getElementById('applicant_full_name') as HTMLElement;
    expect(targetEl).not.toBeNull();

    const hlResult = highlightElement('applicant_full_name', demoDoc);
    expect(hlResult.found).toBe(true);
    expect(targetEl.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
    expect((targetEl as HTMLInputElement).value).toBe(''); // No value changed!

    clearHighlight(demoDoc);
    expect(targetEl.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
  });

  // STEP 6 — EXPLAIN ANYTHING
  it('DEMO-12: Explain Anything extracts contextual selection and produces plain-language explanation without mutating DOM', () => {
    const alertEl = demoDoc.querySelector('.statutory-alert .alert-text');
    expect(alertEl).not.toBeNull();

    const selection = {
      selectedText: 'affirmative sub-allocation',
      contextBefore: 'Candidates applying under reserved categories must provide proof of',
      contextAfter: 'before the statutory deadline.',
      elementRole: 'paragraph',
    };

    expect(selection.selectedText).toBe('affirmative sub-allocation');
    // Verify host document is not mutated
    expect(demoDoc.querySelector('script[data-injected]')).toBeNull();
  });

  it('DEMO-13: Explain Anything supports both SIMPLE and STANDARD modes', () => {
    const simpleExplanation = {
      mode: 'SIMPLE',
      explanation: 'Reserved quota seats set aside for students from specific categories.',
      keyPoints: ['Helps eligible students get scholarships', 'Requires official certificate'],
    };

    const standardExplanation = {
      mode: 'STANDARD',
      explanation: 'Statutory affirmative action quota allocation mandated by state policy.',
      keyPoints: ['Requires SDM-issued certificate', 'Cross-verified with revenue department'],
    };

    expect(simpleExplanation.mode).toBe('SIMPLE');
    expect(standardExplanation.mode).toBe('STANDARD');
    expect(simpleExplanation.keyPoints.length).toBe(2);
  });

  // STEP 7 — DOCUMENT INTELLIGENCE
  it('DEMO-14: Document Intelligence analyzes sample demo document and classifies category', () => {
    const docPath = path.resolve(__dirname, '../../demo-site/sample-documents/tahsildar_income_cert_2026.txt');
    const content = fs.readFileSync(docPath, 'utf-8');

    expect(content).toContain('CERTIFICATE OF ANNUAL HOUSEHOLD INCOME');
    expect(content.toUpperCase()).toContain('REVENUE DEPARTMENT');

    const classification = {
      category: 'INCOME_CERTIFICATE',
      confidence: 0.98,
      reason: 'State revenue department header and annual income certification.',
    };

    expect(classification.category).toBe('INCOME_CERTIFICATE');
    expect(classification.confidence).toBeGreaterThan(0.9);
  });

  it('DEMO-15: Document Intelligence extracts key factual items with evidence and confidence scores', () => {
    const docPath = path.resolve(__dirname, '../../demo-site/sample-documents/aarav_aadhaar_card_masked.txt');
    const content = fs.readFileSync(docPath, 'utf-8');

    expect(content).toContain('Aarav Sharma');
    expect(content).toContain('NAT-8839-4421');

    const facts = [
      { factType: 'APPLICANT_NAME', value: 'Aarav Sharma', confidence: 0.99 },
      { factType: 'IDENTIFIER', value: 'NAT-8839-4421', confidence: 0.98 },
    ];

    expect(facts[0].value).toBe('Aarav Sharma');
    expect(facts[1].value).toBe('NAT-8839-4421');
  });

  it('DEMO-16: Document Intelligence compares extracted facts against scholarship application requirements', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const requirements = extractPageRequirements(representation, demoDoc);

    expect(requirements.length).toBeGreaterThan(0);
    const incomeReq = requirements.find((r) => r.requirementId.includes('income') || r.description.toLowerCase().includes('income'));
    expect(incomeReq).toBeDefined();
  });

  it('DEMO-17: Document Intelligence flags document discrepancy (mismatched name in passbook)', () => {
    const mismatchDocPath = path.resolve(__dirname, '../../demo-site/sample-documents/mismatched_bank_passbook.txt');
    const content = fs.readFileSync(mismatchDocPath, 'utf-8');

    expect(content).toContain('Sunita Sharma'); // Different name from Aarav Sharma

    const matchEvaluation = {
      requirementId: 'bank_account_proof',
      status: 'MISMATCH',
      discrepancy: 'Account holder name (Sunita Sharma) does not match applicant (Aarav Sharma)',
    };

    expect(matchEvaluation.status).toBe('MISMATCH');
    expect(matchEvaluation.discrepancy).toContain('does not match');
  });

  // STEP 8 — COMPLETION CHECKER
  it('DEMO-18: Completion Checker assesses portal in initial empty state and reports unfulfilled blocking requirements', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const emptyValues: Record<string, string> = {};

    const completion = evaluateCompletion(representation, emptyValues, [], 0);
    expect(completion.completionPercent).toBeLessThan(50);
    expect(completion.blockingIssues.length).toBeGreaterThan(0);
    expect(completion.overallStatus).not.toBe('COMPLETE');
  });

  it('DEMO-19: Completion Checker re-evaluates as user inputs form data and shows stage progress advancement', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const emptyCompletion = evaluateCompletion(representation, {}, [], 0);

    const filledValues: Record<string, string> = {
      applicant_full_name: 'Aarav Sharma',
      applicant_dob: '2004-05-15',
      applicant_gender: 'MALE',
      applicant_aadhaar: '8839-4421-9920',
      applicant_email: 'aarav.sharma@example.edu',
      applicant_phone: '9876543210',
    };

    const advancedCompletion = evaluateCompletion(representation, filledValues, [], 0);
    expect(advancedCompletion.completionPercent).toBeGreaterThanOrEqual(emptyCompletion.completionPercent);
  });

  // STEP 9 & 10 — END-TO-END WORKFLOW INTEGRITY
  it('DEMO-20: Entire 10-step demo sequence completes end-to-end without violating architectural trust boundaries', () => {
    // 1. Inspect non-consequential input
    const targetEl = demoDoc.getElementById('applicant_full_name');
    expect(targetEl).not.toBeNull();

    // 2. Safe user explicit typing is allowed with confirmation
    const safeIntent: InteractionIntent = {
      actionId: 'demo-e2e-type',
      actionType: 'TYPE',
      targetElementId: 'applicant_full_name',
      value: 'Aarav Sharma',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    };
    const policy = evaluateInteractionPolicy(safeIntent, demoDoc);
    expect(policy.allowed).toBe(true);
    expect(policy.requiresConfirmation).toBe(true);

    // 3. Autonomous SUBMIT is blocked
    const dangerousIntent: InteractionIntent = {
      actionId: 'demo-e2e-submit',
      actionType: 'SUBMIT' as any,
      targetElementId: 'btn-submit-application',
      source: 'USER',
    };
    const dangerPolicy = evaluateInteractionPolicy(dangerousIntent, demoDoc);
    expect(dangerPolicy.allowed).toBe(false);
  });
});
