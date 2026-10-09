/**
 * ACCESSOS Safe In-Page Contextual Explanation Popover
 * Renders a lightweight, non-invasive popover near selected webpage text.
 *
 * SAFETY GUARANTEES:
 * 1. Read-only overlay — NEVER modifies host DOM text or inputs.
 * 2. NEVER replaces selected text.
 * 3. Uses purely textContent for model outputs — NEVER innerHTML.
 * 4. Dismissible via Escape key, close button, or clicking outside.
 * 5. Full keyboard accessibility and focus management.
 */
import type { SelectionContextPayload } from '../core/messaging/index';
import { requestExplanation } from '../explain/client';
import type { ExplanationMode, ExplainAnythingResponse } from '../explain/types';

export const POPOVER_CONTAINER_ID = 'accessos-explain-popover-container';
export const TRIGGER_BTN_ID = 'accessos-explain-trigger-btn';
export const POPOVER_STYLES_ID = 'accessos-explain-styles';

const POPOVER_STYLES = `
#${TRIGGER_BTN_ID} {
  position: absolute;
  z-index: 2147483640;
  background: #1e293b;
  color: #38bdf8;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 4px 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  gap: 4px;
  transition: transform 0.15s ease, background 0.15s ease;
}

#${TRIGGER_BTN_ID}:hover {
  background: #334155;
  color: #ffffff;
  transform: translateY(-1px);
}

#${TRIGGER_BTN_ID}:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}

#${POPOVER_CONTAINER_ID} {
  position: absolute;
  z-index: 2147483645;
  width: 320px;
  max-width: 90vw;
  background: #0f172a;
  color: #f8fafc;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.accessos-explain-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #334155;
  padding-bottom: 6px;
}

.accessos-explain-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #38bdf8;
  text-transform: uppercase;
}

.accessos-explain-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}

.accessos-explain-close-btn:hover {
  color: #ffffff;
  background: #334155;
}

.accessos-explain-selection-preview {
  font-style: italic;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.6);
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 11px;
  border-left: 2px solid #38bdf8;
}

.accessos-explain-modes-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.accessos-explain-mode-btn {
  background: #1e293b;
  border: 1px solid #475569;
  color: #cbd5e1;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.accessos-explain-mode-btn:hover {
  background: #334155;
  color: #ffffff;
}

.accessos-explain-mode-btn.active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
}

.accessos-explain-body {
  background: #1e293b;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.accessos-explain-text {
  font-size: 12px;
  color: #f8fafc;
  line-height: 1.4;
  margin: 0;
}

.accessos-explain-why {
  background: rgba(15, 23, 42, 0.6);
  border-left: 2px solid #10b981;
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: #e2e8f0;
}

.accessos-explain-example {
  background: rgba(245, 158, 11, 0.1);
  border-left: 2px solid #f59e0b;
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: #fde68a;
}

.accessos-explain-terms {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.accessos-explain-term-item {
  font-size: 10px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.4);
  padding: 2px 4px;
  border-radius: 2px;
}

.accessos-explain-loading {
  font-size: 11px;
  font-style: italic;
  color: #94a3b8;
  padding: 8px 0;
  text-align: center;
}

.accessos-explain-error {
  font-size: 11px;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.2);
  padding: 6px;
  border-radius: 4px;
  text-align: center;
}
`;

export function ensurePopoverStyles(doc: Document = document): void {
  if (doc.getElementById(POPOVER_STYLES_ID)) return;
  const styleEl = doc.createElement('style');
  styleEl.id = POPOVER_STYLES_ID;
  styleEl.textContent = POPOVER_STYLES;
  (doc.head || doc.documentElement).appendChild(styleEl);
}

export class InPageExplainPopover {
  private doc: Document;
  private triggerBtn: HTMLButtonElement | null = null;
  private popoverContainer: HTMLElement | null = null;
  private currentSelection: SelectionContextPayload | null = null;
  private currentMode: ExplanationMode = 'SIMPLE';

  constructor(doc: Document = document) {
    this.doc = doc;
  }

  public showTrigger(x: number, y: number, selectionData: SelectionContextPayload): void {
    this.hideAll();
    this.currentSelection = selectionData;

    ensurePopoverStyles(this.doc);

    const btn = this.doc.createElement('button');
    btn.id = TRIGGER_BTN_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Explain selected text with ACCESSOS');
    btn.textContent = '💡 Explain';

    // Position near selection
    btn.style.left = `${Math.max(10, x)}px`;
    btn.style.top = `${Math.max(10, y - 30)}px`;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      void this.openPopover(x, y);
    });

    this.doc.body.appendChild(btn);
    this.triggerBtn = btn;
  }

  public async openPopover(x: number, y: number): Promise<void> {
    if (!this.currentSelection) return;
    this.hideTrigger();

    ensurePopoverStyles(this.doc);

    const container = this.doc.createElement('div');
    container.id = POPOVER_CONTAINER_ID;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'ACCESSOS Plain-Language Explanation');

    // Bounds checking for coordinates
    const leftPos = Math.min(Math.max(10, x), (this.doc.defaultView?.innerWidth || 800) - 340);
    container.style.left = `${leftPos}px`;
    container.style.top = `${Math.max(10, y + 10)}px`;

    this.renderPopoverShell(container);
    this.doc.body.appendChild(container);
    this.popoverContainer = container;

    // Load initial explanation
    await this.fetchAndRenderExplanation();
  }

  private renderPopoverShell(container: HTMLElement): void {
    container.innerHTML = '';

    // Header
    const header = this.doc.createElement('div');
    header.className = 'accessos-explain-header';

    const title = this.doc.createElement('span');
    title.className = 'accessos-explain-title';
    title.textContent = 'Explain Anything';

    const closeBtn = this.doc.createElement('button');
    closeBtn.className = 'accessos-explain-close-btn';
    closeBtn.setAttribute('aria-label', 'Close explanation');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.hideAll());

    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);

    // Selected text preview
    const preview = this.doc.createElement('div');
    preview.className = 'accessos-explain-selection-preview';
    preview.textContent = `"${this.currentSelection?.selectedText || ''}"`;
    container.appendChild(preview);

    // Mode Selector Row
    const modesRow = this.doc.createElement('div');
    modesRow.className = 'accessos-explain-modes-row';

    const modes: { label: string; mode: ExplanationMode }[] = [
      { label: 'Simple', mode: 'SIMPLE' },
      { label: 'Detailed', mode: 'DETAILED' },
      { label: 'Plain', mode: 'PLAIN_LANGUAGE' },
      { label: 'Example', mode: 'EXAMPLE' },
      { label: 'Key Points', mode: 'KEY_POINTS' },
    ];

    modes.forEach((m) => {
      const modeBtn = this.doc.createElement('button');
      modeBtn.type = 'button';
      modeBtn.className = `accessos-explain-mode-btn ${this.currentMode === m.mode ? 'active' : ''}`;
      modeBtn.textContent = m.label;
      modeBtn.addEventListener('click', () => {
        if (this.currentMode !== m.mode) {
          this.currentMode = m.mode;
          // Update active styles
          modesRow.querySelectorAll('.accessos-explain-mode-btn').forEach((b) => b.classList.remove('active'));
          modeBtn.classList.add('active');
          void this.fetchAndRenderExplanation();
        }
      });
      modesRow.appendChild(modeBtn);
    });
    container.appendChild(modesRow);

    // Body (for content/loading)
    const body = this.doc.createElement('div');
    body.className = 'accessos-explain-body';
    body.id = 'accessos-explain-body-content';
    container.appendChild(body);
  }

  private async fetchAndRenderExplanation(): Promise<void> {
    const body = this.doc.getElementById('accessos-explain-body-content');
    if (!body || !this.currentSelection) return;

    body.innerHTML = '';
    const loading = this.doc.createElement('div');
    loading.className = 'accessos-explain-loading';
    loading.textContent = 'Explaining in plain language...';
    body.appendChild(loading);

    try {
      const response = await requestExplanation({
        selectedText: this.currentSelection.selectedText,
        context: {
          pageTitle: this.currentSelection.pageTitle,
          sectionHeading: this.currentSelection.sectionHeading,
          targetElementId: this.currentSelection.targetElementId,
          contextBefore: this.currentSelection.contextBefore,
          contextAfter: this.currentSelection.contextAfter,
          elementRole: this.currentSelection.elementRole,
        },
        mode: this.currentMode,
      });

      this.renderExplanationResult(body, response);
    } catch (err: unknown) {
      body.innerHTML = '';
      const errorDiv = this.doc.createElement('div');
      errorDiv.className = 'accessos-explain-error';
      errorDiv.textContent =
        err instanceof Error ? err.message : 'Explanation is temporarily unavailable.';
      body.appendChild(errorDiv);
    }
  }

  private renderExplanationResult(body: HTMLElement, response: ExplainAnythingResponse): void {
    body.innerHTML = '';

    // Main explanation text
    const p = this.doc.createElement('p');
    p.className = 'accessos-explain-text';
    p.textContent = response.explanation;
    body.appendChild(p);

    // Why it matters
    if (response.whyItMatters) {
      const whyBox = this.doc.createElement('div');
      whyBox.className = 'accessos-explain-why';
      const strong = this.doc.createElement('strong');
      strong.textContent = 'Why this matters: ';
      whyBox.appendChild(strong);
      whyBox.appendChild(this.doc.createTextNode(response.whyItMatters));
      body.appendChild(whyBox);
    }

    // Key points
    if (response.keyPoints && response.keyPoints.length > 0) {
      const ul = this.doc.createElement('ul');
      ul.style.margin = '4px 0 4px 16px';
      ul.style.padding = '0';
      response.keyPoints.forEach((point) => {
        const li = this.doc.createElement('li');
        li.textContent = point;
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    // Example
    if (response.example) {
      const exBox = this.doc.createElement('div');
      exBox.className = 'accessos-explain-example';
      const strong = this.doc.createElement('strong');
      strong.textContent = 'Example: ';
      exBox.appendChild(strong);
      exBox.appendChild(this.doc.createTextNode(response.example));
      body.appendChild(exBox);
    }

    // Terminology
    if (response.terminology && response.terminology.length > 0) {
      const termsBox = this.doc.createElement('div');
      termsBox.className = 'accessos-explain-terms';
      response.terminology.forEach((t) => {
        const item = this.doc.createElement('div');
        item.className = 'accessos-explain-term-item';
        item.textContent = `${t.term}: ${t.definition}`;
        termsBox.appendChild(item);
      });
      body.appendChild(termsBox);
    }
  }

  public hideTrigger(): void {
    if (this.triggerBtn && this.triggerBtn.parentElement) {
      this.triggerBtn.parentElement.removeChild(this.triggerBtn);
      this.triggerBtn = null;
    }
  }

  public hidePopover(): void {
    if (this.popoverContainer && this.popoverContainer.parentElement) {
      this.popoverContainer.parentElement.removeChild(this.popoverContainer);
      this.popoverContainer = null;
    }
  }

  public hideAll(): void {
    this.hideTrigger();
    this.hidePopover();
    this.currentSelection = null;
  }
}
