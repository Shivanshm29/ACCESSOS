/**
 * ACCESSOS Centralized Analytics Service (Phase 13)
 *
 * Provides a single, privacy-preserving, non-authoritative event recording pipeline:
 * - Sanitizes every event against Phase 11 privacy invariants.
 * - Enforces bounded retention (max 100 recent events, max 32 KB aggregates).
 * - Manages ephemeral sessions (no personal identifiers or cross-site tracking).
 * - Fails safely: failures never throw or disrupt core ACCESSOS execution.
 * - Purely local: strictly zero external network transmission.
 */

import type {
  AnalyticsAggregates,
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsSession,
} from './types';
import {
  createDefaultAggregates,
  getDurationBucket,
  MAX_RAW_ANALYTICS_EVENTS,
  STORAGE_KEY_ANALYTICS_AGGREGATES,
  STORAGE_KEY_ANALYTICS_EVENTS,
} from './constants';
import { sanitizeAnalyticsEvent } from './sanitizer';
import {
  clearAnalyticsSession,
  getOrCreateAnalyticsSession,
  resetAnalyticsSession,
  touchAnalyticsSession,
} from './session';
import { updateAggregates } from './aggregator';
import { PreferencesStorage } from '../preferences/storage';

export class AnalyticsService {
  private static instance: AnalyticsService | null = null;
  private aggregates: AnalyticsAggregates = createDefaultAggregates();
  private recentEvents: AnalyticsEvent[] = [];
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Resets singleton instance (useful for clean testing states).
   */
  public static resetInstance(): void {
    if (AnalyticsService.instance) {
      AnalyticsService.instance.aggregates = createDefaultAggregates();
      AnalyticsService.instance.recentEvents = [];
      AnalyticsService.instance.isLoaded = false;
    }
    AnalyticsService.instance = null;
    clearAnalyticsSession();
  }

  /**
   * Loads persisted aggregates and recent events from chrome.storage.local if available.
   */
  public async loadFromStorage(): Promise<void> {
    if (this.isLoaded) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get([
          STORAGE_KEY_ANALYTICS_AGGREGATES,
          STORAGE_KEY_ANALYTICS_EVENTS,
        ]);

        if (stored[STORAGE_KEY_ANALYTICS_AGGREGATES]) {
          this.aggregates = stored[STORAGE_KEY_ANALYTICS_AGGREGATES] as AnalyticsAggregates;
        }
        if (Array.isArray(stored[STORAGE_KEY_ANALYTICS_EVENTS])) {
          this.recentEvents = stored[STORAGE_KEY_ANALYTICS_EVENTS] as AnalyticsEvent[];
        }
      }
    } catch {
      // Fallback silently to in-memory defaults
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Persists aggregates and recent events to storage if available.
   */
  private async persistToStorage(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [STORAGE_KEY_ANALYTICS_AGGREGATES]: this.aggregates,
          [STORAGE_KEY_ANALYTICS_EVENTS]: this.recentEvents,
        });
      }
    } catch {
      // Fail closed and quiet: never throw from analytics persistence
    }
  }

  /**
   * Checks whether analytics is enabled in user preferences.
   */
  public async isAnalyticsEnabled(): Promise<boolean> {
    try {
      const prefs = await PreferencesStorage.getPreferences();
      // Default is true if undefined, but explicit false disables
      return (prefs as any).analyticsEnabled !== false;
    } catch {
      return true;
    }
  }

  /**
   * Centralized event recording pipeline.
   * Never throws; returns true if accepted, false if rejected or disabled.
   */
  public async recordEvent(input: AnalyticsEventInput): Promise<boolean> {
    try {
      await this.loadFromStorage();

      const enabled = await this.isAnalyticsEnabled();
      if (!enabled) {
        return false;
      }

      const session = touchAnalyticsSession();
      const now = Date.now();
      const eventId = `evt_${now}_${Math.random().toString(36).substring(2, 9)}`;

      const rawEvent: Record<string, unknown> = {
        eventId,
        eventType: input.eventType,
        timestamp: now,
        sessionId: session.sessionId,
        feature: input.feature,
        success: input.success,
        version: 1,
      };

      if (input.durationMs !== undefined && Number.isFinite(input.durationMs)) {
        rawEvent.durationBucket = getDurationBucket(input.durationMs);
      }
      if (input.coarseResultCategory) {
        rawEvent.coarseResultCategory = input.coarseResultCategory;
      }
      if (input.stageId) {
        rawEvent.stageId = input.stageId;
      }
      if (input.anonymizedTargetCategory) {
        rawEvent.anonymizedTargetCategory = input.anonymizedTargetCategory;
      }
      if (input.countMetrics) {
        rawEvent.countMetrics = input.countMetrics;
      }
      if (input.errorCode) {
        rawEvent.errorCode = input.errorCode;
      }

      const validation = sanitizeAnalyticsEvent(rawEvent);
      if (!validation.valid || !validation.sanitized) {
        return false;
      }

      const sanitizedEvent = validation.sanitized;

      // Update aggregates deterministically
      this.aggregates = updateAggregates(this.aggregates, sanitizedEvent);

      // Append to bounded recent events buffer
      this.recentEvents.push(sanitizedEvent);
      if (this.recentEvents.length > MAX_RAW_ANALYTICS_EVENTS) {
        this.recentEvents = this.recentEvents.slice(-MAX_RAW_ANALYTICS_EVENTS);
      }

      await this.persistToStorage();
      return true;
    } catch {
      // Safe boundary: analytics errors must never break caller execution
      return false;
    }
  }

  /**
   * Retrieves aggregated analytics.
   */
  public async getAggregates(): Promise<AnalyticsAggregates> {
    await this.loadFromStorage();
    return JSON.parse(JSON.stringify(this.aggregates));
  }

  /**
   * Retrieves bounded recent analytics events.
   */
  public async getRecentEvents(): Promise<AnalyticsEvent[]> {
    await this.loadFromStorage();
    return JSON.parse(JSON.stringify(this.recentEvents));
  }

  /**
   * Clears all local analytics data (aggregates, recent events, and session).
   */
  public async clearAnalytics(): Promise<void> {
    this.aggregates = createDefaultAggregates();
    this.recentEvents = [];
    clearAnalyticsSession();

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove([
          STORAGE_KEY_ANALYTICS_AGGREGATES,
          STORAGE_KEY_ANALYTICS_EVENTS,
        ]);
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Returns current ephemeral session metadata.
   */
  public getSession(): AnalyticsSession {
    return getOrCreateAnalyticsSession();
  }

  /**
   * Resets ephemeral session identifier.
   */
  public resetSession(): AnalyticsSession {
    return resetAnalyticsSession();
  }
}

export const analyticsService = AnalyticsService.getInstance();
