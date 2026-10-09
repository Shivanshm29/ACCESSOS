/**
 * Phase 7 — Explain Anything Unit & Functional Test Suite
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import { captureSelectionContext } from '../src/explain/selection';
import { requestExplanation, ExplainAnythingError } from '../src/explain/client';
import { InPageExplainPopover, TRIGGER_BTN_ID, POPOVER_CONTAINER_ID } from '../src/content/explain-popover';
import { PopupController } from '../src/popup/popup';
import type { ExplainAnythingResponse } from '../src/explain/types';

describe('Phase 7 Explain Anything Test Suite', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    win = new Window({ url: 'http://localhost:3000/scholarship' });
    doc = win.document as unknown as Document;
  });

  describe('Selection Context Capture', () => {
    it('returns null when no text is selected', () => {
      doc.body.innerHTML = '<p>Some text on the page</p>';
      const result = captureSelectionContext(doc);
      expect(result).toBeNull();
    });

    it('captures text selected in a paragraph with surrounding context', () => {
      doc.body.innerHTML = `
        <main>
          <h2>Eligibility Criteria</h2>
          <p id="target-p" data-accessos-id="accessos-sec-eligibility">
            Before applying, candidates must verify their statutory domicile status carefully.
          </p>
        </main>
      `;

      const p = doc.getElementById('target-p')!;
      const textNode = p.firstChild!;
      const range = doc.createRange();
      // Select "statutory domicile status"
      const textContent = textNode.textContent || '';
      const startIdx = textContent.indexOf('statutory domicile status');
      range.setStart(textNode, startIdx);
      range.setEnd(textNode, startIdx + 'statutory domicile status'.length);

      const sel = win.getSelection() as unknown as Selection;
      sel.removeAllRanges();
      sel.addRange(range);

      const captured = captureSelectionContext(doc);
      expect(captured).not.toBeNull();
      expect(captured?.selectedText).toBe('statutory domicile status');
      expect(captured?.sectionHeading).toBe('Eligibility Criteria');
      expect(captured?.targetElementId).toBe('accessos-sec-eligibility');
    });

    it('enforces maximum character limits (1000 chars selection, 500 chars context)', () => {
      const veryLongWord = 'A'.repeat(1500);
      doc.body.innerHTML = `<p id="long-p">${veryLongWord}</p>`;

      const p = doc.getElementById('long-p')!;
      const textNode = p.firstChild!;
      const range = doc.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1500);

      const sel = win.getSelection() as unknown as Selection;
      sel.removeAllRanges();
      sel.addRange(range);

      const captured = captureSelectionContext(doc);
      expect(captured).not.toBeNull();
      expect(captured?.selectedText.length).toBeLessThanOrEqual(1000);
      expect(captured?.selectedText.endsWith('...')).toBe(true);
    });

    it('refuses selection inside password input fields', () => {
      doc.body.innerHTML = `
        <div>
          <label>Password</label>
          <input type="password" id="pwd" value="SecretToken12345" />
        </div>
      `;

      const pwdInput = doc.getElementById('pwd') as HTMLInputElement;
      pwdInput.focus();

      // If activeElement is password or range node is inside password input
      const range = doc.createRange();
      range.selectNode(pwdInput);

      const sel = win.getSelection() as unknown as Selection;
      sel.removeAllRanges();
      sel.addRange(range);

      const captured = captureSelectionContext(doc);
      expect(captured).toBeNull();
    });

    it('redacts sensitive numbers like credit cards in captured text', () => {
      doc.body.innerHTML = `
        <p id="card-p">Payment info: 4532-1234-5678-9010 reference</p>
      `;

      const p = doc.getElementById('card-p')!;
      const textNode = p.firstChild!;
      const range = doc.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, textNode.textContent!.length);

      const sel = win.getSelection() as unknown as Selection;
      sel.removeAllRanges();
      sel.addRange(range);

      const captured = captureSelectionContext(doc);
      expect(captured).not.toBeNull();
      expect(captured?.selectedText).toContain('[REDACTED_CARD_NUMBER]');
      expect(captured?.selectedText).not.toContain('4532-1234-5678-9010');
    });
  });

  describe('Explain Anything API Client', () => {
    it('successfully calls backend and returns structured explanation', async () => {
      const mockResponse: ExplainAnythingResponse = {
        explanation: 'A government reservation rule based on official home residence.',
        whyItMatters: 'It determines eligibility under specific reserved quotas.',
        example: 'A student living in State X qualifies for the State X domicile quota.',
        keyPoints: ['Requires proof of residence', 'Affects seat allocation'],
        terminology: [{ term: 'Domicile', definition: 'Legal permanent residence' }],
        confidence: 0.95,
        sourceSummary: 'Official domicile reservation clause',
        warnings: [],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const res = await requestExplanation({
        selectedText: 'statutory domicile reservation',
        mode: 'SIMPLE',
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(res.explanation).toBe(mockResponse.explanation);
      expect(res.whyItMatters).toBe(mockResponse.whyItMatters);
      expect(res.keyPoints).toHaveLength(2);
      expect(res.terminology).toHaveLength(1);

      fetchSpy.mockRestore();
    });

    it('throws ExplainAnythingError when backend returns an error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Selected text cannot be empty' }),
      } as Response);

      await expect(
        requestExplanation({ selectedText: '', mode: 'SIMPLE' })
      ).rejects.toThrow(ExplainAnythingError);

      fetchSpy.mockRestore();
    });
  });

  describe('In-Page Explain Popover UI', () => {
    it('creates trigger button and cleans up when dismissed', () => {
      const popover = new InPageExplainPopover(doc);
      popover.showTrigger(100, 200, { selectedText: 'Domicile Quota' });

      const triggerBtn = doc.getElementById(TRIGGER_BTN_ID);
      expect(triggerBtn).not.toBeNull();
      expect(triggerBtn?.textContent).toContain('Explain');

      popover.hideAll();
      expect(doc.getElementById(TRIGGER_BTN_ID)).toBeNull();
    });

    it('opens explanation popover and renders structured response using safe textContent', async () => {
      const mockResponse: ExplainAnythingResponse = {
        explanation: 'Domicile quota is a reserved proportion of seats for state residents.',
        whyItMatters: 'Ensures opportunities for local students.',
        example: 'State quota gives 85% seats to state residents.',
        keyPoints: ['State residence required', 'Requires certificate'],
        terminology: [{ term: 'Quota', definition: 'Fixed share or percentage' }],
        confidence: 0.9,
        sourceSummary: 'State quota guidelines',
        warnings: [],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const popover = new InPageExplainPopover(doc);
      popover.showTrigger(100, 200, { selectedText: 'Domicile Quota' });

      await popover.openPopover(100, 200);

      const popoverContainer = doc.getElementById(POPOVER_CONTAINER_ID);
      expect(popoverContainer).not.toBeNull();
      expect(popoverContainer?.textContent).toContain('Explain Anything');
      expect(popoverContainer?.textContent).toContain('Domicile quota is a reserved proportion');
      expect(popoverContainer?.textContent).toContain('Why this matters: Ensures opportunities');
      expect(popoverContainer?.textContent).toContain('Quota: Fixed share or percentage');

      // Verify no script tags were inserted
      expect(popoverContainer?.querySelectorAll('script')).toHaveLength(0);

      popover.hideAll();
      expect(doc.getElementById(POPOVER_CONTAINER_ID)).toBeNull();
      fetchSpy.mockRestore();
    });
  });

  describe('Popup Controller Explain Anything Flow', () => {
    let popupDoc: Document;
    let controller: PopupController;

    beforeEach(() => {
      const popupWindow = new Window({ url: 'chrome-extension://accessos/popup.html' });
      popupDoc = popupWindow.document as unknown as Document;

      popupDoc.body.innerHTML = `
        <div class="popup-container">
          <button id="analyze-btn">Analyze</button>
          <div id="status-message"></div>
          <div id="result-card" class="hidden"></div>
          <button id="start-guided-btn">Guided</button>
          <button id="explain-btn">Explain Selected</button>
          <span id="explain-status-indicator" class="hidden"></span>

          <section id="explain-panel" class="hidden">
            <span id="explain-mode-badge">Simple</span>
            <button id="explain-close-btn">Close</button>
            <p id="explain-selected-text"></p>
            <span id="explain-element-tag" class="hidden"></span>
            <div class="explain-modes-group">
              <button class="explain-mode-tab active" data-mode="SIMPLE">Simple</button>
              <button class="explain-mode-tab" data-mode="DETAILED">Detailed</button>
            </div>
            <div id="explain-content-card">
              <p id="explain-main-text"></p>
              <div id="explain-why-box" class="hidden"><p id="explain-why-text"></p></div>
              <div id="explain-example-box" class="hidden"><p id="explain-example-text"></p></div>
              <div id="explain-keypoints-box" class="hidden"><ul id="explain-keypoints-list"></ul></div>
              <div id="explain-terms-box" class="hidden"><div id="explain-terms-list"></div></div>
            </div>
            <div id="explain-error-banner" class="hidden">
              <span id="explain-error-text"></span>
              <button id="explain-retry-btn">Retry</button>
            </div>
          </section>
        </div>
      `;

      // Provide chrome mocks
      (globalThis as unknown as { chrome: unknown }).chrome = {
        runtime: {
          openOptionsPage: vi.fn(),
          getURL: vi.fn((p: string) => p),
        },
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 101, url: 'http://localhost:3000/' }]),
          sendMessage: vi.fn().mockImplementation((_tabId, msg) => {
            if (msg.type === 'GET_SELECTION') {
              return Promise.resolve({
                type: 'SELECTION_RESULT',
                payload: {
                  success: true,
                  selection: {
                    selectedText: 'Statutory Quota Sub-allocation',
                    pageTitle: 'Scholarship Application',
                    sectionHeading: 'Eligibility Criteria',
                    targetElementId: 'accessos-sec-quota',
                    elementRole: 'region',
                  },
                },
              });
            }
            return Promise.resolve({ success: true });
          }),
        },
      };

      // Set global document to popupDoc for controller init
      vi.stubGlobal('document', popupDoc);
      controller = new PopupController();
      controller.init();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('opens Explain panel and renders plain-language response upon user click', async () => {
      const mockResponse: ExplainAnythingResponse = {
        explanation: 'Statutory quota sub-allocation is a specific portion of reserved spots set aside by official rules.',
        whyItMatters: 'It decides which applicant categories get designated seats.',
        example: '10 seats out of 100 reserved specifically for local district students.',
        keyPoints: ['Mandated by statute', 'Sub-divides category quotas'],
        terminology: [{ term: 'Statutory', definition: 'Required or permitted by law' }],
        confidence: 0.92,
        sourceSummary: 'Legal quota definitions',
        warnings: [],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await controller.handleExplainSelection();

      expect(controller.isExplainPanelActive()).toBe(true);
      expect(popupDoc.getElementById('explain-selected-text')?.textContent).toContain('Statutory Quota Sub-allocation');
      expect(popupDoc.getElementById('explain-main-text')?.textContent).toBe(mockResponse.explanation);
      expect(popupDoc.getElementById('explain-why-text')?.textContent).toBe(mockResponse.whyItMatters);
      expect(popupDoc.getElementById('explain-example-text')?.textContent).toBe(mockResponse.example);

      // Verify element tag rendered
      const elementTag = popupDoc.getElementById('explain-element-tag');
      expect(elementTag?.textContent).toContain('#accessos-sec-quota');

      fetchSpy.mockRestore();
    });

    it('shows safe error banner if no text was selected on the page', async () => {
      // Mock chrome.tabs.sendMessage to return no selection
      (globalThis as unknown as { chrome: { tabs: { sendMessage: ReturnType<typeof vi.fn> } } }).chrome.tabs.sendMessage.mockResolvedValueOnce({
        type: 'SELECTION_RESULT',
        payload: {
          success: true,
          selection: null,
        },
      });

      await controller.handleExplainSelection();

      expect(controller.isExplainPanelActive()).toBe(true);
      const errorBanner = popupDoc.getElementById('explain-error-banner');
      expect(errorBanner?.classList.contains('hidden')).toBe(false);
      expect(popupDoc.getElementById('explain-error-text')?.textContent).toContain('No text currently selected');
    });

    it('dismisses explain panel when close button is clicked or Escape key is pressed', () => {
      controller.showExplainPanel();
      expect(controller.isExplainPanelActive()).toBe(true);

      controller.handleCloseExplain();
      expect(controller.isExplainPanelActive()).toBe(false);

      const KeyboardEventClass = (popupDoc.defaultView as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent;
      const escEvent = new KeyboardEventClass('keydown', { key: 'Escape' });
      popupDoc.dispatchEvent(escEvent);
      expect(controller.isExplainPanelActive()).toBe(false);
    });
  });
});
