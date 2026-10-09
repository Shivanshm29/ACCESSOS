/**
 * Phase 6 Guided Mode Demo Site Integration Tests
 * Validates the complete pipeline against the actual scholarship portal DOM:
 * demo-site/index.html -> extractPageRepresentation -> analyzeAccessibility -> Guided Mode -> Highlighting & UI
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { analyzeAccessibility } from '../src/accessibility/index';
import { buildGuidedModeRequest } from '../src/guided/client';
import { highlightElement, clearHighlight, HIGHLIGHT_CLASS } from '../src/content/highlighter';
import { PopupController } from '../src/popup/popup';
import type { GuidedModeResponse } from '../src/guided/types';

describe('Phase 6 Demo Site Guided Mode Integration Suite', () => {
  let demoDoc: Document;
  let demoLocation: Location;
  let popupDoc: Document;
  let controller: PopupController;

  beforeEach(() => {
    // 1. Load actual Scholarship Demo Site in Happy-DOM
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    const demoWindow = new Window({ url: 'http://localhost:3000/' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);
    demoLocation = demoWindow.location as unknown as Location;

    // 2. Load Popup HTML in Happy-DOM
    const popupHtmlPath = path.resolve(__dirname, '../src/popup/popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');
    const popupWindow = new Window({ url: 'chrome-extension://accessos/popup.html' });
    popupDoc = popupWindow.document as unknown as Document;
    popupDoc.write(popupHtml);

    // Provide chrome mocks
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn((p: string) => `chrome-extension://accessos/${p}`),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 999, url: 'http://localhost:3000/' }]),
        sendMessage: vi.fn().mockImplementation((_tabId, msg) => {
          if (msg.type === 'HIGHLIGHT_ELEMENT') {
            const res = highlightElement(msg.payload.targetElementId, demoDoc);
            return Promise.resolve(res);
          }
          if (msg.type === 'CLEAR_HIGHLIGHT') {
            clearHighlight(demoDoc);
            return Promise.resolve({ success: true, cleared: true });
          }
          return Promise.resolve({ success: true });
        }),
      },
    };

    (globalThis as unknown as { document: Document }).document = popupDoc;
    controller = new PopupController();
    controller.init();
  });

  afterEach(() => {
    clearHighlight(demoDoc);
    vi.restoreAllMocks();
  });

  it('1. Successfully extracts demo site representation and builds sanitized Guided Mode request', () => {
    const representation = extractPageRepresentation(demoDoc, demoLocation);
    const accessibilityReport = analyzeAccessibility(representation, demoDoc);

    // Verify demo site structure has 15 total DOM sections and 46 fields
    expect(representation.metrics.sectionCount).toBe(15);
    expect(representation.metrics.fieldCount).toBe(46);

    const request = buildGuidedModeRequest(
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
      undefined,
      'Apply for scholarship'
    );

    expect(request.page.title).toContain('Scholarship');
    expect(request.userGoal).toBe('Apply for scholarship');
    expect(request.representation).toBeDefined();
    expect(request.accessibilityReport).toBeDefined();
  });

  it('2. Safely highlights First Name field in the demo portal without mutating its value or triggering clicks', () => {
    const representation = extractPageRepresentation(demoDoc, demoLocation);
    const firstField = representation.fields[0];
    expect(firstField).toBeDefined();

    const targetEl = demoDoc.querySelector(`[data-accessos-id="${firstField.id}"]`) as HTMLInputElement;
    expect(targetEl).not.toBeNull();

    const initialVal = targetEl.value;
    const res = highlightElement(firstField.id, demoDoc);

    expect(res.success).toBe(true);
    expect(res.found).toBe(true);
    expect(targetEl.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    // Value must remain untouched
    expect(targetEl.value).toBe(initialVal);
  });

  it('3. Safely highlights file upload input in Stage 7 and removes outline cleanly', () => {
    const representation = extractPageRepresentation(demoDoc, demoLocation);
    const fileFields = representation.fields.filter((f) => f.type === 'file');
    expect(fileFields.length).toBeGreaterThan(0);

    const fileField = fileFields[0];
    const fileInput = demoDoc.querySelector(`[data-accessos-id="${fileField.id}"]`);
    expect(fileInput).not.toBeNull();

    // Highlight
    const res = highlightElement(fileField.id, demoDoc);
    expect(res.success).toBe(true);
    expect(fileInput?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    // Clear
    clearHighlight(demoDoc);
    expect(fileInput?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
  });

  it('4. Full popup guided walkthrough: renders stage 1, steps, highlights target, navigates, and exits', async () => {
    const representation = extractPageRepresentation(demoDoc, demoLocation);
    const firstFieldId = representation.fields[0].id;
    const secondFieldId = representation.fields[1].id;

    const mockResponse: GuidedModeResponse = {
      title: 'National Scholarship Portal Guide',
      overview: 'Step-by-step guidance for the 8-stage scholarship form.',
      currentStage: 'Stage 1: Applicant Primary Information',
      totalStages: 8,
      progressPercent: 12,
      steps: [
        {
          stepId: 'step-1',
          order: 1,
          title: 'Enter First Name',
          description: 'Type your official first name.',
          targetElementId: firstFieldId,
          actionType: 'ENTER',
          whyItMatters: 'Essential for applicant identity verification.',
          required: true,
          completed: false,
        },
        {
          stepId: 'step-2',
          order: 2,
          title: 'Enter Last Name',
          description: 'Type your official surname.',
          targetElementId: secondFieldId,
          actionType: 'ENTER',
          whyItMatters: 'Completes formal legal name record.',
          required: true,
          completed: false,
        },
      ],
      warnings: [],
      provider: 'mock',
      model: 'mock-scholarship-v1',
      fallbackUsed: false,
    };

    // Render into Popup
    controller.renderGuidedMode(mockResponse);

    // 1. Verify stage and progress
    const stageBadge = popupDoc.getElementById('guided-stage-badge');
    const stageName = popupDoc.getElementById('guided-stage-name');
    const progressPercent = popupDoc.getElementById('guided-progress-percent');
    expect(stageBadge?.textContent).toBe('Stage 1 of 8');
    expect(stageName?.textContent).toContain('Applicant Primary Information');
    expect(progressPercent?.textContent).toBe('12% Complete');

    // 2. Trigger "Show on page"
    await controller.handleShowTargetOnPage();
    const targetEl = demoDoc.querySelector(`[data-accessos-id="${firstFieldId}"]`);
    expect(targetEl?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    const feedback = popupDoc.getElementById('guided-target-feedback');
    expect(feedback?.textContent).toBe('✓ Located on page');

    // 3. Navigate Next
    await controller.handleNextStep();
    expect(controller.getCurrentStepIndex()).toBe(1);

    // Previous highlight should have been cleared
    expect(targetEl?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);

    // 4. Highlight step 2
    await controller.handleShowTargetOnPage();
    const secondTargetEl = demoDoc.querySelector(`[data-accessos-id="${secondFieldId}"]`);
    expect(secondTargetEl?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    // 5. Exit Guided Mode
    await controller.handleExitGuidedMode();
    expect(secondTargetEl?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
    const guidedPanel = popupDoc.getElementById('guided-panel');
    expect(guidedPanel?.classList.contains('hidden')).toBe(true);
  });
});
