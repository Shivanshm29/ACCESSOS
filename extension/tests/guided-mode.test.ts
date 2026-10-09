/**
 * Guided Mode Unit Tests
 * Verifies request building, API client handling, element highlighting, and popup UI navigation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildGuidedModeRequest,
  requestGuidedModeStart,
  GuidedModeError,
} from '../src/guided/client';
import type { GuidedModeResponse } from '../src/guided/types';
import {
  highlightElement,
  clearHighlight,
  HIGHLIGHT_CLASS,
} from '../src/content/highlighter';
import { PopupController } from '../src/popup/popup';
import type { PageMetadata, PageRepresentation } from '../src/core/types/index';

describe('Guided Mode Client & Request Suite', () => {
  const dummyMetadata: PageMetadata = {
    title: 'Scholarship Application',
    url: 'https://example.gov/scholarship',
    hostname: 'example.gov',
    pathname: '/scholarship',
    pageType: 'webpage',
    interactiveElementCount: 25,
  };

  it('1. Builds a clean, sanitized Guided Mode request payload without sensitive form values or raw HTML', () => {
    const representation: Partial<PageRepresentation> = {
      page: {
        title: 'Scholarship Application',
        url: 'https://example.gov/scholarship',
        hostname: 'example.gov',
        pathname: '/scholarship',
      },
      fields: [
        {
          id: 'accessos-field-001',
          tag: 'input',
          order: 1,
          elementId: 'fname',
          name: 'first_name',
          type: 'text',
          label: 'First Name',
          labelSource: 'explicit-label',
          required: true,
          disabled: false,
          readonly: false,
          sensitive: false,
          hasValue: true, // Note: boolean only, never the actual user name!
          validationAttributes: { minLength: 2 },
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
      dummyMetadata,
      representation as unknown as PageRepresentation,
      undefined,
      undefined,
      'Complete the scholarship form'
    );

    expect(request.page.title).toBe('Scholarship Application');
    expect(request.page.url).toBe('https://example.gov/scholarship');
    expect(request.userGoal).toBe('Complete the scholarship form');
    expect(request.representation).toBeDefined();

    // Verify no raw HTML or DOM was attached
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('<input');
    expect(serialized).not.toContain('<form');
    expect(serialized).not.toContain('outerHTML');
  });

  it('2. Handles API response success properly in requestGuidedModeStart', async () => {
    const mockResponse: GuidedModeResponse = {
      title: 'Scholarship Application Guide',
      overview: 'Step by step navigation',
      currentStage: 'Stage 1: Primary Info',
      totalStages: 8,
      progressPercent: 12,
      steps: [
        {
          stepId: 'step-1',
          order: 1,
          title: 'Enter First Name',
          description: 'Provide your legal first name',
          targetElementId: 'accessos-field-001',
          actionType: 'ENTER',
          whyItMatters: 'Identifies applicant',
          required: true,
          completed: false,
        },
      ],
      warnings: [],
      provider: 'mock',
      model: 'mock-v1',
      fallbackUsed: false,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await requestGuidedModeStart({ page: { title: 'Test' } });
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].targetElementId).toBe('accessos-field-001');
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('3. Throws GuidedModeError with friendly user message on HTTP error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'AI model service unavailable' }),
    } as unknown as Response);

    try {
      await requestGuidedModeStart({ page: { title: 'Test' } });
      expect.unreachable('Should have thrown GuidedModeError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(GuidedModeError);
      expect((err as GuidedModeError).message).toContain('HTTP 503');
      expect((err as GuidedModeError).userMessage).toBe('AI model service unavailable');
    }
    fetchSpy.mockRestore();
  });

  it('4. Handles request timeout / abort gracefully', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce({
      name: 'AbortError',
      message: 'The operation was aborted',
    });

    await expect(requestGuidedModeStart({ page: { title: 'Test' } })).rejects.toThrow(
      GuidedModeError
    );
    fetchSpy.mockRestore();
  });
});

describe('Safe Element Highlighter Suite', () => {
  let doc: Document;

  beforeEach(() => {
    const window = new Window({ url: 'http://localhost/' });
    doc = window.document as unknown as Document;
    doc.body.innerHTML = `
      <div id="container">
        <label for="fname">First Name</label>
        <input type="text" id="fname" data-accessos-id="accessos-field-001" value="John" />
        <button type="submit" id="submit-btn" data-accessos-id="accessos-btn-submit">Submit</button>
      </div>
    `;
  });

  afterEach(() => {
    clearHighlight(doc);
  });

  it('1. Successfully highlights element by ACCESSOS stable ID and applies highlight class', () => {
    const res = highlightElement('accessos-field-001', doc);
    expect(res.success).toBe(true);
    expect(res.found).toBe(true);
    expect(res.elementId).toBe('accessos-field-001');

    const input = doc.querySelector('[data-accessos-id="accessos-field-001"]');
    expect(input?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
  });

  it('2. Successfully clears highlight from the document', () => {
    highlightElement('accessos-field-001', doc);
    const input = doc.querySelector('[data-accessos-id="accessos-field-001"]');
    expect(input?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    clearHighlight(doc);
    expect(input?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
  });

  it('3. Safely handles non-existent or stale target element ID', () => {
    const res = highlightElement('accessos-field-nonexistent', doc);
    expect(res.success).toBe(false);
    expect(res.found).toBe(false);
    expect(res.error).toContain('could not be located');
  });

  it('4. Clears previous highlight when highlighting a new element', () => {
    highlightElement('accessos-field-001', doc);
    const input = doc.querySelector('[data-accessos-id="accessos-field-001"]');
    expect(input?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    highlightElement('accessos-btn-submit', doc);
    const btn = doc.querySelector('[data-accessos-id="accessos-btn-submit"]');
    expect(btn?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
    expect(input?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
  });
});

describe('Popup Guided Mode Controller & Navigation Suite', () => {
  let popupDoc: Document;
  let controller: PopupController;

  const mockGuidedResponse: GuidedModeResponse = {
    title: 'Scholarship Application Assistance',
    overview: 'Guidance through stage 1',
    currentStage: 'Stage 1: Primary Information',
    totalStages: 8,
    progressPercent: 15,
    steps: [
      {
        stepId: 'step-1',
        order: 1,
        title: 'Enter First Name',
        description: 'Provide official first name.',
        targetElementId: 'accessos-field-001',
        actionType: 'ENTER',
        whyItMatters: 'Identifies applicant.',
        required: true,
        completed: false,
      },
      {
        stepId: 'step-2',
        order: 2,
        title: 'Upload Income Certificate',
        description: 'Attach valid PDF certificate.',
        targetElementId: 'accessos-field-income-doc',
        actionType: 'UPLOAD',
        whyItMatters: 'Verifies eligibility.',
        required: true,
        completed: false,
        barrierNote: 'Certificate must be under 2MB and digitally signed.',
      },
      {
        stepId: 'step-3',
        order: 3,
        title: 'Review Information',
        description: 'Carefully verify entered data before next section.',
        actionType: 'REVIEW',
        whyItMatters: 'Prevents errors.',
        required: false,
        completed: false,
      },
    ],
    warnings: [],
    provider: 'mock',
    model: 'mock-v1',
    fallbackUsed: false,
  };

  beforeEach(() => {
    const popupHtmlPath = path.resolve(__dirname, '../src/popup/popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');
    const window = new Window({ url: 'chrome-extension://accessos/popup.html' });
    popupDoc = window.document as unknown as Document;
    popupDoc.write(popupHtml);

    // Provide chrome mock APIs
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn((path: string) => `chrome-extension://accessos/${path}`),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123, url: 'http://localhost:3000/' }]),
        sendMessage: vi.fn().mockResolvedValue({ success: true, found: true }),
      },
    };

    // Temporarily replace global document
    (globalThis as unknown as { document: Document }).document = popupDoc;

    controller = new PopupController();
    controller.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders Guided Mode header, stages, and progress percentage correctly', () => {
    controller.renderGuidedMode(mockGuidedResponse);

    const title = popupDoc.getElementById('guided-title');
    const stageBadge = popupDoc.getElementById('guided-stage-badge');
    const progressPercent = popupDoc.getElementById('guided-progress-percent');
    const progressBar = popupDoc.getElementById('guided-progress-bar');
    const progressFill = popupDoc.getElementById('guided-progress-fill');

    expect(title?.textContent).toBe('Scholarship Application Assistance');
    expect(stageBadge?.textContent).toBe('Stage 1 of 8');
    expect(progressPercent?.textContent).toBe('15% Complete');
    expect(progressBar?.getAttribute('aria-valuenow')).toBe('15');
    expect(progressFill?.style.width).toBe('15%');
  });

  it('2. Correctly renders the first step in the sequence', () => {
    controller.renderGuidedMode(mockGuidedResponse);

    const counter = popupDoc.getElementById('guided-step-counter');
    const stepTitle = popupDoc.getElementById('guided-step-title');
    const stepDesc = popupDoc.getElementById('guided-step-desc');
    const stepWhy = popupDoc.getElementById('guided-step-why');
    const actionTag = popupDoc.getElementById('guided-step-action-tag');
    const reqTag = popupDoc.getElementById('guided-step-required-tag');
    const prevBtn = popupDoc.getElementById('guided-prev-btn') as HTMLButtonElement;
    const nextBtn = popupDoc.getElementById('guided-next-btn') as HTMLButtonElement;
    const showTargetBtn = popupDoc.getElementById('guided-show-target-btn') as HTMLButtonElement;

    expect(counter?.textContent).toBe('Step 1 of 3');
    expect(stepTitle?.textContent).toBe('Enter First Name');
    expect(stepDesc?.textContent).toBe('Provide official first name.');
    expect(stepWhy?.textContent).toBe('Identifies applicant.');
    expect(actionTag?.textContent).toBe('ENTER');
    expect(reqTag?.textContent).toBe('Required');
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
    expect(showTargetBtn.disabled).toBe(false);
  });

  it('3. Navigates forward with Next button and renders barrier notes', async () => {
    controller.renderGuidedMode(mockGuidedResponse);
    await controller.handleNextStep();

    const counter = popupDoc.getElementById('guided-step-counter');
    const stepTitle = popupDoc.getElementById('guided-step-title');
    const barrierBox = popupDoc.getElementById('guided-barrier-box');
    const barrierText = popupDoc.getElementById('guided-step-barrier');
    const actionTag = popupDoc.getElementById('guided-step-action-tag');
    const prevBtn = popupDoc.getElementById('guided-prev-btn') as HTMLButtonElement;

    expect(counter?.textContent).toBe('Step 2 of 3');
    expect(stepTitle?.textContent).toBe('Upload Income Certificate');
    expect(actionTag?.textContent).toBe('UPLOAD');
    expect(barrierBox?.classList.contains('hidden')).toBe(false);
    expect(barrierText?.textContent).toContain('Certificate must be under 2MB');
    expect(prevBtn.disabled).toBe(false);
  });

  it('4. Navigates backward with Previous button', async () => {
    controller.renderGuidedMode(mockGuidedResponse);
    await controller.handleNextStep(); // step 2
    await controller.handleNextStep(); // step 3
    expect(controller.getCurrentStepIndex()).toBe(2);

    await controller.handlePrevStep(); // back to step 2
    expect(controller.getCurrentStepIndex()).toBe(1);

    await controller.handlePrevStep(); // back to step 1
    expect(controller.getCurrentStepIndex()).toBe(0);
    const counter = popupDoc.getElementById('guided-step-counter');
    expect(counter?.textContent).toBe('Step 1 of 3');
  });

  it('5. Disables target button for steps without a DOM element', async () => {
    controller.renderGuidedMode(mockGuidedResponse);
    await controller.handleNextStep(); // step 2
    await controller.handleNextStep(); // step 3 (REVIEW, no targetElementId)

    const showTargetBtn = popupDoc.getElementById('guided-show-target-btn') as HTMLButtonElement;
    expect(showTargetBtn.disabled).toBe(true);
    expect(showTargetBtn.textContent).toBe('No page target');
  });

  it('6. Sends HIGHLIGHT_ELEMENT message when Show on page is clicked', async () => {
    controller.renderGuidedMode(mockGuidedResponse);
    const sendMessageSpy = vi.spyOn(chrome.tabs, 'sendMessage');

    await controller.handleShowTargetOnPage();

    expect(sendMessageSpy).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        type: 'HIGHLIGHT_ELEMENT',
        payload: { targetElementId: 'accessos-field-001' },
      })
    );

    const feedback = popupDoc.getElementById('guided-target-feedback');
    expect(feedback?.textContent).toBe('✓ Located on page');
  });

  it('7. Exits Guided Mode and clears highlight when Exit is triggered', async () => {
    controller.renderGuidedMode(mockGuidedResponse);
    const guidedPanel = popupDoc.getElementById('guided-panel');
    guidedPanel?.classList.remove('hidden');

    const sendMessageSpy = vi.spyOn(chrome.tabs, 'sendMessage');

    await controller.handleExitGuidedMode();

    expect(guidedPanel?.classList.contains('hidden')).toBe(true);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ type: 'CLEAR_HIGHLIGHT' })
    );
  });
});
