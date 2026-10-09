/**
 * @vitest-environment happy-dom
 * Phase 15 Production Hardening Test Suite
 * Accessibility & UX Failure States (PH15-A11Y-01 through PH15-A11Y-10)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { accessibleStateManager } from '../src/core/hardening/a11y-states';

describe('Phase 15 — Accessibility & UX Failure States (PH15-A11Y-01 through PH15-A11Y-10)', () => {
  let targetEl: HTMLElement;

  beforeEach(() => {
    targetEl = document.createElement('div');
    document.body.appendChild(targetEl);
  });

  it('PH15-A11Y-01: IDLE state applies role="status" and aria-live="polite"', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'IDLE');
    expect(targetEl.getAttribute('role')).toBe('status');
    expect(targetEl.getAttribute('aria-live')).toBe('polite');
    expect(targetEl.getAttribute('aria-busy')).toBe('false');
    expect(targetEl.textContent).toContain('Ready');
  });

  it('PH15-A11Y-02: LOADING state sets aria-busy="true" and accessible progress text', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'LOADING');
    expect(targetEl.getAttribute('role')).toBe('status');
    expect(targetEl.getAttribute('aria-live')).toBe('polite');
    expect(targetEl.getAttribute('aria-busy')).toBe('true');
    expect(targetEl.textContent).toContain('Analyzing');
  });

  it('PH15-A11Y-03: SUCCESS state sets role="status" and accessible completion message', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'SUCCESS');
    expect(targetEl.getAttribute('role')).toBe('status');
    expect(targetEl.getAttribute('aria-live')).toBe('polite');
    expect(targetEl.getAttribute('aria-busy')).toBe('false');
    expect(targetEl.classList.contains('accessos-success-state')).toBe(true);
  });

  it('PH15-A11Y-04: TIMEOUT failure state applies role="alert" and aria-live="assertive"', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'TIMEOUT');
    expect(targetEl.getAttribute('role')).toBe('alert');
    expect(targetEl.getAttribute('aria-live')).toBe('assertive');
    expect(targetEl.classList.contains('accessos-error-state')).toBe(true);
    expect(targetEl.textContent).toContain('timed out');
  });

  it('PH15-A11Y-05: UNAVAILABLE failure state provides plain-language degradation notice', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'UNAVAILABLE');
    expect(targetEl.getAttribute('role')).toBe('alert');
    expect(targetEl.textContent).toContain('standard mode');
  });

  it('PH15-A11Y-06: OFFLINE failure state informs user of network disconnection with accessible alert', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'OFFLINE');
    expect(targetEl.getAttribute('role')).toBe('alert');
    expect(targetEl.textContent).toContain('offline');
  });

  it('PH15-A11Y-07: SAFETY_BLOCKED state clearly announces policy restriction without confusing error codes', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'SAFETY_BLOCKED');
    expect(targetEl.getAttribute('role')).toBe('alert');
    expect(targetEl.textContent).toContain('safety policy');
  });

  it('PH15-A11Y-08: STALE_PAGE state instructs user to refresh page representation', () => {
    accessibleStateManager.applyStateToElement(targetEl, 'STALE_PAGE');
    expect(targetEl.getAttribute('role')).toBe('alert');
    expect(targetEl.textContent).toContain('refresh');
  });

  it('PH15-A11Y-09: Focus management saves previous active element and shifts focus to error container', () => {
    const triggerBtn = document.createElement('button');
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    const errorAlert = document.createElement('div');
    document.body.appendChild(errorAlert);

    accessibleStateManager.focusWithRestoration(errorAlert, document);
    expect(document.activeElement).toBe(errorAlert);
    expect(errorAlert.getAttribute('tabindex')).toBe('-1');

    document.body.removeChild(triggerBtn);
    document.body.removeChild(errorAlert);
  });

  it('PH15-A11Y-10: Focus restoration restores focus to original trigger element upon dismiss', () => {
    const triggerBtn = document.createElement('button');
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    const errorAlert = document.createElement('div');
    document.body.appendChild(errorAlert);

    accessibleStateManager.focusWithRestoration(errorAlert, document);
    expect(document.activeElement).toBe(errorAlert);

    // Dismiss error
    accessibleStateManager.restoreFocus();
    expect(document.activeElement).toBe(triggerBtn);

    document.body.removeChild(triggerBtn);
    document.body.removeChild(errorAlert);
  });
});
