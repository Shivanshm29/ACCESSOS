/**
 * ACCESSOS Safe Element Highlighter
 * Visually locates and highlights DOM elements using stable ACCESSOS element IDs.
 *
 * SAFETY GUARANTEES:
 * 1. Read-only navigation & visual outline.
 * 2. NEVER modifies element values, textContent, or input attributes.
 * 3. NEVER simulates clicks or triggers form submission.
 * 4. NEVER executes scripts or arbitrary selectors.
 * 5. Highlighting is temporary and completely removable.
 */

export const HIGHLIGHT_CLASS = 'accessos-guided-target-highlight';
export const STYLE_ELEMENT_ID = 'accessos-guided-highlight-styles';

const HIGHLIGHT_STYLES = `
.${HIGHLIGHT_CLASS} {
  outline: 3px solid #4f46e5 !important;
  outline-offset: 4px !important;
  box-shadow: 0 0 0 6px rgba(79, 70, 229, 0.25), 0 4px 14px rgba(0, 0, 0, 0.18) !important;
  transition: outline 0.2s ease-in-out, box-shadow 0.2s ease-in-out !important;
  animation: accessosPulseHighlight 2s infinite ease-in-out;
}

@keyframes accessosPulseHighlight {
  0% {
    outline-color: #4f46e5;
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.25);
  }
  50% {
    outline-color: #6366f1;
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.35);
  }
  100% {
    outline-color: #4f46e5;
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.25);
  }
}
`;

/**
 * Ensures the highlighter CSS stylesheet exists in the document.
 */
export function ensureHighlighterStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }
  const styleEl = doc.createElement('style');
  styleEl.id = STYLE_ELEMENT_ID;
  styleEl.textContent = HIGHLIGHT_STYLES;
  (doc.head || doc.documentElement).appendChild(styleEl);
}

/**
 * Removes any active highlight from the page.
 */
export function clearHighlight(doc: Document = document): void {
  const highlightedElements = doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  highlightedElements.forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS);
  });
}

export interface HighlightResult {
  success: boolean;
  found: boolean;
  elementId: string;
  error?: string;
}

/**
 * Safely locates an element by its ACCESSOS element ID or native ID,
 * scrolls it into view, and applies an accessible focus ring.
 *
 * GUARANTEE: Does NOT click, submit, modify values, or execute code.
 */
export function highlightElement(targetElementId: string, doc: Document = document): HighlightResult {
  if (!targetElementId || typeof targetElementId !== 'string') {
    return {
      success: false,
      found: false,
      elementId: targetElementId || '',
      error: 'Invalid target element ID provided.',
    };
  }

  // Clear any existing highlight first
  clearHighlight(doc);

  // 1. Try finding by ACCESSOS stable ID attribute
  let target: Element | null = null;
  try {
    target = doc.querySelector(`[data-accessos-id="${targetElementId}"]`);
  } catch {
    // Selector syntax error safeguard
  }

  // 2. Fallback: try finding by HTML id attribute
  if (!target) {
    try {
      target = doc.getElementById(targetElementId);
    } catch {
      // Element lookup error safeguard
    }
  }

  if (!target) {
    return {
      success: false,
      found: false,
      elementId: targetElementId,
      error: `Element '${targetElementId}' could not be located on the current page.`,
    };
  }

  // Inject styles if needed
  ensureHighlighterStyles(doc);

  // Apply highlight class
  target.classList.add(HIGHLIGHT_CLASS);

  // Smoothly scroll into view if supported
  if (typeof (target as HTMLElement).scrollIntoView === 'function') {
    try {
      (target as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    } catch {
      // Fallback for environments lacking smooth scroll options
      (target as HTMLElement).scrollIntoView();
    }
  }

  return {
    success: true,
    found: true,
    elementId: targetElementId,
  };
}
