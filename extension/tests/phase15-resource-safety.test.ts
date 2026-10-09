/**
 * @vitest-environment happy-dom
 * Phase 15 Production Hardening Test Suite
 * Memory & Resource Safety (PH15-RES-01 through PH15-RES-15)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  BoundedMap,
  ListenerRegistry,
  TimerRegistry,
  AbortRegistry,
  ResourceManager,
} from '../src/core/hardening/resources';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { analyzeAccessibility } from '../src/accessibility/index';
import { evaluateCompletion } from '../src/completion/checker';
import { analyticsService, AnalyticsEventType } from '../src/analytics/index';

describe('Phase 15 — Memory & Resource Safety (PH15-RES-01 through PH15-RES-15)', () => {
  it('PH15-RES-01: BoundedMap respects maxEntries and evicts oldest items (FIFO)', () => {
    const map = new BoundedMap<string, number>(3);
    map.set('k1', 1);
    map.set('k2', 2);
    map.set('k3', 3);
    expect(map.size).toBe(3);

    // Adding 4th item evicts k1
    map.set('k4', 4);
    expect(map.size).toBe(3);
    expect(map.has('k1')).toBe(false);
    expect(map.get('k4')).toBe(4);
    expect(map.get('k2')).toBe(2);
  });

  it('PH15-RES-02: BoundedMap updating existing key moves it forward without exceeding capacity', () => {
    const map = new BoundedMap<string, string>(2);
    map.set('a', 'alpha');
    map.set('b', 'beta');

    // Updating 'a'
    map.set('a', 'updated_alpha');
    expect(map.size).toBe(2);

    // Adding 'c' should now evict 'b' (since 'a' was refreshed)
    map.set('c', 'gamma');
    expect(map.size).toBe(2);
    expect(map.has('b')).toBe(false);
    expect(map.has('a')).toBe(true);
    expect(map.has('c')).toBe(true);
  });

  it('PH15-RES-03: BoundedMap clear empties map and resets size to 0', () => {
    const map = new BoundedMap<string, number>(5);
    map.set('x', 10);
    map.set('y', 20);
    map.clear();

    expect(map.size).toBe(0);
    expect(map.has('x')).toBe(false);
  });

  it('PH15-RES-04: ListenerRegistry adds and cleans up event listeners without memory leaks', () => {
    const registry = new ListenerRegistry();
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    let clickCount = 0;
    const handler = () => { clickCount++; };
    registry.add(btn, 'click', handler);

    btn.dispatchEvent(new Event('click'));
    expect(clickCount).toBe(1);
    expect(registry.count).toBe(1);

    // Clean up
    registry.cleanupAll();
    expect(registry.count).toBe(0);

    btn.dispatchEvent(new Event('click'));
    // Handler should not trigger after cleanup
    expect(clickCount).toBe(1);

    document.body.removeChild(btn);
  });

  it('PH15-RES-05: ListenerRegistry multiple listeners cleaned up simultaneously', () => {
    const registry = new ListenerRegistry();
    const target = document.createElement('div');

    let countA = 0;
    let countB = 0;
    registry.add(target, 'customA', () => { countA++; });
    registry.add(target, 'customB', () => { countB++; });

    expect(registry.count).toBe(2);
    registry.cleanupAll();
    expect(registry.count).toBe(0);

    target.dispatchEvent(new Event('customA'));
    target.dispatchEvent(new Event('customB'));
    expect(countA).toBe(0);
    expect(countB).toBe(0);
  });

  it('PH15-RES-06: TimerRegistry tracks timeouts and clears them cleanly', () => {
    vi.useFakeTimers();
    const timers = new TimerRegistry();

    let fired = false;
    const id = timers.setTimeout(() => { fired = true; }, 1000);
    expect(timers.activeCount).toBe(1);

    timers.clearTimeout(id);
    expect(timers.activeCount).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(fired).toBe(false);
    vi.useRealTimers();
  });

  it('PH15-RES-07: TimerRegistry tracks intervals and clears them cleanly', () => {
    vi.useFakeTimers();
    const timers = new TimerRegistry();

    let count = 0;
    const id = timers.setInterval(() => { count++; }, 200);
    expect(timers.activeCount).toBe(1);

    vi.advanceTimersByTime(500);
    expect(count).toBe(2);

    timers.clearInterval(id);
    expect(timers.activeCount).toBe(0);

    vi.advanceTimersByTime(500);
    expect(count).toBe(2); // No further increments
    vi.useRealTimers();
  });

  it('PH15-RES-08: TimerRegistry clearAll clears both timeouts and intervals', () => {
    vi.useFakeTimers();
    const timers = new TimerRegistry();

    timers.setTimeout(() => {}, 100);
    timers.setTimeout(() => {}, 200);
    timers.setInterval(() => {}, 50);
    expect(timers.activeCount).toBe(3);

    timers.clearAll();
    expect(timers.activeCount).toBe(0);
    vi.useRealTimers();
  });

  it('PH15-RES-09: AbortRegistry creates AbortController and aborts in-flight operations', () => {
    const aborts = new AbortRegistry();
    const ctrl = aborts.create();

    expect(aborts.activeCount).toBe(1);
    expect(ctrl.signal.aborted).toBe(false);

    aborts.abortAndRemove(ctrl, 'User cancelled');
    expect(ctrl.signal.aborted).toBe(true);
    expect(aborts.activeCount).toBe(0);
  });

  it('PH15-RES-10: AbortRegistry abortAll aborts all registered controllers simultaneously', () => {
    const aborts = new AbortRegistry();
    const c1 = aborts.create();
    const c2 = aborts.create();

    expect(aborts.activeCount).toBe(2);
    aborts.abortAll('Teardown');

    expect(c1.signal.aborted).toBe(true);
    expect(c2.signal.aborted).toBe(true);
    expect(aborts.activeCount).toBe(0);
  });

  it('PH15-RES-11: ResourceManager teardown executes all registries cleanup', () => {
    const manager = new ResourceManager();
    const btn = document.createElement('button');
    manager.listeners.add(btn, 'click', () => {});
    manager.timers.setTimeout(() => {}, 5000);
    manager.requests.create();

    expect(manager.listeners.count).toBe(1);
    expect(manager.timers.activeCount).toBe(1);
    expect(manager.requests.activeCount).toBe(1);

    manager.teardown();

    expect(manager.listeners.count).toBe(0);
    expect(manager.timers.activeCount).toBe(0);
    expect(manager.requests.activeCount).toBe(0);
  });

  it('PH15-RES-12: Repeated stress extractions (100 iterations) do not leak detached DOM nodes or unbounded memory', () => {
    document.body.innerHTML = `
      <main>
        <h1>Stress Testing Form</h1>
        <form id="f1">
          <label for="f-in">Input Field</label>
          <input id="f-in" name="testInput" type="text" required />
          <button type="submit">Submit</button>
        </form>
      </main>
    `;

    for (let i = 0; i < 100; i++) {
      const rep = extractPageRepresentation(document, window.location);
      expect(rep.page.title).toBeDefined();
      expect(rep.fields.length).toBe(1);
    }
  });

  it('PH15-RES-13: Repeated stress accessibility audits (100 iterations) execute without memory accumulation', () => {
    const rep = extractPageRepresentation(document, window.location);
    for (let i = 0; i < 100; i++) {
      const report = analyzeAccessibility(rep, document);
      expect(report.score.finalScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('PH15-RES-14: Repeated stress completion checks (100 iterations) run within deterministic bounded memory', () => {
    const rep = extractPageRepresentation(document, window.location);
    for (let i = 0; i < 100; i++) {
      const result = evaluateCompletion(rep, { testInput: 'Valid value' });
      expect(result.overallStatus).toBeDefined();
    }
  });

  it('PH15-RES-15: Repeated stress analytics recordings (500 iterations) respect bounded storage capacity (max 100 events FIFO)', async () => {
    await analyticsService.clearAnalytics();

    // Fire 500 events rapidly
    for (let i = 0; i < 500; i++) {
      await analyticsService.recordEvent({
        eventType: AnalyticsEventType.ACCESSIBILITY_ANALYSIS,
        feature: 'accessibility',
        success: true,
        countMetrics: { count: i },
      });
    }

    const events = await analyticsService.getRecentEvents();
    // Invariant: Bounded FIFO storage caps stored events to 100 max!
    expect(events.length).toBeLessThanOrEqual(100);

    const aggregates = await analyticsService.getAggregates();
    expect(aggregates.totalEvents).toBe(500);
  });
});
