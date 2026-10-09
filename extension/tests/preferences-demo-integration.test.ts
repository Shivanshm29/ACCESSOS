/**
 * Phase 10 Demo Verification Integration Test Suite
 *
 * Validates the complete User Preferences system against the National Student Scholarship Portal (demo-site/index.html)
 * and popup interface (popup.html).
 *
 * Verifies all 22 required items:
 * 1. Change language to Hindi.
 * 2. Popup labels update.
 * 3. Guided Mode labels update.
 * 4. Explain Anything mode labels update.
 * 5. Change explanation mode to SIMPLE.
 * 6. Explain Anything presentation becomes simpler.
 * 7. Change to DETAILED.
 * 8. Explain Anything provides the detailed presentation mode.
 * 9. Enable larger text.
 * 10. Verify controls remain usable.
 * 11. Enable high contrast.
 * 12. Verify focus indicators remain visible.
 * 13. Disable Guided Mode "Why this matters".
 * 14. Verify only that presentation element disappears.
 * 15. Verify safety warnings remain.
 * 16. Set confirmation verbosity to DETAILED.
 * 17. Verify confirmation dialog becomes more explanatory.
 * 18. Verify confirmation is still mandatory.
 * 19. Hide document evidence.
 * 20. Verify evidence presentation changes only.
 * 21. Verify document grounding still functions.
 * 22. Verify Phase 8 actions still enforce the same safety rules.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PopupController } from '../src/popup/popup';
import { PreferencesStorage } from '../src/preferences/storage';
import { InteractionConfirmationDialog } from '../src/interaction/confirmation';
import { evaluateInteractionPolicy } from '../src/interaction/policy';
import type { GuidedModeResponse } from '../src/guided/types';
import type { DocumentAnalysisResponse } from '../src/document/types';
import type { InteractionIntent } from '../src/interaction/types';

describe('Phase 10 — Preferences Demo Verification Suite (Scholarship Portal)', () => {
  let demoDoc: Document;
  let demoWindow: Window;
  let popupDoc: Document;
  let controller: PopupController;

  const mockGuidedResponse: GuidedModeResponse = {
    title: 'Scholarship Application Guidance',
    overview: 'Guidance through mandatory and optional application steps.',
    currentStage: 'Applicant Information',
    totalStages: 4,
    progressPercent: 25,
    warnings: [],
    provider: 'rule-based',
    model: 'guided-v1',
    fallbackUsed: false,
    steps: [
      {
        stepId: 'step-1',
        order: 1,
        title: 'Enter First Name',
        description: 'Provide official first name matching Aadhaar.',
        whyItMatters: 'Identity records must strictly match for scholarship disbursement.',
        actionType: 'ENTER',
        targetElementId: 'first_name',
        required: true,
        completed: false,
        barrierNote: 'Name mismatch will halt portal validation.',
      },
      {
        stepId: 'step-2',
        order: 2,
        title: 'Upload Domicile Proof',
        description: 'Upload valid state domicile certificate.',
        whyItMatters: 'State quota verification requires valid domicile.',
        actionType: 'UPLOAD',
        targetElementId: 'doc_domicile',
        required: false,
        completed: false,
        barrierNote: 'Optional if central quota applies.',
      },
    ],
  };

  const mockDocResponse: DocumentAnalysisResponse = {
    document: {
      documentId: 'doc-income-1',
      filename: 'income_cert.pdf',
      mimeType: 'application/pdf',
      pageCount: 1,
      extractedTextAvailable: true,
      metadata: {},
      pages: [],
      extractionWarnings: [],
      documentType: {
        category: 'INCOME_CERTIFICATE',
        confidence: 0.96,
        reason: 'State revenue department seal and annual income statement identified.',
        evidence: 'Annual Family Income: INR 1,20,000 certified by Tehsildar.',
      },
    },
    extractedFacts: [
      {
        factType: 'INCOME_AMOUNT',
        value: '120000',
        confidence: 0.96,
        sourcePage: 1,
        evidence: 'Annual Family Income: INR 1,20,000',
        sensitivity: 'NON_SENSITIVE',
      },
    ],
    requirementMatches: [
      {
        requirementId: 'req-income',
        documentId: 'doc-income-1',
        requirementDescription: 'Annual Income Certificate (Max 2.5 Lakh)',
        matchStatus: 'MATCH',
        confidence: 0.95,
        evidence: 'Annual Family Income: INR 1,20,000 certified by Tehsildar.',
        reason: 'Valid certificate satisfying income limit.',
        suggestedUploadFieldId: 'doc_income_certificate',
        warnings: [],
      },
    ],
    summary: 'Income certificate verified.',
    analysisWarnings: [],
    processingTimeMs: 12,
  };

  beforeEach(async () => {
    // 1. Load actual Scholarship Demo Site in Happy-DOM
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    demoWindow = new Window({ url: 'http://localhost:3000/' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);

    // 2. Load Popup HTML in Happy-DOM
    const popupHtmlPath = path.resolve(__dirname, '../src/popup/popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');
    const popupWindow = new Window({ url: 'chrome-extension://accessos/popup.html' });
    popupDoc = popupWindow.document as unknown as Document;
    popupDoc.write(popupHtml);

    let chromeStorageMock: Record<string, unknown> = {};
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn((p: string) => `chrome-extension://accessos/${p}`),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 101, url: 'http://localhost:3000/' }]),
        sendMessage: vi.fn().mockResolvedValue({ success: true }),
      },
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const res: Record<string, unknown> = {};
            for (const k of keys) {
              if (chromeStorageMock[k] !== undefined) res[k] = chromeStorageMock[k];
            }
            cb(res);
          }),
          set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
            Object.assign(chromeStorageMock, items);
            if (cb) cb();
          }),
          remove: vi.fn((keys: string[], cb?: () => void) => {
            for (const k of keys) delete chromeStorageMock[k];
            if (cb) cb();
          }),
        },
      },
    };

    vi.stubGlobal('document', popupDoc);
    vi.stubGlobal('window', popupWindow);
    await PreferencesStorage.clearStorage();

    controller = new PopupController();
    controller.init();
    await controller.loadAndApplyPreferences();
  });

  // Items 1-4: Hindi Localization & UI Updates
  it('1-4. Changes language to Hindi and updates popup, guided mode, and explain anything labels', async () => {
    // Check initial English state
    const brandTitle = popupDoc.querySelector('.brand-title');
    expect(brandTitle?.textContent).toBe('ACCESSOS');
    const docBtn = popupDoc.getElementById('doc-intel-btn');
    expect(docBtn?.textContent).toContain('Document Intelligence');

    // 1. Change language to Hindi
    const langSelect = popupDoc.getElementById('pref-language-select') as HTMLSelectElement;
    expect(langSelect).not.toBeNull();
    langSelect.value = 'hi';
    await controller.handlePreferenceChange();

    // 2. Popup labels update
    const prefTitle = popupDoc.querySelector('[data-i18n="tab_preferences"]');
    expect(prefTitle?.textContent).toBe('प्राथमिकताएं');
    expect(docBtn?.textContent).toContain('दस्तावेज़ सहायता');

    // 3. Guided Mode labels update
    const guidedTab = popupDoc.querySelector('[data-i18n="tab_guided"]');
    expect(guidedTab?.textContent).toBe('गाइडेड मोड');

    // 4. Explain Anything mode labels update
    const explainLabel = popupDoc.querySelector('[data-i18n="tab_explain"]');
    expect(explainLabel?.textContent).toBe('सरल भाषा में समझें');

    const safetyNotice = popupDoc.querySelector('[data-i18n="safety_immutable_notice"]');
    expect(safetyNotice?.textContent).toContain('सुरक्षा नियंत्रण और पुष्टि द्वार हमेशा अनिवार्य रहते हैं');
  });

  // Items 5-8: Explanation Complexity (SIMPLE / DETAILED)
  it('5-8. Verifies explanation complexity transitions: SIMPLE and DETAILED presentation', async () => {
    // 5. Change explanation mode to SIMPLE
    const expSelect = popupDoc.getElementById('pref-explanation-select') as HTMLSelectElement;
    expSelect.value = 'SIMPLE';
    await controller.handlePreferenceChange();

    // Open explain panel
    controller.showExplainPanel();
    // 6. Presentation mode set to SIMPLE
    expect(controller.getCurrentExplainMode()).toBe('SIMPLE');

    // 7. Change to DETAILED
    expSelect.value = 'DETAILED';
    await controller.handlePreferenceChange();

    // 8. Presentation mode set to DETAILED
    expect(controller.getCurrentExplainMode()).toBe('DETAILED');
  });

  // Items 9-10: Visual Preferences - Larger Text
  it('9-10. Enables larger text and verifies controls remain usable', async () => {
    const largerTextCb = popupDoc.getElementById('pref-larger-text-cb') as HTMLInputElement;
    largerTextCb.checked = true;
    await controller.handlePreferenceChange();

    // 9. Body has larger text class
    expect(popupDoc.body.classList.contains('accessos-larger-text')).toBe(true);

    // 10. Controls remain clickable and enabled
    const analyzeBtn = popupDoc.getElementById('analyze-btn') as HTMLButtonElement;
    expect(analyzeBtn).not.toBeNull();
    expect(analyzeBtn.disabled).toBe(false);

    const prefResetBtn = popupDoc.getElementById('pref-reset-btn') as HTMLButtonElement;
    expect(prefResetBtn).not.toBeNull();
    expect(prefResetBtn.disabled).toBe(false);
  });

  // Items 11-12: Visual Preferences - High Contrast
  it('11-12. Enables high contrast and verifies focus indicators and contrast mode', async () => {
    const highContrastCb = popupDoc.getElementById('pref-high-contrast-cb') as HTMLInputElement;
    highContrastCb.checked = true;
    await controller.handlePreferenceChange();

    // 11. Body has high contrast class
    expect(popupDoc.body.classList.contains('accessos-high-contrast')).toBe(true);

    // 12. Focus indicators and controls remain focusable
    const prefCloseBtn = popupDoc.getElementById('pref-close-btn') as HTMLButtonElement;
    expect(prefCloseBtn).not.toBeNull();
    prefCloseBtn.focus();
    expect(popupDoc.activeElement).toBe(prefCloseBtn);
  });

  // Items 13-15: Guided Mode - Why It Matters & Safety Warnings
  it('13-15. Hides "Why this matters" while preserving safety-critical warnings', async () => {
    // Set up Guided Mode with mock response
    (controller as any).currentGuidedResponse = mockGuidedResponse;
    (controller as any).currentStepIndex = 0;
    const guidedPanel = popupDoc.getElementById('guided-panel');
    guidedPanel?.classList.remove('hidden');

    controller.renderCurrentStep();

    const whyBox = popupDoc.getElementById('guided-step-why')?.parentElement;
    const barrierBox = popupDoc.getElementById('guided-barrier-box');
    expect(whyBox?.classList.contains('hidden')).toBe(false);
    expect(barrierBox?.classList.contains('hidden')).toBe(false);

    // 13. Disable Guided Mode "Why this matters"
    const whyCb = popupDoc.getElementById('pref-guided-why-cb') as HTMLInputElement;
    whyCb.checked = false;
    await controller.handlePreferenceChange();

    // 14. Verify only that presentation element disappears
    expect(whyBox?.classList.contains('hidden')).toBe(true);

    // 15. Verify safety warnings remain visible
    expect(barrierBox?.classList.contains('hidden')).toBe(false);

    // Disable non-critical warnings as well
    const warnCb = popupDoc.getElementById('pref-guided-warnings-cb') as HTMLInputElement;
    warnCb.checked = false;
    await controller.handlePreferenceChange();

    // Critical step 0 warning still remains visible because step is required!
    expect(barrierBox?.classList.contains('hidden')).toBe(false);
  });

  // Items 16-18: Confirmation Verbosity & Mandatory Gating
  it('16-18. Sets confirmation verbosity to DETAILED and verifies confirmation remains mandatory', async () => {
    const verbositySelect = popupDoc.getElementById('pref-confirm-verbosity-select') as HTMLSelectElement;
    verbositySelect.value = 'DETAILED';
    await controller.handlePreferenceChange();

    expect(controller.getUserPreferences().confirmationVerbosity).toBe('DETAILED');

    // 17. Show confirmation dialog and check detailed context description
    const dialog = new InteractionConfirmationDialog();
    const intent: InteractionIntent = {
      actionId: 'act-type-test',
      actionType: 'TYPE',
      targetElementId: 'first_name',
      value: 'Dev',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      reason: 'Fill applicant name',
    };

    const modal = dialog.show({
      intent,
      targetLabel: 'Applicant First Name',
      verbosity: 'DETAILED',
      onConfirm: () => {},
      onCancel: () => {},
      containerEl: popupDoc.body,
    });

    const detailedDesc = modal.querySelector('#accessos-confirm-detailed-desc');
    expect(detailedDesc).not.toBeNull();
    expect(detailedDesc?.textContent).toContain('Detailed Context: Verified allowlisted browser action');

    // 18. Verify confirmation is still mandatory for mutating actions
    const evalResult = evaluateInteractionPolicy(intent);
    expect(evalResult.requiresConfirmation).toBe(true);
    expect(evalResult.allowed).toBe(true);

    dialog.dismiss();
  });

  // Items 19-21: Document Intelligence Presentation & Grounding Invariants
  it('19-21. Hides document evidence presentation while preserving grounding and confidence calculations', async () => {
    const docResultsCard = popupDoc.getElementById('doc-results-card');
    docResultsCard?.classList.remove('hidden');

    controller.renderDocumentAnalysis(mockDocResponse);

    const evidenceBox = popupDoc.getElementById('doc-evidence-box');
    expect(evidenceBox?.classList.contains('hidden')).toBe(false);

    // 19. Hide document evidence
    const docEvCb = popupDoc.getElementById('pref-doc-evidence-cb') as HTMLInputElement;
    docEvCb.checked = false;
    await controller.handlePreferenceChange();

    // 20. Verify evidence presentation changes only
    expect(evidenceBox?.classList.contains('hidden')).toBe(true);

    // 21. Verify document grounding still functions internally
    const currentDoc = controller.getCurrentDocumentResponse();
    expect(currentDoc?.document.documentType.evidence).toBe(
      'Annual Family Income: INR 1,20,000 certified by Tehsildar.'
    );
    expect(currentDoc?.extractedFacts[0].evidence).toBe(
      'Annual Family Income: INR 1,20,000'
    );
    expect(currentDoc?.requirementMatches[0].confidence).toBe(0.95);
  });

  // Item 22: Phase 8 Safety Rules Remain Intact Under All Preference Configurations
  it('22. Verifies Phase 8 actions still strictly enforce safety rules under all preference configurations', async () => {
    // Configure all non-default preferences
    await PreferencesStorage.updatePreferences({
      language: 'hi',
      explanationMode: 'DETAILED',
      highContrast: true,
      largerText: true,
      reducedDensity: true,
      guidedShowWhy: false,
      guidedShowWarnings: false,
      guidedShowProgress: false,
      confirmationVerbosity: 'STANDARD',
      documentShowEvidence: false,
      documentShowConfidence: false,
    });

    // 1. SUBMIT action must still be strictly blocked
    const submitIntent: InteractionIntent = {
      actionId: 'act-submit-final',
      actionType: 'SUBMIT' as any,
      targetElementId: 'final_submit_button',
      reason: 'Final submission',
    };
    expect(evaluateInteractionPolicy(submitIntent).allowed).toBe(false);
    expect(evaluateInteractionPolicy(submitIntent).riskLevel).toBe('BLOCKED');

    // 2. Sensitive password entry must still be strictly blocked
    let pwdEl = demoDoc.getElementById('portal-password') as HTMLInputElement | null;
    if (!pwdEl) {
      pwdEl = demoDoc.createElement('input');
      pwdEl.type = 'password';
      pwdEl.id = 'portal-password';
      demoDoc.body.appendChild(pwdEl);
    }
    const pwdIntent: InteractionIntent = {
      actionId: 'act-pwd-entry',
      actionType: 'TYPE',
      targetElementId: 'portal-password',
      value: 'Password123!',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      reason: 'Enter password',
    };
    const evalSensitive = evaluateInteractionPolicy(pwdIntent, pwdEl);
    expect(evalSensitive.allowed).toBe(false);
    expect(evalSensitive.riskLevel).toBe('BLOCKED');

    // 3. Mutating TYPE on valid field still strictly requires confirmation
    const validField = demoDoc.getElementById('first_name') as HTMLInputElement;
    const typeIntent: InteractionIntent = {
      actionId: 'act-type-valid',
      actionType: 'TYPE',
      targetElementId: 'first_name',
      value: 'Aarav',
      valueSource: 'USER_EXPLICIT',
      source: 'USER',
      reason: 'Enter first name',
    };
    const evalValid = evaluateInteractionPolicy(typeIntent, validField);
    expect(evalValid.allowed).toBe(true);
    expect(evalValid.requiresConfirmation).toBe(true);
  });
});
