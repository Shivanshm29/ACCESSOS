/**
 * ACCESSOS Content Script Entry Point
 * Executes within host page context for local metadata & semantic extraction and messaging.
 */
import {
  MessageType,
  createMessage,
  isAnalyzePageMessage,
  isHighlightElementMessage,
  isClearHighlightMessage,
  isGetSelectionMessage,
  isExecuteInteractionMessage,
  isCheckCompletionMessage,
  validateMessageEnvelope,
  type PageAnalysisResponsePayload,
  type SelectionResponsePayload,
} from '../core/messaging/index';
import { extractPageMetadata } from './extractor';
import { extractPageRepresentation } from './semantic-extractor';
import { analyzeAccessibility } from '../accessibility/index';
import { highlightElement, clearHighlight } from './highlighter';
import { captureSelectionContext } from '../explain/selection';
import { InPageExplainPopover, TRIGGER_BTN_ID, POPOVER_CONTAINER_ID } from './explain-popover';
import { executeInteraction } from '../interaction/executor';
import { evaluateCompletion } from '../completion/checker';

function initializeContentScript(): void {
  console.log('[ACCESSOS] Content script attached to:', window.location.href);

  const explainPopover = new InPageExplainPopover(document);

  // Selection detection for in-page contextual trigger
  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }
      const text = selection.toString().trim();
      if (!text) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const contextData = captureSelectionContext(document);
      if (contextData && contextData.selectedText) {
        explainPopover.showTrigger(rect.right + window.scrollX, rect.top + window.scrollY, contextData);
      }
    }, 10);
  });

  // Dismiss on clicking outside
  document.addEventListener('mousedown', (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target) {
      if (
        target.id === TRIGGER_BTN_ID ||
        target.closest?.(`#${TRIGGER_BTN_ID}`) ||
        target.id === POPOVER_CONTAINER_ID ||
        target.closest?.(`#${POPOVER_CONTAINER_ID}`)
      ) {
        return;
      }
    }
    explainPopover.hideAll();
  });

  // Dismiss on Escape
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      explainPopover.hideAll();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Validate message envelope (bounded size, known type, no script injection)
    const envelopeValidation = validateMessageEnvelope(message);
    if (!envelopeValidation.valid) {
      sendResponse({ success: false, error: envelopeValidation.error, status: 'REJECTED' });
      return false;
    }

    if (message && message.type === MessageType.PING) {
      sendResponse({ status: 'content-script-active' });
      return false;
    }

    if (isAnalyzePageMessage(message)) {
      try {
        const metadata = extractPageMetadata(document, window.location);
        const representation = extractPageRepresentation(document, window.location);
        const accessibilityReport = analyzeAccessibility(representation, document);
        const payload: PageAnalysisResponsePayload = {
          success: true,
          metadata,
          representation,
          accessibilityReport,
        };
        const response = createMessage(MessageType.PAGE_ANALYSIS_RESULT, payload);
        sendResponse(response);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const payload: PageAnalysisResponsePayload = {
          success: false,
          error: errorMessage || 'Failed to extract semantic page representation',
        };
        const response = createMessage(MessageType.PAGE_ANALYSIS_RESULT, payload);
        sendResponse(response);
      }
      return false; // Synchronous response
    }

    if (isHighlightElementMessage(message)) {
      const res = highlightElement(message.payload.targetElementId, document);
      sendResponse(res);
      return false;
    }

    if (isClearHighlightMessage(message)) {
      clearHighlight(document);
      sendResponse({ success: true, cleared: true });
      return false;
    }

    if (isGetSelectionMessage(message)) {
      try {
        const selection = captureSelectionContext(document);
        const payload: SelectionResponsePayload = {
          success: true,
          selection,
        };
        sendResponse(createMessage(MessageType.SELECTION_RESULT, payload));
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const payload: SelectionResponsePayload = {
          success: false,
          selection: null,
          error: errorMessage || 'Failed to capture selection context',
        };
        sendResponse(createMessage(MessageType.SELECTION_RESULT, payload));
      }
      return false;
    }

    if (isExecuteInteractionMessage(message)) {
      void executeInteraction(message.payload, document, { confirmed: true }).then((result) => {
        sendResponse(createMessage(MessageType.INTERACTION_RESULT, result));
      });
      return true; // Asynchronous response
    }

    if (isCheckCompletionMessage(message)) {
      try {
        const representation = extractPageRepresentation(document, window.location);
        const liveValues = extractSafeDocumentFormValues(document);
        const combinedValues = { ...liveValues, ...(message.payload?.formValues || {}) };
        const result = evaluateCompletion(
          representation,
          combinedValues,
          message.payload?.documentMatches || [],
          message.payload?.currentStageIndex || 0
        );
        sendResponse(
          createMessage(MessageType.COMPLETION_RESULT, {
            success: true,
            result,
          })
        );
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        sendResponse(
          createMessage(MessageType.COMPLETION_RESULT, {
            success: false,
            error: errorMessage || 'Failed to evaluate workflow completion',
          })
        );
      }
    }

    if (message && message.type === MessageType.RESET_DEMO) {
      const clearBtn = document.getElementById('btn-clear-demo') as HTMLButtonElement | null;
      if (clearBtn) {
        try {
          clearBtn.click();
        } catch {}
      } else {
        const form = document.getElementById('scholarship-application-form') as HTMLFormElement | null;
        if (form) {
          form.reset();
        }
      }
      sendResponse(
        createMessage(MessageType.DEMO_RESET_RESULT, {
          success: true,
          message: 'Demo portal reset to clean baseline',
        })
      );
      return false;
    }

    return false;
  });
}

function extractSafeDocumentFormValues(doc: Document): Record<string, string> {
  const values: Record<string, string> = {};
  const elements = doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input, select, textarea'
  );

  elements.forEach((el) => {
    const key = el.name || el.id;
    if (!key) return;

    // Detect sensitive inputs
    const type = (el.getAttribute('type') || '').toLowerCase();
    const isSensitive =
      type === 'password' ||
      el.hasAttribute('data-sensitive') ||
      el.autocomplete === 'cc-number' ||
      el.autocomplete === 'cc-csc' ||
      el.autocomplete === 'current-password';

    let val: string | null = null;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      if (el.checked) {
        val = el.value || 'true';
      }
    } else {
      val = el.value;
    }

    if (val && val.trim()) {
      if (isSensitive) {
        // Safe metadata only - NEVER harvest actual sensitive credentials
        values[key] = '[SENSITIVE_PRESENT]';
      } else {
        values[key] = val.trim();
      }
    }
  });

  return values;
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

