/**
 * ACCESSOS Safe Selection Context Extractor
 * Safely captures selected text, bounded surrounding context, and semantic grounding.
 *
 * SAFETY & PRIVACY GUARANTEES:
 * 1. Read-only inspection of window.getSelection().
 * 2. NEVER captures passwords or inputs of type password.
 * 3. Enforces strict length bounds (selectedText <= 1000, context <= 500).
 * 4. Redacts obvious card numbers, OTPs, or passwords before sending.
 * 5. Does NOT mutate the DOM or replace selected text.
 */
import type { SelectionContextPayload } from '../core/messaging/index';

export const MAX_SELECTED_TEXT_LENGTH = 1000;
export const MAX_CONTEXT_LENGTH = 500;

// Client-side regex patterns for sensitive data redaction
const SENSITIVE_PATTERNS: [RegExp, string][] = [
  [/(?:password|passwd|pwd|secret|token|bearer|session_token)[\s:=]+["']?([^\s"',;]+)["']?/gi, '[REDACTED_PASSWORD]'],
  [/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_CARD_NUMBER]'],
  [/\b(?:cvv|cvc|security\s*code)[\s:=]+(\d{3,4})\b/gi, '[REDACTED_CVV]'],
  [/\b(?:otp|one[- ]time\s*password|verification\s*code)[\s:=]+(\d{4,8})\b/gi, '[REDACTED_OTP]'],
  [/\b\d{6}\b/g, '[REDACTED_CODE]'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]'],
  [/\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_\-\.]{20,})\b/gi, '[REDACTED_API_KEY]'],
];

export function redactClientSecrets(text: string): string {
  if (!text) return '';
  let result = text;
  for (const [pattern, placeholder] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, placeholder);
  }
  return result;
}

/**
 * Safely extracts bounded selection and contextual metadata from the current document.
 */
export function captureSelectionContext(doc: Document = document): SelectionContextPayload | null {
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  if (!win) return null;

  const selection = win.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const rawSelectedText = selection.toString().trim();
  if (!rawSelectedText || rawSelectedText.length === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element: HTMLElement | null =
    container.nodeType === 1 ? (container as HTMLElement) : container.parentElement;

  // 1. Password input security boundary
  if (element) {
    const inputEl = element.closest('input') as HTMLInputElement | null;
    if (inputEl && (inputEl.type === 'password' || inputEl.getAttribute('type') === 'password')) {
      return null; // Refuse to capture password values
    }
  }

  // 2. Bound selected text
  let selectedText =
    rawSelectedText.length > MAX_SELECTED_TEXT_LENGTH
      ? rawSelectedText.slice(0, MAX_SELECTED_TEXT_LENGTH - 3) + '...'
      : rawSelectedText;
  selectedText = redactClientSecrets(selectedText);

  // 3. Extract bounded context (before / after)
  let contextBefore: string | undefined;
  let contextAfter: string | undefined;

  if (element && element.textContent) {
    const fullText = element.textContent;
    const matchIndex = fullText.indexOf(rawSelectedText);

    if (matchIndex !== -1) {
      const beforeText = fullText.slice(Math.max(0, matchIndex - MAX_CONTEXT_LENGTH), matchIndex).trim();
      const afterText = fullText
        .slice(matchIndex + rawSelectedText.length, matchIndex + rawSelectedText.length + MAX_CONTEXT_LENGTH)
        .trim();

      if (beforeText) contextBefore = redactClientSecrets(beforeText);
      if (afterText) contextAfter = redactClientSecrets(afterText);
    }
  }

  // 4. Grounding: Find stable ACCESSOS element ID
  let targetElementId: string | undefined;
  if (element) {
    const accessosEl = element.closest('[data-accessos-id]');
    if (accessosEl) {
      targetElementId = accessosEl.getAttribute('data-accessos-id') || undefined;
    } else if (element.id) {
      targetElementId = element.id;
    }
  }

  // 5. Section Heading
  let sectionHeading: string | undefined;
  if (element) {
    const sectionContainer = element.closest('section, fieldset, main, [role="region"], [role="main"], article');
    if (sectionContainer) {
      const headingEl = sectionContainer.querySelector('h1, h2, h3, h4, h5, h6, legend, [role="heading"]');
      if (headingEl && headingEl.textContent) {
        sectionHeading = headingEl.textContent.trim().slice(0, 200);
      }
    }
    if (!sectionHeading) {
      // Look upwards for previous sibling or ancestor heading
      let curr: Element | null = element;
      while (curr && curr !== doc.body) {
        let prev = curr.previousElementSibling;
        while (prev) {
          if (/^H[1-6]$/i.test(prev.tagName) || prev.matches('legend, [role="heading"]')) {
            sectionHeading = prev.textContent?.trim().slice(0, 200);
            break;
          }
          const nested = prev.querySelector('h1, h2, h3, h4, h5, h6, legend, [role="heading"]');
          if (nested && nested.textContent) {
            sectionHeading = nested.textContent.trim().slice(0, 200);
            break;
          }
          prev = prev.previousElementSibling;
        }
        if (sectionHeading) break;
        curr = curr.parentElement;
      }
    }
  }

  // 6. Element role / tag
  const elementRole = element ? element.tagName.toLowerCase() : undefined;
  const pageTitle = doc.title ? doc.title.slice(0, 200) : undefined;

  return {
    selectedText,
    contextBefore,
    contextAfter,
    pageTitle,
    sectionHeading,
    targetElementId,
    elementRole,
  };
}
