/**
 * ACCESSOS Analytics Constants & Bounds (Phase 13)
 *
 * Enforces bounded retention, schema limits, and duration bucket conversions.
 */

import type { AnalyticsAggregates, DurationBucket } from './types';

export const ANALYTICS_SCHEMA_VERSION = 1;

/**
 * Storage key in chrome.storage.local
 */
export const STORAGE_KEY_ANALYTICS_AGGREGATES = 'accessos_analytics_aggregates';
export const STORAGE_KEY_ANALYTICS_EVENTS = 'accessos_analytics_events';
export const STORAGE_KEY_ANALYTICS_SESSION = 'accessos_analytics_session';

/**
 * Retention and capacity bounds
 */
export const MAX_RAW_ANALYTICS_EVENTS = 100;
export const MAX_ANALYTICS_EVENT_PAYLOAD_BYTES = 4096;
export const MAX_AGGREGATE_STORE_BYTES = 32768; // 32 KB
export const MAX_SESSION_LIFETIME_MS = 30 * 60 * 1000; // 30 minutes of inactivity

/**
 * Duration bucketing utility
 */
export function getDurationBucket(durationMs: number): DurationBucket {
  if (durationMs < 1000) return '<1s';
  if (durationMs < 5000) return '1-5s';
  if (durationMs < 15000) return '5-15s';
  if (durationMs < 30000) return '15-30s';
  if (durationMs < 60000) return '30-60s';
  return '>60s';
}

/**
 * Creates empty, default aggregates
 */
export function createDefaultAggregates(): AnalyticsAggregates {
  return {
    accessibility: {
      analyses: 0,
      barriers: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      totalBarriers: 0,
      pagesWithBarriers: 0,
      scoreSum: 0,
      scoreCount: 0,
      averageScore: 0,
    },
    guidedMode: {
      started: 0,
      completed: 0,
      stepsCompleted: 0,
      stepsSkipped: 0,
      stepsExited: 0,
      completionRate: 0,
    },
    explainAnything: {
      requests: 0,
      modes: {
        SIMPLE: 0,
        STANDARD: 0,
        DETAILED: 0,
      },
      completed: 0,
      exited: 0,
    },
    documents: {
      analyzed: 0,
      matches: 0,
      partialMatches: 0,
      noMatches: 0,
      ambiguous: 0,
      notEnoughEvidence: 0,
      successful: 0,
      failed: 0,
    },
    completion: {
      checks: 0,
      complete: 0,
      incomplete: 0,
      blocked: 0,
      invalid: 0,
      totalBlockers: 0,
      totalWarnings: 0,
      checksBeforeCompletion: 0,
      progressBuckets: {
        '0-25%': 0,
        '26-50%': 0,
        '51-75%': 0,
        '76-99%': 0,
        '100%': 0,
      },
    },
    interactions: {
      requested: 0,
      confirmed: 0,
      blocked: 0,
      cancelled: 0,
      byAction: {
        CLICK: 0,
        INPUT: 0,
        SELECT: 0,
        HIGHLIGHT: 0,
        OTHER: 0,
      },
    },
    durationBuckets: {
      '<1s': 0,
      '1-5s': 0,
      '5-15s': 0,
      '15-30s': 0,
      '30-60s': 0,
      '>60s': 0,
    },
    errors: {},
    totalEvents: 0,
    lastUpdated: Date.now(),
  };
}
