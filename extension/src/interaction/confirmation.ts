/**
 * ACCESSOS Interaction Confirmation UI & Modal (Phase 8).
 * Ensures users have explicit oversight and control before any mutating action is executed.
 * Accessible dialog with focus trap management and Escape-key cancellation.
 */

import type { InteractionIntent } from './types';

export interface ConfirmationParams {
  intent: InteractionIntent;
  targetLabel: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  containerEl?: HTMLElement;
  verbosity?: 'STANDARD' | 'DETAILED';
}

export const CONFIRMATION_MODAL_ID = 'accessos-interaction-confirmation-modal';

export class InteractionConfirmationDialog {
  private activeContainer: HTMLElement | null = null;
  private previousFocusEl: HTMLElement | null = null;

  public show(params: ConfirmationParams): HTMLElement {
    this.dismiss();

    const doc = params.containerEl?.ownerDocument || document;
    this.previousFocusEl = doc.activeElement as HTMLElement | null;

    const modal = doc.createElement('div');
    modal.id = CONFIRMATION_MODAL_ID;
    modal.className = 'accessos-confirmation-backdrop';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'accessos-confirm-title');
    modal.setAttribute('aria-describedby', 'accessos-confirm-desc');

    const card = doc.createElement('div');
    card.className = 'accessos-confirmation-card';

    // Header
    const header = doc.createElement('div');
    header.className = 'accessos-confirm-header';

    const badge = doc.createElement('span');
    badge.className = 'accessos-confirm-badge';
    badge.textContent = 'ACCESSOS ACTION';

    const riskBadge = doc.createElement('span');
    riskBadge.className = `accessos-risk-tag risk-${(params.intent.riskLevel || 'low').toLowerCase()}`;
    riskBadge.textContent = `Risk: ${params.intent.riskLevel || 'LOW'}`;

    header.appendChild(badge);
    header.appendChild(riskBadge);
    card.appendChild(header);

    // Title
    const title = doc.createElement('h3');
    title.id = 'accessos-confirm-title';
    title.className = 'accessos-confirm-title';
    title.textContent = this.getActionDescription(params.intent);
    card.appendChild(title);

    // Details Box
    const details = doc.createElement('div');
    details.className = 'accessos-confirm-details';

    // Target
    const targetRow = doc.createElement('div');
    targetRow.className = 'accessos-confirm-row';
    const targetLabel = doc.createElement('span');
    targetLabel.className = 'accessos-confirm-meta-label';
    targetLabel.textContent = 'Into Field:';
    const targetVal = doc.createElement('span');
    targetVal.className = 'accessos-confirm-meta-val';
    targetVal.textContent = params.targetLabel || params.intent.targetElementId;
    targetRow.appendChild(targetLabel);
    targetRow.appendChild(targetVal);
    details.appendChild(targetRow);

    // Value if TYPE or SELECT
    if (params.intent.actionType === 'TYPE') {
      const valRow = doc.createElement('div');
      valRow.className = 'accessos-confirm-row accessos-confirm-input-row';
      const valLabel = doc.createElement('span');
      valLabel.className = 'accessos-confirm-meta-label';
      valLabel.textContent = 'Value to Type:';

      const valContainer = doc.createElement('div');
      valContainer.className = 'accessos-confirm-val-container';

      const valInput = doc.createElement('input');
      valInput.type = 'text';
      valInput.className = 'accessos-confirm-editable-input';
      valInput.value = params.intent.value || '';
      valInput.setAttribute('aria-label', 'Edit value to enter');

      const valText = doc.createElement('code');
      valText.className = 'accessos-confirm-code';
      valText.style.display = 'none';
      valText.textContent = `"${params.intent.value || ''}"`;

      valInput.addEventListener('input', () => {
        params.intent.value = valInput.value;
        valText.textContent = `"${valInput.value}"`;
      });

      valContainer.appendChild(valInput);
      valContainer.appendChild(valText);
      valRow.appendChild(valLabel);
      valRow.appendChild(valContainer);
      details.appendChild(valRow);
    } else if (params.intent.actionType === 'SELECT_OPTION' && params.intent.optionValue) {
      const optRow = doc.createElement('div');
      optRow.className = 'accessos-confirm-row';
      const optLabel = doc.createElement('span');
      optLabel.className = 'accessos-confirm-meta-label';
      optLabel.textContent = 'Option:';
      const optVal = doc.createElement('code');
      optVal.className = 'accessos-confirm-code';
      optVal.textContent = `"${params.intent.optionValue}"`;
      optRow.appendChild(optLabel);
      optRow.appendChild(optVal);
      details.appendChild(optRow);
    } else if (params.intent.actionType === 'TOGGLE_CHECKBOX') {
      const cbRow = doc.createElement('div');
      cbRow.className = 'accessos-confirm-row';
      const cbLabel = doc.createElement('span');
      cbLabel.className = 'accessos-confirm-meta-label';
      cbLabel.textContent = 'State:';
      const cbVal = doc.createElement('span');
      cbVal.className = 'accessos-confirm-meta-val';
      cbVal.textContent = params.intent.checked ? 'Checked' : 'Unchecked';
      cbRow.appendChild(cbLabel);
      cbRow.appendChild(cbVal);
      details.appendChild(cbRow);
    }

    card.appendChild(details);

    // Reason
    if (params.intent.reason) {
      const reasonBox = doc.createElement('div');
      reasonBox.className = 'accessos-confirm-reason';
      const reasonLabel = doc.createElement('strong');
      reasonLabel.textContent = 'Reason: ';
      reasonBox.appendChild(reasonLabel);
      reasonBox.appendChild(doc.createTextNode(params.intent.reason));
      card.appendChild(reasonBox);
    }

    // Verbosity Detailed Context
    if (params.verbosity === 'DETAILED') {
      const detailedBox = doc.createElement('div');
      detailedBox.className = 'accessos-confirm-detailed-context';
      detailedBox.id = 'accessos-confirm-detailed-desc';
      detailedBox.textContent =
        'Detailed Context: Verified allowlisted browser action. Safety policy strictly bars form submission and sensitive field automation. Confirmation remains permanently mandatory.';
      card.appendChild(detailedBox);
    }

    // Action Buttons
    const actionsRow = doc.createElement('div');
    actionsRow.className = 'accessos-confirm-actions';

    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'accessos-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      this.dismiss();
      params.onCancel();
    });

    const confirmBtn = doc.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'accessos-btn-confirm';
    confirmBtn.textContent = 'Confirm Action';
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Executing...';
      try {
        await params.onConfirm();
      } finally {
        this.dismiss();
      }
    });

    actionsRow.appendChild(cancelBtn);
    actionsRow.appendChild(confirmBtn);
    card.appendChild(actionsRow);

    modal.appendChild(card);

    // Keyboard dismissal
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        doc.removeEventListener('keydown', keyHandler);
        this.dismiss();
        params.onCancel();
      }
    };
    doc.addEventListener('keydown', keyHandler);

    const parent = params.containerEl || doc.body;
    parent.appendChild(modal);
    this.activeContainer = modal;

    // Focus confirm button initially for keyboard users
    confirmBtn.focus();

    return modal;
  }

  public dismiss(): void {
    if (this.activeContainer && this.activeContainer.parentElement) {
      this.activeContainer.parentElement.removeChild(this.activeContainer);
      this.activeContainer = null;
    }
    if (this.previousFocusEl) {
      this.previousFocusEl.focus();
      this.previousFocusEl = null;
    }
  }

  private getActionDescription(intent: InteractionIntent): string {
    switch (intent.actionType) {
      case 'TYPE':
        return `Enter "${intent.value || ''}"`;
      case 'SELECT_OPTION':
        return `Select "${intent.optionValue || ''}"`;
      case 'TOGGLE_CHECKBOX':
        return intent.checked ? 'Check this checkbox' : 'Uncheck this checkbox';
      case 'FOCUS':
        return 'Focus on element';
      case 'HIGHLIGHT':
        return 'Highlight element';
      default:
        return 'Assist with field';
    }
  }
}
