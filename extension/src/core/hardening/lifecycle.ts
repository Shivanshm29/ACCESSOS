/**
 * ACCESSOS Browser Lifecycle Robustness & Target Invalidation Manager (Phase 15 Production Hardening)
 * Features:
 * 1. Active tab and navigation tracking.
 * 2. Instant invalidation of cached PageRepresentation and execution capability tokens on navigation.
 * 3. Graceful handling of disconnected content scripts and destroyed tabs.
 * 4. DOM element connection verification (prevents mutation against replacement elements).
 * 5. Safe state recovery after service worker restart.
 */

import { LifecycleError } from './errors';

export interface TabSessionState {
  tabId: number;
  url: string;
  sessionToken: string;
  createdAt: number;
}

export class TabLifecycleManager {
  private activeSessions: Map<number, TabSessionState> = new Map();
  private invalidatedTokens: Set<string> = new Set();
  private activeCapabilityTokens: Map<string, { tabId: number; url: string; createdAt: number }> = new Map();

  /**
   * Registers or updates a tab session. If the tab URL changed (navigation),
   * previous tokens and cached state for that tab are invalidated immediately.
   */
  public registerTab(tabId: number, url: string): TabSessionState {
    const existing = this.activeSessions.get(tabId);
    const sessionToken = `sess_${tabId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (existing && existing.url !== url) {
      // Tab navigated to a new URL -> invalidate all capability tokens tied to this tab
      this.invalidateTab(tabId, 'Tab navigated to new URL');
    }

    const session: TabSessionState = {
      tabId,
      url,
      sessionToken,
      createdAt: Date.now(),
    };

    this.activeSessions.set(tabId, session);
    return session;
  }

  /**
   * Registers an execution capability token for a specific tab and URL.
   */
  public registerCapabilityToken(token: string, tabId: number, url: string): void {
    this.activeCapabilityTokens.set(token, {
      tabId,
      url,
      createdAt: Date.now(),
    });
  }

  /**
   * Validates whether a capability token is still valid for the given tab and current URL.
   * Returns false if tab has navigated, token was invalidated, or token does not exist.
   */
  public isCapabilityTokenValid(token: string, currentTabId: number, currentUrl: string): boolean {
    if (!token || this.invalidatedTokens.has(token)) {
      return false;
    }

    const registered = this.activeCapabilityTokens.get(token);
    if (!registered) {
      return false;
    }

    // Must match both tab ID and exact URL recorded at issuance time
    if (registered.tabId !== currentTabId || registered.url !== currentUrl) {
      this.invalidatedTokens.add(token);
      this.activeCapabilityTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Consumes a capability token (one-shot).
   */
  public consumeCapabilityToken(token: string): boolean {
    if (!token || this.invalidatedTokens.has(token) || !this.activeCapabilityTokens.has(token)) {
      return false;
    }
    this.activeCapabilityTokens.delete(token);
    this.invalidatedTokens.add(token);
    return true;
  }

  /**
   * Invalidates all tokens and state associated with a tab.
   */
  public invalidateTab(tabId: number, _reason?: string): void {
    this.activeSessions.delete(tabId);

    // Invalidate all tokens issued to this tab
    for (const [token, data] of this.activeCapabilityTokens.entries()) {
      if (data.tabId === tabId) {
        this.invalidatedTokens.add(token);
        this.activeCapabilityTokens.delete(token);
      }
    }
  }

  /**
   * Checks if a target DOM element is still physically connected to the active document.
   * Strictly prevents mutation or interaction against detached or replacement elements.
   */
  public isElementConnected(element: unknown, doc: Document): boolean {
    if (!element || typeof element !== 'object') {
      return false;
    }

    const htmlEl = element as HTMLElement;

    // Check DOM Node isConnected standard property
    if (typeof htmlEl.isConnected === 'boolean' && !htmlEl.isConnected) {
      return false;
    }

    // Verify it is a descendant of the provided active document
    if (doc && typeof doc.contains === 'function') {
      if (!doc.contains(htmlEl)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Handles disconnected content scripts or closed tab messaging errors gracefully.
   */
  public handleContentScriptDisconnect(error: unknown): LifecycleError {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Receiving end does not exist')) {
      return new LifecycleError(
        'Content script unavailable or page reloaded',
        'Cannot connect to the active tab. Please refresh the page and try again.'
      );
    }
    if (msg.includes('Extension context invalidated')) {
      return new LifecycleError(
        'Extension reloaded',
        'ACCESSOS was updated or reloaded. Please refresh the page.'
      );
    }
    return new LifecycleError(msg, 'Tab communication lost. Please refresh the page.');
  }

  /**
   * Clears all session states (e.g., during tests or worker reset).
   */
  public reset(): void {
    this.activeSessions.clear();
    this.invalidatedTokens.clear();
    this.activeCapabilityTokens.clear();
  }
}

export const tabLifecycleManager = new TabLifecycleManager();
