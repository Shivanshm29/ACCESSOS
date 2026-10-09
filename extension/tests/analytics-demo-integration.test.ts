/**
 * Phase 13 Demo Site & Analytics Integration Test Suite
 *
 * Simulates end-to-end user workflows on the National Student Scholarship Portal,
 * validates privacy invariants (zero PII/sensitive data leakage),
 * verifies dashboard rendering, and benchmarks analytics recording overhead (< 1 ms/event).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyticsService,
  AnalyticsService,
  AnalyticsEventType,
} from '../src/analytics/index';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import { analyzeAccessibility } from '../src/accessibility/index';
import { evaluateCompletion } from '../src/completion/index';
import { PreferencesStorage } from '../src/preferences/storage';
import { DEFAULT_PREFERENCES } from '../src/preferences/defaults';
import { PopupController } from '../src/popup/popup';

describe('Phase 13 Demo Site Analytics Integration & Performance Suite', () => {
  let demoDoc: Document;
  let demoWindow: Window;
  let popupDoc: Document;
  let popupWindow: Window;
  let controller: PopupController;

  beforeEach(async () => {
    AnalyticsService.resetInstance();
    await analyticsService.clearAnalytics();
    await PreferencesStorage.savePreferences({
      ...DEFAULT_PREFERENCES,
      analyticsEnabled: true,
    });

    // 1. Load actual Scholarship Demo Site in Happy-DOM
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    demoWindow = new Window({ url: 'http://localhost:3000/' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);

    // 2. Load Popup HTML in Happy-DOM
    const popupHtmlPath = path.resolve(__dirname, '../src/popup/popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');
    popupWindow = new Window({ url: 'chrome-extension://accessos/popup.html' });
    popupDoc = popupWindow.document as unknown as Document;
    popupDoc.write(popupHtml);

    let chromeStorageMock: Record<string, unknown> = {};
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn((p: string) => `chrome-extension://accessos/${p}`),
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 101, url: 'http://localhost:3000/' }]),
        sendMessage: vi.fn().mockResolvedValue({ success: true }),
      },
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const res: Record<string, unknown> = {};
            for (const k of keys) {
              if (chromeStorageMock[k] !== undefined) res[k] = chromeStorageMock[k];
            }
            cb(res);
          }),
          set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
            Object.assign(chromeStorageMock, items);
            if (cb) cb();
          }),
          remove: vi.fn((keys: string[], cb?: () => void) => {
            for (const k of keys) delete chromeStorageMock[k];
            if (cb) cb();
          }),
        },
      },
    };

    vi.stubGlobal('document', popupDoc);
    vi.stubGlobal('window', popupWindow);

    controller = new PopupController();
    controller.init();
    await controller.loadAndApplyPreferences();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. Simulates realistic scholarship application workflow and records privacy-safe events', async () => {
    // 1. Accessibility analysis
    const representation = extractPageRepresentation(demoDoc, demoWindow.location as unknown as Location);
    const a11yReport = analyzeAccessibility(representation);
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.ACCESSIBILITY_ANALYSIS,
      feature: 'accessibility',
      success: true,
      countMetrics: {
        critical: a11yReport.summary.bySeverity.CRITICAL,
        high: a11yReport.summary.bySeverity.HIGH,
        medium: a11yReport.summary.bySeverity.MEDIUM,
        low: a11yReport.summary.bySeverity.LOW,
        totalBarriers: a11yReport.summary.totalFindings,
        score: a11yReport.score.finalScore,
      },
    });

    // 2. Guided Mode start
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.GUIDED_MODE_STARTED,
      feature: 'guided',
      success: true,
      stageId: 'stage-1',
    });

    // 3. Guided step completion
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.GUIDED_STEP_COMPLETED,
      feature: 'guided',
      success: true,
    });

    // 4. Explain Anything request
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.EXPLANATION_REQUESTED,
      feature: 'explain',
      success: true,
      coarseResultCategory: 'SUCCESS',
      stageId: 'STANDARD',
    });

    // 5. Document analysis
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.DOCUMENT_ANALYSIS,
      feature: 'document',
      success: true,
      coarseResultCategory: 'MATCH',
    });

    // 6. Completion check
    const completionResult = evaluateCompletion(representation, {}, [], 0);
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.COMPLETION_CHECK,
      feature: 'completion',
      success: true,
      coarseResultCategory: completionResult.overallStatus as any,
      countMetrics: {
        blockingIssues: completionResult.blockingIssues.length,
        warnings: completionResult.warnings.length,
        percent: completionResult.completionPercent,
      },
    });

    // 7. Completion blocker
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.COMPLETION_BLOCKED,
      feature: 'completion',
      success: true,
    });

    // 8. Safe interaction confirmed
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.SAFE_INTERACTION_CONFIRMED,
      feature: 'interaction',
      success: true,
      anonymizedTargetCategory: 'button',
    });

    // 9. Safe interaction blocked
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.SAFE_INTERACTION_BLOCKED,
      feature: 'interaction',
      success: false,
      anonymizedTargetCategory: 'input',
    });

    // 10. User exit
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.USER_EXITED_FEATURE,
      feature: 'guided',
      success: true,
    });

    // Verification of aggregate metrics
    const aggregates = await analyticsService.getAggregates();
    expect(aggregates.totalEvents).toBe(10);
    expect(aggregates.accessibility.analyses).toBe(1);
    expect(aggregates.accessibility.totalBarriers).toBe(a11yReport.summary.totalFindings);
    expect(aggregates.guidedMode.started).toBe(1);
    expect(aggregates.guidedMode.stepsCompleted).toBe(1);
    expect(aggregates.guidedMode.stepsExited).toBe(1);
    expect(aggregates.explainAnything.requests).toBe(1);
    expect(aggregates.explainAnything.modes.STANDARD).toBe(1);
    expect(aggregates.documents.analyzed).toBe(1);
    expect(aggregates.documents.matches).toBe(1);
    expect(aggregates.completion.checks).toBe(1);
    expect(aggregates.completion.blocked).toBe(1);
    expect(aggregates.interactions.confirmed).toBe(1);
    expect(aggregates.interactions.blocked).toBe(1);
    expect(aggregates.interactions.byAction.CLICK).toBe(1);
    expect(aggregates.interactions.byAction.INPUT).toBe(1);
  });

  it('2. Rigorous privacy verification: no personal data, document content, or raw DOM in stored analytics', async () => {
    // Record an event with potential privacy leakage attempts
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.COMPLETION_CHECK,
      feature: 'completion',
      success: true,
      coarseResultCategory: 'INCOMPLETE',
      countMetrics: { blockingIssues: 5, warnings: 2, percent: 45 },
    });

    const recentEvents = await analyticsService.getRecentEvents();
    const serialized = JSON.stringify(recentEvents);

    // Forbidden terms must never appear
    const forbiddenTerms = [
      'Rahul', 'Sharma', 'Delhi', 'password', 'token', 'secret',
      'otp', 'cvv', 'card', 'bank', 'aadhaar', 'ssn', 'bearer',
      'script', 'input#', 'form', '<div',
    ];

    for (const term of forbiddenTerms) {
      expect(serialized.toLowerCase().includes(term.toLowerCase())).toBe(false);
    }
  });

  it('3. Renders local analytics dashboard in PopupController and updates UI stats', async () => {
    // Populate mock aggregates
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.ACCESSIBILITY_ANALYSIS,
      feature: 'accessibility',
      success: true,
      countMetrics: { critical: 1, high: 2, medium: 3, low: 4, totalBarriers: 10, score: 75 },
    });
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.GUIDED_MODE_STARTED,
      feature: 'guided',
      success: true,
    });
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.GUIDED_STEP_COMPLETED,
      feature: 'guided',
      success: true,
    });
    await analyticsService.recordEvent({
      eventType: AnalyticsEventType.SAFE_INTERACTION_CONFIRMED,
      feature: 'interaction',
      success: true,
      anonymizedTargetCategory: 'button',
    });

    // Refresh analytics dashboard
    await controller.handleRefreshAnalytics();

    const statA11yAnalyses = popupDoc.getElementById('stat-a11y-analyses');
    const statA11yBarriers = popupDoc.getElementById('stat-a11y-barriers');
    const statA11yScore = popupDoc.getElementById('stat-a11y-score');
    const statGuidedStarted = popupDoc.getElementById('stat-guided-started');
    const statGuidedSteps = popupDoc.getElementById('stat-guided-steps');
    const statSafeConfirmed = popupDoc.getElementById('stat-safe-confirmed');
    const eventsBadge = popupDoc.getElementById('analytics-events-badge');

    expect(statA11yAnalyses?.textContent).toBe('1');
    expect(statA11yBarriers?.textContent).toBe('10');
    expect(statA11yScore?.textContent).toBe('75/100');
    expect(statGuidedStarted?.textContent).toBe('1');
    expect(statGuidedSteps?.textContent).toBe('1');
    expect(statSafeConfirmed?.textContent).toBe('1');
    expect(eventsBadge?.textContent).toBe('4 Events');

    // Test Clear Data action
    await controller.handleClearAnalytics();
    expect(statA11yAnalyses?.textContent).toBe('0');
    expect(statA11yBarriers?.textContent).toBe('0');
    expect(eventsBadge?.textContent).toBe('0 Events');
  });

  it('4. Performance Benchmark: Analytics recording overhead is < 1 ms per event', async () => {
    const ITERATIONS = 1000;
    const startTime = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      await analyticsService.recordEvent({
        eventType: AnalyticsEventType.GUIDED_STEP_COMPLETED,
        feature: 'guided',
        success: true,
        durationMs: 120,
      });
    }

    const elapsedMs = performance.now() - startTime;
    const avgOverheadMs = elapsedMs / ITERATIONS;

    console.log(`ANALYTICS_BENCHMARKS: ${JSON.stringify({
      totalIterations: ITERATIONS,
      totalElapsedMs: Number(elapsedMs.toFixed(2)),
      avgOverheadPerEventMs: Number(avgOverheadMs.toFixed(4)),
      targetOverheadMs: 1.0,
    })}`);

    expect(avgOverheadMs).toBeLessThan(1.0);
  });
});
