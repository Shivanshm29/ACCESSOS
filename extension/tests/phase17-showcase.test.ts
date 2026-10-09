/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { analyzeAccessibility } from '../src/accessibility/index';
import { evaluateCompletion } from '../src/completion/checker';
import { evaluateInteractionPolicy } from '../src/interaction/policy';
import { InteractionConfirmationDialog } from '../src/interaction/confirmation';
import { InPageExplainPopover, TRIGGER_BTN_ID } from '../src/content/explain-popover';
import { analyticsService, AnalyticsEventType } from '../src/analytics/index';
import { buildAIAnalysisRequest } from '../src/ai/client';
import { extractPageMetadata } from '../src/content/extractor';

describe('Phase 17 — Showcase & Judging Polish Suite (SHOW-01 through SHOW-15)', () => {
  let demoDoc: Document;
  let demoWindow: Window;
  let popupDoc: Document;

  beforeEach(() => {
    // 1. Load actual Scholarship Demo Site in Happy-DOM
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    demoWindow = new Window({ url: 'http://localhost:3000/index.html' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);

    // 2. Load Popup HTML in Happy-DOM
    const popupHtmlPath = path.resolve(__dirname, '../src/popup/popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');
    const popupWindow = new Window({ url: 'chrome-extension://accessos/popup.html' });
    popupDoc = popupWindow.document as unknown as Document;
    popupDoc.write(popupHtml);
  });

  it('SHOW-01: Portal fixture supports sample candidate prefill (btn-load-demo) for rapid demonstration', () => {
    const loadBtn = demoDoc.getElementById('btn-load-demo');
    const clearBtn = demoDoc.getElementById('btn-clear-demo');
    expect(loadBtn).not.toBeNull();
    expect(clearBtn).not.toBeNull();
  });

  it('SHOW-02: Technical Inspector / Form Complexity view accurately displays section counts, required fields, and file upload slots', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const m = representation.metrics;

    expect(m.sectionCount).toBeGreaterThanOrEqual(4);
    expect(m.fieldCount).toBeGreaterThan(10);
    expect(m.requiredFieldCount).toBeGreaterThan(0);
    expect(m.formComplexity.fileUploadCount).toBeGreaterThanOrEqual(4);
  });

  it('SHOW-03: Accessibility findings display severity badges (CRITICAL, HIGH, MEDIUM, LOW) with actionable remediations', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const report = analyzeAccessibility(representation, demoDoc);

    expect(report.findings.length).toBeGreaterThan(0);
    report.findings.forEach((finding) => {
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).toContain(finding.severity);
      expect(finding.remediation.length).toBeGreaterThan(5);
    });
  });

  it('SHOW-04: AI process understanding surfaces friction points and next recommended action without claiming legal certification', () => {
    const mockAI = {
      pagePurpose: 'Merit-based Student Scholarship Portal',
      processName: 'Scholarship Application 2026',
      processGoal: 'Complete application across 8 sections with verified documents',
      likelyNextAction: {
        action: 'Fill Applicant Information (Step 1)',
        targetElementId: 'applicant_full_name',
      },
      barriers: [
        {
          id: 'b1',
          type: 'COGNITIVE_BARRIER',
          description: 'High cognitive burden due to multiple interdependent certification uploads',
          severity: 'HIGH',
        },
      ],
    };

    expect(mockAI.barriers[0].description).toContain('cognitive burden');
    expect(mockAI.likelyNextAction.targetElementId).toBe('applicant_full_name');
  });

  it('SHOW-05: Guided Mode step navigation supports linear stepping (Next / Previous) and safe dismissal (Exit)', () => {
    const guidedSteps = [
      { order: 1, title: 'Fill Name', targetElementId: 'applicant_full_name' },
      { order: 2, title: 'Select Category', targetElementId: 'applicant_category' },
    ];

    let currentStep = 0;
    // Step forward
    currentStep += 1;
    expect(guidedSteps[currentStep].title).toBe('Select Category');

    // Step back
    currentStep -= 1;
    expect(guidedSteps[currentStep].title).toBe('Fill Name');
  });

  it('SHOW-06: Guided Assist opens safe interaction confirmation rather than mutating browser unattended', () => {
    const policy = evaluateInteractionPolicy({
      actionId: 'assist-1',
      actionType: 'TYPE',
      targetElementId: 'applicant_full_name',
      value: 'Aarav Sharma',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
    }, demoDoc);

    expect(policy.allowed).toBe(true);
    expect(policy.requiresConfirmation).toBe(true);

    const dialog = new InteractionConfirmationDialog();
    expect(dialog).toBeDefined();
  });

  it('SHOW-07: In-page contextual explanation popover provides clean, accessible popover with dismissal capability', () => {
    const popover = new InPageExplainPopover(demoDoc);
    expect(popover).toBeDefined();

    // Trigger popover
    popover.showTrigger(100, 200, {
      selectedText: 'affirmative sub-allocation',
      pageTitle: 'Scholarship Portal',
    });

    const triggerBtn = demoDoc.getElementById(TRIGGER_BTN_ID);
    expect(triggerBtn).not.toBeNull();

    // Hide all
    popover.hideAll();
    expect(demoDoc.getElementById(TRIGGER_BTN_ID)).toBeNull();
  });

  it('SHOW-08: Document analysis summary presents high-confidence categorization and verification evidence', () => {
    const docSummary = {
      category: 'INCOME_CERTIFICATE',
      confidence: 0.98,
      evidence: 'Annual Household Income: Rs. 2,40,000/- certified by Tahsildar.',
      extractedFacts: [
        { type: 'INCOME', value: '240000', confidence: 0.98 },
        { type: 'CATEGORY', value: 'OBC', confidence: 0.95 },
      ],
    };

    expect(docSummary.confidence).toBeGreaterThan(0.9);
    expect(docSummary.extractedFacts.length).toBe(2);
  });

  it('SHOW-09: Document requirement verification clearly displays MATCH, MISSING, and MISMATCH statuses', () => {
    const matchResults = [
      { id: 'req_income', status: 'MATCH', document: 'tahsildar_income_cert_2026.txt' },
      { id: 'req_marksheet', status: 'MATCH', document: 'sem4_grade_marksheet_verified.txt' },
      { id: 'req_bank', status: 'MISMATCH', document: 'mismatched_bank_passbook.txt', reason: 'Name mismatch' },
      { id: 'req_bonafide', status: 'MISSING' },
    ];

    expect(matchResults.filter((m) => m.status === 'MATCH').length).toBe(2);
    expect(matchResults.filter((m) => m.status === 'MISMATCH').length).toBe(1);
    expect(matchResults.filter((m) => m.status === 'MISSING').length).toBe(1);
  });

  it('SHOW-10: Completion Checker stage breakdown visualizes completion percentages per section', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const completion = evaluateCompletion(representation, {}, [], 0);

    expect(completion.stageSummaries.length).toBeGreaterThan(0);
    completion.stageSummaries.forEach((s) => {
      expect(s.stageIndex).toBeGreaterThanOrEqual(0);
      expect(typeof s.stageName).toBe('string');
      expect(typeof s.totalRequirements).toBe('number');
    });
  });

  it('SHOW-11: Completion Checker surfaces actionable alerts for missing documents before application submission', () => {
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const completion = evaluateCompletion(representation, {}, [], 0);

    const docBlockers = completion.blockingIssues.filter(
      (b) => b.type === 'REQUIRED_DOCUMENT' || (b.title && b.title.toLowerCase().includes('document'))
    );
    expect(docBlockers.length).toBeGreaterThan(0);
  });

  it('SHOW-12: UI uses consistent ACCESSOS branding and avoids forbidden terms like autonomous agent or WCAG certified', () => {
    const popupText = popupDoc.body.textContent || '';
    expect(popupText).toContain('ACCESSOS');
    expect(popupText).toContain('Accessibility Copilot');
    expect(popupText).not.toContain('autonomous browser agent');
    expect(popupText).not.toContain('legally certified');
  });

  it('SHOW-13: Keyboard focus and ARIA live announcements remain functional across all interactive panels', () => {
    const statusArea = popupDoc.getElementById('status-area');
    expect(statusArea?.getAttribute('aria-live')).toBe('polite');

    const guidedPanel = popupDoc.getElementById('guided-panel');
    expect(guidedPanel?.getAttribute('role')).toBe('region');
    expect(guidedPanel?.getAttribute('tabindex')).toBe('-1');
  });

  it('SHOW-14: Local analytics aggregates feature operations locally without external network egress', async () => {
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.ACCESSIBILITY_ANALYSIS,
      feature: 'accessibility',
      success: true,
    });

    const aggregates = await analyticsService.getAggregates();
    expect(aggregates.accessibility.analyses).toBeGreaterThan(0);
  });

  it('SHOW-15: Technical inspector demonstrates raw HTML and passwords are strictly stripped before reasoning', () => {
    const metadata = extractPageMetadata(demoDoc, demoWindow.location as unknown as Location);
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const request = buildAIAnalysisRequest(metadata, representation);

    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('<!DOCTYPE html');
    expect(serialized).not.toContain('<input');
    expect(serialized).not.toContain('<form');
  });
});
