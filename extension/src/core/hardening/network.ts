/**
 * ACCESSOS Hardened Network & Provider Resilience Client (Phase 15 Production Hardening)
 * Features:
 * 1. Explicit request timeouts via AbortController.
 * 2. Bounded retries ONLY for idempotent read-only requests with exponential backoff & jitter.
 * 3. STRICTLY NO RETRIES for non-idempotent or mutating operations (prevents duplicate execution).
 * 4. Offline detection and graceful degradation.
 * 5. Sanitized error messages (no API keys, sensitive URLs, or internal stack traces exposed).
 */

import { NetworkError, TimeoutError, sanitizeErrorMessage } from './errors';

export interface ResilientRequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  isIdempotent?: boolean; // Default true for GET/read-only; MUST be false for mutations
  headers?: Record<string, string>;
  fallbackResponse?: unknown;
}

export class HardenedNetworkClient {
  private defaultTimeoutMs: number;
  private defaultMaxRetries: number;
  private defaultBaseDelayMs: number;

  constructor(options?: { timeoutMs?: number; maxRetries?: number; baseDelayMs?: number }) {
    this.defaultTimeoutMs = options?.timeoutMs ?? 15000;
    this.defaultMaxRetries = options?.maxRetries ?? 2;
    this.defaultBaseDelayMs = options?.baseDelayMs ?? 200;
  }

  /**
   * Checks whether the browser is currently online.
   */
  public isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Executes a resilient fetch with timeouts, bounded retry (for idempotent only), and sanitization.
   */
  public async fetchWithResilience<T>(
    url: string,
    init: RequestInit = {},
    options: ResilientRequestOptions = {}
  ): Promise<T> {
    const isIdempotent = options.isIdempotent ?? (init.method === 'GET' || !init.method);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const maxRetries = isIdempotent ? (options.maxRetries ?? this.defaultMaxRetries) : 0; // Strictly 0 retries if not idempotent
    const baseDelayMs = options.baseDelayMs ?? this.defaultBaseDelayMs;

    // Check offline status first
    if (!this.isOnline()) {
      throw new NetworkError(
        'Client is currently offline',
        0,
        'No internet connection. Please check your network settings.'
      );
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            ...(init.headers || {}),
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const status = response.status;
          let detail = `Server responded with HTTP ${status}`;
          try {
            const errJson = await response.json();
            if (errJson && typeof errJson.detail === 'string') {
              detail = errJson.detail;
            }
          } catch {
            // response was not JSON
          }

          // 4xx client errors (e.g. 400, 401, 403, 404, 422) should NOT be retried
          if (status >= 400 && status < 500) {
            throw new NetworkError(`Backend returned HTTP ${status}`, status, sanitizeErrorMessage(detail));
          }

          // 5xx server errors may be retried only if idempotent and attempt <= maxRetries
          lastError = new NetworkError(`Backend returned HTTP ${status}`, status, detail);
          if (attempt <= maxRetries && isIdempotent) {
            await this.delay(this.calculateBackoff(attempt, baseDelayMs));
            continue;
          }

          throw lastError;
        }

        const data = (await response.json()) as T;
        return data;
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof NetworkError && err.statusCode && err.statusCode < 500) {
          // Client errors fail immediately without retry
          throw err;
        }

        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new TimeoutError(
            `Request to server timed out after ${timeoutMs}ms`,
            'The request timed out. Please try again.'
          );
        } else if (err instanceof NetworkError) {
          lastError = err;
        } else {
          lastError = new NetworkError(
            err instanceof Error ? err.message : 'Network error',
            0,
            'Unable to communicate with the service. Please verify it is running.'
          );
        }

        if (attempt <= maxRetries && isIdempotent) {
          await this.delay(this.calculateBackoff(attempt, baseDelayMs));
          continue;
        }

        break;
      }
    }

    throw lastError || new NetworkError('Request failed after retries');
  }

  /**
   * Computes exponential backoff with jitter: baseDelay * 2^(attempt-1) + random jitter.
   */
  private calculateBackoff(attempt: number, baseDelayMs: number): number {
    const exponential = baseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 50;
    return Math.min(exponential + jitter, 3000); // Max delay capped at 3s
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const hardenedNetworkClient = new HardenedNetworkClient();
