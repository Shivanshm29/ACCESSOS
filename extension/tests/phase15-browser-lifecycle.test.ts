/**
 * @vitest-environment happy-dom
 * Phase 15 Production Hardening Test Suite
 * Browser Lifecycle Robustness (PH15-LIFE-01 through PH15-LIFE-15)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TabLifecycleManager } from '../src/core/hardening/lifecycle';

describe('Phase 15 — Browser Lifecycle Robustness (PH15-LIFE-01 through PH15-LIFE-15)', () => {
  let manager: TabLifecycleManager;

  beforeEach(() => {
    manager = new TabLifecycleManager();
  });

  it('PH15-LIFE-01: Tab navigation registers new tab session and changes session token', () => {
    const s1 = manager.registerTab(101, 'https://example.com/step1');
    const s2 = manager.registerTab(101, 'https://example.com/step2');

    expect(s1.sessionToken).not.toBe(s2.sessionToken);
    expect(s2.url).toBe('https://example.com/step2');
  });

  it('PH15-LIFE-02: Tab navigation invalidates previous tab capability tokens immediately', () => {
    manager.registerTab(101, 'https://example.com/step1');
    manager.registerCapabilityToken('cap_token_123', 101, 'https://example.com/step1');

    expect(manager.isCapabilityTokenValid('cap_token_123', 101, 'https://example.com/step1')).toBe(true);

    // Tab navigates to step2
    manager.registerTab(101, 'https://example.com/step2');

    // Token must be invalidated immediately!
    expect(manager.isCapabilityTokenValid('cap_token_123', 101, 'https://example.com/step2')).toBe(false);
  });

  it('PH15-LIFE-03: Stale capability token cannot be used after tab navigation', () => {
    manager.registerTab(101, 'https://example.com/pageA');
    manager.registerCapabilityToken('token_A', 101, 'https://example.com/pageA');

    manager.invalidateTab(101, 'Navigated away');

    expect(manager.isCapabilityTokenValid('token_A', 101, 'https://example.com/pageA')).toBe(false);
    expect(manager.consumeCapabilityToken('token_A')).toBe(false);
  });

  it('PH15-LIFE-04: Tab removal cleans up tab session and invalidates tokens', () => {
    manager.registerTab(202, 'https://example.com/form');
    manager.registerCapabilityToken('tok_form', 202, 'https://example.com/form');

    manager.invalidateTab(202, 'Tab closed');

    expect(manager.isCapabilityTokenValid('tok_form', 202, 'https://example.com/form')).toBe(false);
  });

  it('PH15-LIFE-05: Detached element (isConnected = false) is rejected by element connection checker', () => {
    const detached = document.createElement('div');
    // Not appended to document
    expect(manager.isElementConnected(detached, document)).toBe(false);
  });

  it('PH15-LIFE-06: Element from foreign document is rejected by element connection checker', () => {
    const foreignDoc = document.implementation.createHTMLDocument('Foreign');
    const foreignEl = foreignDoc.createElement('button');
    foreignDoc.body.appendChild(foreignEl);

    // Check against current active document
    expect(manager.isElementConnected(foreignEl, document)).toBe(false);
  });

  it('PH15-LIFE-07: Disconnected content script ("Receiving end does not exist") generates clean LifecycleError', () => {
    const err = new Error('Could not establish connection. Receiving end does not exist.');
    const lifecycleErr = manager.handleContentScriptDisconnect(err);

    expect(lifecycleErr.category).toBe('LIFECYCLE');
    expect(lifecycleErr.userMessage).toContain('Please refresh the page');
  });

  it('PH15-LIFE-08: Extension reload ("Extension context invalidated") generates clean LifecycleError', () => {
    const err = new Error('Extension context invalidated.');
    const lifecycleErr = manager.handleContentScriptDisconnect(err);

    expect(lifecycleErr.category).toBe('LIFECYCLE');
    expect(lifecycleErr.userMessage).toContain('ACCESSOS was updated or reloaded');
  });

  it('PH15-LIFE-09: One-shot capability token consumption invalidates token for subsequent calls', () => {
    manager.registerTab(303, 'https://example.com/apply');
    manager.registerCapabilityToken('one_shot_token', 303, 'https://example.com/apply');

    const firstConsume = manager.consumeCapabilityToken('one_shot_token');
    expect(firstConsume).toBe(true);

    const secondConsume = manager.consumeCapabilityToken('one_shot_token');
    expect(secondConsume).toBe(false);
  });

  it('PH15-LIFE-10: Replay of consumed capability token fails', () => {
    manager.registerTab(404, 'https://example.com/test');
    manager.registerCapabilityToken('replay_token', 404, 'https://example.com/test');

    manager.consumeCapabilityToken('replay_token');

    expect(manager.isCapabilityTokenValid('replay_token', 404, 'https://example.com/test')).toBe(false);
  });

  it('PH15-LIFE-11: Capability token issued for URL A is invalid when tab changes to URL B', () => {
    manager.registerTab(505, 'https://example.com/urlA');
    manager.registerCapabilityToken('token_urlA', 505, 'https://example.com/urlA');

    // Attempt validation on different URL
    expect(manager.isCapabilityTokenValid('token_urlA', 505, 'https://example.com/urlB')).toBe(false);
  });

  it('PH15-LIFE-12: Service worker suspension/restart resets state safely without granting permissions', () => {
    manager.registerTab(606, 'https://example.com');
    manager.registerCapabilityToken('tok_sw', 606, 'https://example.com');

    // Simulate worker restart / state flush
    manager.reset();

    expect(manager.isCapabilityTokenValid('tok_sw', 606, 'https://example.com')).toBe(false);
  });

  it('PH15-LIFE-13: Element replaced in DOM (same tag, new instance) fails stale element validation', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const oldInput = document.createElement('input');
    oldInput.id = 'target-input';
    container.appendChild(oldInput);

    expect(manager.isElementConnected(oldInput, document)).toBe(true);

    // Replace oldInput with replacementInput
    container.removeChild(oldInput);
    const replacementInput = document.createElement('input');
    replacementInput.id = 'target-input';
    container.appendChild(replacementInput);

    // oldInput is now detached
    expect(manager.isElementConnected(oldInput, document)).toBe(false);
    expect(manager.isElementConnected(replacementInput, document)).toBe(true);

    document.body.removeChild(container);
  });

  it('PH15-LIFE-14: Tab ID mismatch invalidates execution attempt', () => {
    manager.registerTab(707, 'https://example.com');
    manager.registerCapabilityToken('tab_token', 707, 'https://example.com');

    // Passing wrong tab ID (e.g. 708)
    expect(manager.isCapabilityTokenValid('tab_token', 708, 'https://example.com')).toBe(false);
  });

  it('PH15-LIFE-15: Reset clears all active tab sessions and token registries', () => {
    manager.registerTab(808, 'https://example.com');
    manager.registerCapabilityToken('clean_token', 808, 'https://example.com');

    manager.reset();

    expect(manager.consumeCapabilityToken('clean_token')).toBe(false);
    expect(manager.isCapabilityTokenValid('clean_token', 808, 'https://example.com')).toBe(false);
  });
});
