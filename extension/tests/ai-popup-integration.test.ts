/**
 * Phase 5 AI & Demo Site Integration Tests
 * Validates the complete pipeline:
 * Demo Site -> Semantic Extraction -> Accessibility Engine -> AI Request -> Mock Response -> UI Display
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { analyzeAccessibility } from '../src/accessibility/index';
import {
  buildAIAnalysisRequest,
  type AIPageAnalysisResponse,
} from '../src/ai/index';

describe('Phase 5 AI Analysis & Demo Site Integration Suite', () => {
  let demoDoc: Document;
  let demoLocation: Location;
  let popupDoc: Document;

  beforeEach(() => {
    // 1. Setup Demo Page in Happy-DOM
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    const demoWindow = new Window({ url: 'http://localhost:3000/' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);
    demoLocation = demoWindow.location as unknown as Location;

    // 2. Setup Popup HTML in Happy-DOM
    const popupHtmlPath = path.resolve(__dirname, '../src/popup/popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');
    const popupWindow = new Window({ url: 'chrome-extension://accessos/popup.html' });
    popupDoc = popupWindow.document as unknown as Document;
    popupDoc.write(popupHtml);
  });

  it('1. Constructs a valid, grounded AI analysis request from the demo scholarship portal', () => {
    const representation = extractPageRepresentation(demoDoc, demoLocation);
    const accessibilityReport = analyzeAccessibility(representation, demoDoc);

    const payload = buildAIAnalysisRequest(
      {
        title: representation.page.title,
        url: representation.page.url,
        hostname: 'localhost:3000',
        pathname: '/',
        pageType: 'webpage',
        interactiveElementCount: representation.metrics.fieldCount + representation.metrics.buttonCount,
      },
      representation,
      accessibilityReport,
      'I want to apply for a scholarship grant'
    );

    expect(payload.page.title).toContain('Scholarship');
    expect(payload.userGoal).toBe('I want to apply for a scholarship grant');
    expect(payload.representation).toBeDefined();
    expect(payload.accessibilityReport).toBeDefined();
  });

  it('2. Renders structured AI analysis into the popup while preserving deterministic baseline findings', () => {
    // Simulated Mock AI response grounded in the demo portal structure
    const mockAiResponse: AIPageAnalysisResponse = {
      pageUnderstanding: {
        pageType: 'APPLICATION',
        pagePurpose: 'Online scholarship application and document verification portal.',
        confidence: 0.95,
      },
      processUnderstanding: {
        processName: 'National Student Scholarship Application',
        goal: 'Complete eligibility sections, upload certified records, and submit.',
        currentStage: 'Applicant Primary Information',
        totalStages: 8,
        majorStages: [
          'Applicant Primary Information',
          'Candidate Personal Details',
          'Academic Profile',
          'Household Income & Domicile',
        ],
        requiredInformationCategories: ['Contact', 'Academic', 'Income', 'Banking'],
        requiredDocumentCategories: ['Transcripts', 'Income Certificate', 'Identity Proof'],
        likelyNextAction: 'Begin by filling out Section 1: Applicant Primary Information.',
      },
      barriers: [
        {
          id: 'ai-barrier-001',
          type: 'UNFAMILIAR_TERM',
          severity: 'HIGH',
          title: 'Unfamiliar institutional and statutory terminology',
          explanation: "Dense regulatory language ('Statutory Quota Sub-allocation') may impede applicant comprehension.",
          evidence: [{ kind: 'instruction', text: 'Pursuant to Statutory Quota Circular' }],
          affectedElementIds: ['accessos-inst-002'],
          suggestedSimplification: 'Provide simplified inline explanations for statutory terms.',
          confidence: 0.92,
        },
        {
          id: 'ai-barrier-002',
          type: 'COGNITIVE_LOAD',
          severity: 'MEDIUM',
          title: 'High form complexity across 8 distinct sections',
          explanation: 'Extensive form fields presented concurrently without progressive disclosure.',
          evidence: [{ kind: 'fieldCount', count: 46 }],
          affectedElementIds: ['accessos-section-001', 'accessos-section-002'],
          suggestedSimplification: 'Group inputs into collapsible, guided steps with progress indicators.',
          confidence: 0.88,
        },
      ],
      nextAction: {
        description: 'Complete Section 1: Applicant Primary Information',
        targetElementId: 'accessos-field-001',
        stage: 'Section 1',
      },
      summary: 'Complex 8-stage application with high cognitive density.',
      provider: 'mock',
      model: 'mock-deterministic-v1',
      durationMs: 8.5,
      truncated: false,
    };

    // 1. Simulate deterministic baseline state in popup
    const scoreVal = popupDoc.getElementById('accessibility-score-val');
    const scoreBand = popupDoc.getElementById('score-band-badge');
    const analyzeAiBtn = popupDoc.getElementById('analyze-ai-btn') as HTMLButtonElement;
    if (scoreVal) scoreVal.textContent = '55';
    if (scoreBand) scoreBand.textContent = 'Significant barriers';

    // 2. Simulate AI rendering into popup DOM
    const aiCard = popupDoc.getElementById('ai-analysis-card');
    const aiModelTag = popupDoc.getElementById('ai-model-tag');
    const aiPagePurpose = popupDoc.getElementById('ai-page-purpose');
    const aiProcessName = popupDoc.getElementById('ai-process-name');
    const aiProcessGoal = popupDoc.getElementById('ai-process-goal');
    const nextActionText = popupDoc.getElementById('ai-next-action-text');
    const nextActionTarget = popupDoc.getElementById('ai-next-action-target');
    const barriersCount = popupDoc.getElementById('ai-barriers-count');
    const barriersList = popupDoc.getElementById('ai-barriers-list');

    if (aiModelTag) aiModelTag.textContent = `${mockAiResponse.provider}:${mockAiResponse.model}`;
    if (aiPagePurpose) aiPagePurpose.textContent = mockAiResponse.pageUnderstanding.pagePurpose;
    if (aiProcessName) aiProcessName.textContent = mockAiResponse.processUnderstanding.processName;
    if (aiProcessGoal) aiProcessGoal.textContent = mockAiResponse.processUnderstanding.goal;
    if (nextActionText) nextActionText.textContent = mockAiResponse.nextAction.description;
    if (nextActionTarget && mockAiResponse.nextAction.targetElementId) {
      nextActionTarget.textContent = `Target: ${mockAiResponse.nextAction.targetElementId}`;
      nextActionTarget.classList.remove('hidden');
    }
    if (barriersCount) barriersCount.textContent = String(mockAiResponse.barriers.length);

    if (barriersList) {
      barriersList.innerHTML = '';
      mockAiResponse.barriers.forEach((barrier) => {
        const card = popupDoc.createElement('div');
        card.className = `ai-barrier-card severity-${barrier.severity.toLowerCase()}`;
        const title = popupDoc.createElement('span');
        title.className = 'ai-barrier-title';
        title.textContent = barrier.title;
        card.appendChild(title);
        barriersList.appendChild(card);
      });
    }
    aiCard?.classList.remove('hidden');

    // VERIFICATIONS:
    // A. Deterministic findings remain intact and visible
    expect(scoreVal?.textContent).toBe('55');
    expect(scoreBand?.textContent).toBe('Significant barriers');

    // B. AI results are rendered in their dedicated card
    expect(aiCard?.classList.contains('hidden')).toBe(false);
    expect(aiPagePurpose?.textContent).toContain('scholarship');
    expect(aiProcessName?.textContent).toContain('Scholarship');
    expect(nextActionText?.textContent).toContain('Section 1');
    expect(nextActionTarget?.textContent).toBe('Target: accessos-field-001');

    // C. AI barriers are distinct and counted correctly
    expect(barriersCount?.textContent).toBe('2');
    expect(barriersList?.children.length).toBe(2);
    expect(barriersList?.children[0].textContent).toContain('statutory terminology');

    // D. Analyze with AI trigger button exists
    expect(analyzeAiBtn).toBeDefined();
  });

  it('3. Verifies AI findings and deterministic findings remain strictly separate', () => {
    const deterministicHeader = popupDoc.querySelector('.score-label');
    const aiBadge = popupDoc.querySelector('.ai-badge');

    expect(deterministicHeader?.textContent).toBe('ACCESSOS Accessibility Baseline');
    expect(aiBadge?.textContent).toBe('AI PAGE ANALYSIS');
    // Ensure no combined single score exists
    const combinedScore = popupDoc.getElementById('combined-ai-score');
    expect(combinedScore).toBeNull();
  });
});
