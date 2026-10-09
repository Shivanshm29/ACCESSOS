/**
 * ACCESSOS Accessible Failure & State Management (Phase 15 Production Hardening)
 * Features:
 * 1. Semantic states: IDLE, LOADING, SUCCESS, UNSUPPORTED, UNAVAILABLE, TIMEOUT,
 *    MALFORMED_RESPONSE, PERMISSION_DENIED, STALE_PAGE, SAFETY_BLOCKED, OFFLINE.
 * 2. WCAG-compliant ARIA live regions and status messaging for screen readers.
 * 3. Focus management: saves previous active element, focuses error banners, restores on dismiss.
 */

export type UXFailureState =
  | 'IDLE'
  | 'LOADING'
  | 'SUCCESS'
  | 'UNSUPPORTED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'MALFORMED_RESPONSE'
  | 'PERMISSION_DENIED'
  | 'STALE_PAGE'
  | 'SAFETY_BLOCKED'
  | 'OFFLINE';

export interface StateDescriptor {
  state: UXFailureState;
  role: 'status' | 'alert';
  ariaLive: 'polite' | 'assertive';
  ariaBusy: boolean;
  userMessage: string;
  isError: boolean;
}

export const STATE_DESCRIPTORS: Record<UXFailureState, StateDescriptor> = {
  IDLE: {
    state: 'IDLE',
    role: 'status',
    ariaLive: 'polite',
    ariaBusy: false,
    userMessage: 'Ready to assist.',
    isError: false,
  },
  LOADING: {
    state: 'LOADING',
    role: 'status',
    ariaLive: 'polite',
    ariaBusy: true,
    userMessage: 'Analyzing current page. Please wait...',
    isError: false,
  },
  SUCCESS: {
    state: 'SUCCESS',
    role: 'status',
    ariaLive: 'polite',
    ariaBusy: false,
    userMessage: 'Analysis complete.',
    isError: false,
  },
  UNSUPPORTED: {
    state: 'UNSUPPORTED',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'This page cannot be analyzed (restricted browser or system page).',
    isError: true,
  },
  UNAVAILABLE: {
    state: 'UNAVAILABLE',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'Assistant service is temporarily unavailable. Using standard mode.',
    isError: true,
  },
  TIMEOUT: {
    state: 'TIMEOUT',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'Operation timed out. Please check your connection and try again.',
    isError: true,
  },
  MALFORMED_RESPONSE: {
    state: 'MALFORMED_RESPONSE',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'Received unexpected response format. Please refresh the page.',
    isError: true,
  },
  PERMISSION_DENIED: {
    state: 'PERMISSION_DENIED',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'Permission denied. ACCESSOS cannot access this tab.',
    isError: true,
  },
  STALE_PAGE: {
    state: 'STALE_PAGE',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'Page has changed since analysis. Please click Analyze Current Page to refresh.',
    isError: true,
  },
  SAFETY_BLOCKED: {
    state: 'SAFETY_BLOCKED',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'Action was blocked by safety policy to protect your account.',
    isError: true,
  },
  OFFLINE: {
    state: 'OFFLINE',
    role: 'alert',
    ariaLive: 'assertive',
    ariaBusy: false,
    userMessage: 'You are currently offline. Please check your internet connection.',
    isError: true,
  },
};

export class AccessibleStateManager {
  private lastFocusedElement: HTMLElement | null = null;

  /**
   * Applies the state descriptor to an element, updating ARIA attributes and text.
   */
  public applyStateToElement(el: HTMLElement, state: UXFailureState, customMessage?: string): void {
    const desc = STATE_DESCRIPTORS[state] || STATE_DESCRIPTORS.IDLE;
    el.setAttribute('role', desc.role);
    el.setAttribute('aria-live', desc.ariaLive);
    el.setAttribute('aria-busy', String(desc.ariaBusy));
    el.textContent = customMessage || desc.userMessage;

    if (desc.isError) {
      el.classList.add('accessos-error-state');
      el.classList.remove('accessos-success-state');
    } else {
      el.classList.remove('accessos-error-state');
      if (state === 'SUCCESS') {
        el.classList.add('accessos-success-state');
      }
    }
  }

  /**
   * Saves currently focused element and moves focus to target container (e.g., error alert).
   */
  public focusWithRestoration(target: HTMLElement, doc: Document = document): void {
    if (doc.activeElement instanceof HTMLElement) {
      this.lastFocusedElement = doc.activeElement;
    }

    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }

    target.focus();
  }

  /**
   * Restores focus to the element that was focused prior to the error/modal.
   */
  public restoreFocus(): void {
    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      try {
        this.lastFocusedElement.focus();
      } catch {
        // Ignored
      }
      this.lastFocusedElement = null;
    }
  }
}

export const accessibleStateManager = new AccessibleStateManager();
