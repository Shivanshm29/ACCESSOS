/**
 * Phase 7 Demo Site Integration Tests
 * Validates the complete Explain Anything workflow against the actual Scholarship Portal DOM:
 * demo-site/index.html -> Selection capture -> Context bounds -> Sanitization -> Mock AI backend -> Popover / Popup UI
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { captureSelectionContext } from '../src/explain/selection';
import { requestExplanation } from '../src/explain/client';
import { InPageExplainPopover } from '../src/content/explain-popover';
import { PopupController } from '../src/popup/popup';
import type { ExplainAnythingResponse } from '../src/explain/types';

describe('Phase 7 Demo Site Explain Anything Integration Suite', () => {
  let demoDoc: Document;
  let demoWindow: Window;
  let popupDoc: Document;
  let controller: PopupController;

  beforeEach(() => {
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

    // Chrome API mock
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn((p: string) => `chrome-extension://accessos/${p}`),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 101, url: 'http://localhost:3000/' }]),
        sendMessage: vi.fn().mockImplementation((_tabId, msg) => {
          if (msg.type === 'GET_SELECTION') {
            const sel = captureSelectionContext(demoDoc);
            return Promise.resolve({
              type: 'SELECTION_RESULT',
              payload: {
                success: true,
                selection: sel,
              },
            });
          }
          return Promise.resolve({ success: true });
        }),
      },
    };

    vi.stubGlobal('document', popupDoc);
    controller = new PopupController();
    controller.init();
  });

  it('1. Selects "affirmative sub-allocation" from Domicile section and verifies context', () => {
    // Locate the notice text under Personal Details & Domicile Classification
    const noticeP = demoDoc.querySelector('.section-description.dense-instruction');
    expect(noticeP).not.toBeNull();
    const noticeText = noticeP?.textContent || '';
    expect(noticeText).toContain('affirmative sub-allocation');

    // Create selection on "affirmative sub-allocation"
    const textNode = noticeP?.firstChild || noticeP!;
    const range = demoDoc.createRange();
    const startIdx = noticeText.indexOf('affirmative sub-allocation');
    range.setStart(textNode, startIdx);
    range.setEnd(textNode, startIdx + 'affirmative sub-allocation'.length);

    const sel = demoWindow.getSelection() as unknown as Selection;
    sel.removeAllRanges();
    sel.addRange(range);

    const context = captureSelectionContext(demoDoc);
    expect(context).not.toBeNull();
    expect(context?.selectedText).toBe('affirmative sub-allocation');
    expect(context?.pageTitle).toContain('National Student Scholarship Portal');
    expect(context?.sectionHeading).toContain('Personal Details & Domicile Classification');
  });

  it('2. Explains dense administrative instruction with surrounding context', async () => {
    const alertP = demoDoc.querySelector('.statutory-alert .alert-text');
    expect(alertP).not.toBeNull();

    // Select text in alert: "Submissions with unverified domicile cadre documentation"
    const range = demoDoc.createRange();
    range.selectNodeContents(alertP!);
    const sel = demoWindow.getSelection() as unknown as Selection;
    sel.removeAllRanges();
    sel.addRange(range);

    const context = captureSelectionContext(demoDoc);
    expect(context).not.toBeNull();
    expect(context?.selectedText).toContain('Ministerial Order');
    expect(context?.sectionHeading).toBe('Statutory Notice Regarding Document Verification Deadlines');

    // Mock AI response grounded in the alert
    const mockResponse: ExplainAnythingResponse = {
      explanation: 'You must submit verified official certificates before the deadline, or your application will be rejected.',
      whyItMatters: 'Unverified residency or bank papers lead to immediate cancellation.',
      example: 'If your domicile certificate is not attested by the magistrate, you cannot receive the quota benefit.',
      keyPoints: ['Submission deadline is strict', 'Unverified documents cause rejection'],
      terminology: [{ term: 'Cadre Documentation', definition: 'Official government verification paperwork' }],
      confidence: 0.96,
      sourceSummary: 'Statutory verification notice',
      warnings: [],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await requestExplanation({
      selectedText: context!.selectedText,
      context: {
        pageTitle: context?.pageTitle,
        sectionHeading: context?.sectionHeading,
      },
      mode: 'SIMPLE',
    });

    expect(result.explanation).toContain('submit verified official certificates before the deadline');
    expect(result.whyItMatters).toContain('Unverified residency or bank papers');
    expect(result.keyPoints).toHaveLength(2);

    fetchSpy.mockRestore();
  });

  it('3. Selects upload requirement and requests practical EXAMPLE without hallucination', async () => {
    // Stage 7 file upload instruction
    const uploadLabel = demoDoc.querySelector('label[for="doc_income_certificate"]');
    expect(uploadLabel).not.toBeNull();

    const range = demoDoc.createRange();
    range.selectNodeContents(uploadLabel!);
    const sel = demoWindow.getSelection() as unknown as Selection;
    sel.removeAllRanges();
    sel.addRange(range);

    const context = captureSelectionContext(demoDoc);
    expect(context).not.toBeNull();

    const mockExampleResponse: ExplainAnythingResponse = {
      explanation: 'You must provide a digital copy of your official domicile residency certificate.',
      example: 'Upload a scanned PDF or JPEG file under 2 MB showing your state revenue seal.',
      whyItMatters: 'Required to prove residency for the quota allocation.',
      keyPoints: ['Valid formats: PDF, JPG', 'Max size 2 MB'],
      terminology: [],
      confidence: 0.94,
      sourceSummary: 'Document upload field instruction',
      warnings: [],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockExampleResponse,
    } as Response);

    const result = await requestExplanation({
      selectedText: context!.selectedText,
      mode: 'EXAMPLE',
    });

    expect(result.example).toContain('Upload a scanned PDF or JPEG file under 2 MB');
    expect(result.explanation).toContain('official domicile residency certificate');

    fetchSpy.mockRestore();
  });

  it('4. Explains intentionally confusing term with clear Terminology definitions', async () => {
    const term = 'Sub-Divisional Revenue Magistrate';
    const mockTermResponse: ExplainAnythingResponse = {
      explanation: 'A designated local administrative government officer who issues official legal residency documents.',
      whyItMatters: 'Only certificates signed by this official or higher are accepted.',
      terminology: [
        { term: 'Revenue Magistrate', definition: 'A civil administrative officer in charge of land and revenue records.' },
        { term: 'Sub-Divisional', definition: 'The district sub-unit administration level.' },
      ],
      confidence: 0.95,
      sourceSummary: 'Executive certification criteria',
      warnings: [],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockTermResponse,
    } as Response);

    const result = await requestExplanation({
      selectedText: term,
      mode: 'DETAILED',
    });

    expect(result.terminology).toHaveLength(2);
    expect(result.terminology?.[0]?.term).toBe('Revenue Magistrate');
    expect(result.terminology?.[1]?.term).toBe('Sub-Divisional');

    fetchSpy.mockRestore();
  });

  it('5. Protects sensitive information: redacts fake sensitive numbers before sending', async () => {
    // Suppose a user selects a string containing a fake bank account / card number
    const fakeSecretText =
      'Statutory payment to account 9876-5432-1098-7654 for verification processing.';

    const tempP = demoDoc.createElement('p');
    tempP.textContent = fakeSecretText;
    demoDoc.body.appendChild(tempP);

    const range = demoDoc.createRange();
    range.selectNodeContents(tempP);
    const sel = demoWindow.getSelection() as unknown as Selection;
    sel.removeAllRanges();
    sel.addRange(range);

    const context = captureSelectionContext(demoDoc);
    expect(context).not.toBeNull();
    // Verify client-side redaction
    expect(context?.selectedText).not.toContain('9876-5432-1098-7654');
    expect(context?.selectedText).toContain('[REDACTED_CARD_NUMBER]');

    demoDoc.body.removeChild(tempP);
  });

  it('6. Verifies that the demo webpage DOM is never altered by Explain Anything', async () => {
    const originalBodyHtml = demoDoc.body.innerHTML;

    // Trigger in-page explain popover
    const popover = new InPageExplainPopover(demoDoc);
    popover.showTrigger(50, 50, { selectedText: 'Statutory Notice' });

    const mockResponse: ExplainAnythingResponse = {
      explanation: 'This notice explains that official deadlines are strictly enforced.',
      confidence: 0.9,
      sourceSummary: 'Notice',
      warnings: [],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await popover.openPopover(50, 50);

    // Popover is inside body as an overlay, but host form and text elements remain untouched
    const alertText = demoDoc.querySelector('.statutory-alert .alert-text')?.textContent;
    expect(alertText).toContain('Pursuant to Ministerial Order No. 492/SCH/2025');

    // Dismiss popover
    popover.hideAll();

    // After popover is dismissed, all host elements and inputs are completely unchanged
    expect(demoDoc.body.innerHTML).toBe(originalBodyHtml);
    expect(demoDoc.querySelector('#accessos-explain-popover-container')).toBeNull();
    fetchSpy.mockRestore();
  });
});
