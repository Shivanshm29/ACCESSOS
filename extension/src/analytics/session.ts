/**
 * ACCESSOS Analytics Ephemeral Session Manager (Phase 13)
 *
 * Implements a bounded, privacy-preserving session model:
 * - Ephemeral random identifier (no user identity, no account ID, no IP, no fingerprint).
 * - Automatic timeout after 30 minutes of inactivity.
 * - Deterministic reset and clearing.
 */

import type { AnalyticsSession } from './types';
import { MAX_SESSION_LIFETIME_MS } from './constants';

let currentSession: AnalyticsSession | null = null;

function generateEphemeralSessionId(): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `session_${time}_${rand}`;
}

export function getOrCreateAnalyticsSession(): AnalyticsSession {
  const now = Date.now();

  if (currentSession) {
    // Check if session has expired due to inactivity
    if (now - currentSession.lastActiveAt > MAX_SESSION_LIFETIME_MS) {
      currentSession = {
        sessionId: generateEphemeralSessionId(),
        startedAt: now,
        lastActiveAt: now,
        eventCount: 0,
      };
    }
  } else {
    currentSession = {
      sessionId: generateEphemeralSessionId(),
      startedAt: now,
      lastActiveAt: now,
      eventCount: 0,
    };
  }

  return { ...currentSession };
}

export function touchAnalyticsSession(): AnalyticsSession {
  const session = getOrCreateAnalyticsSession();
  const now = Date.now();
  currentSession = {
    ...session,
    lastActiveAt: now,
    eventCount: session.eventCount + 1,
  };
  return { ...currentSession };
}

export function resetAnalyticsSession(): AnalyticsSession {
  const now = Date.now();
  currentSession = {
    sessionId: generateEphemeralSessionId(),
    startedAt: now,
    lastActiveAt: now,
    eventCount: 0,
  };
  return { ...currentSession };
}

export function clearAnalyticsSession(): void {
  currentSession = null;
}
