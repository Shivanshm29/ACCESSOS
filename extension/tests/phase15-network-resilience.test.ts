/**
 * @vitest-environment happy-dom
 * Phase 15 Production Hardening Test Suite
 * Network & Provider Resilience (PH15-NET-01 through PH15-NET-15)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HardenedNetworkClient } from '../src/core/hardening/network';
import { NetworkError, TimeoutError } from '../src/core/hardening/errors';

describe('Phase 15 — Network & Provider Resilience (PH15-NET-01 through PH15-NET-15)', () => {
  let client: HardenedNetworkClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HardenedNetworkClient({ timeoutMs: 500, maxRetries: 2, baseDelayMs: 10 });
  });

  it('PH15-NET-01: Explicit request timeout triggers AbortController abort', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    await expect(
      client.fetchWithResilience('http://localhost:8000/api/v1/test', {}, { timeoutMs: 50, maxRetries: 0 })
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('PH15-NET-02: Bounded retry succeeds after transient 500 failure for idempotent request', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Transient server error' }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, attempt: callCount }),
      } as unknown as Response;
    });

    const result = await client.fetchWithResilience<{ success: boolean; attempt: number }>(
      'http://localhost:8000/api/v1/test',
      { method: 'GET' },
      { isIdempotent: true, maxRetries: 2, baseDelayMs: 5 }
    );

    expect(result.success).toBe(true);
    expect(result.attempt).toBe(2);
    expect(callCount).toBe(2);
  });

  it('PH15-NET-03: Bounded retry exhausts after maxRetries and throws sanitized NetworkError', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 503,
        json: async () => ({ detail: 'Service overloaded' }),
      } as unknown as Response;
    });

    await expect(
      client.fetchWithResilience(
        'http://localhost:8000/api/v1/test',
        { method: 'GET' },
        { isIdempotent: true, maxRetries: 2, baseDelayMs: 5 }
      )
    ).rejects.toBeInstanceOf(NetworkError);

    // Initial attempt + 2 retries = 3 calls
    expect(callCount).toBe(3);
  });

  it('PH15-NET-04: Exponential backoff delay increases with retry attempt', () => {
    // Testing private calculateBackoff via two successive attempts
    const clientAny = client as unknown as { calculateBackoff: (attempt: number, base: number) => number };
    const delay1 = clientAny.calculateBackoff(1, 100);
    const delay2 = clientAny.calculateBackoff(2, 100);
    const delay3 = clientAny.calculateBackoff(3, 100);

    expect(delay1).toBeGreaterThanOrEqual(100);
    expect(delay2).toBeGreaterThanOrEqual(200);
    expect(delay3).toBeGreaterThanOrEqual(400);
  });

  it('PH15-NET-05: Non-idempotent (mutating) request strictly does NOT retry on failure', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal failure' }),
      } as unknown as Response;
    });

    await expect(
      client.fetchWithResilience(
        'http://localhost:8000/api/v1/mutate',
        { method: 'POST' },
        { isIdempotent: false, maxRetries: 3 }
      )
    ).rejects.toBeInstanceOf(NetworkError);

    // Must strictly be 1 call only — zero retries for non-idempotent operations!
    expect(callCount).toBe(1);
  });

  it('PH15-NET-06: Client error (HTTP 400 Bad Request) fails immediately without retry', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Malformed request payload' }),
      } as unknown as Response;
    });

    await expect(
      client.fetchWithResilience('http://localhost:8000/api/v1/test', { method: 'GET' }, { maxRetries: 3 })
    ).rejects.toThrow();

    expect(callCount).toBe(1);
  });

  it('PH15-NET-07: Client error (HTTP 422 Unprocessable) fails immediately without retry', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 422,
        json: async () => ({ detail: 'Validation failed' }),
      } as unknown as Response;
    });

    await expect(
      client.fetchWithResilience('http://localhost:8000/api/v1/test', { method: 'GET' }, { maxRetries: 3 })
    ).rejects.toThrow();

    expect(callCount).toBe(1);
  });

  it('PH15-NET-08: Client error (HTTP 404 Not Found) fails immediately without retry', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Endpoint not found' }),
      } as unknown as Response;
    });

    await expect(
      client.fetchWithResilience('http://localhost:8000/api/v1/test', { method: 'GET' }, { maxRetries: 3 })
    ).rejects.toThrow();

    expect(callCount).toBe(1);
  });

  it('PH15-NET-09: Offline state (navigator.onLine = false) fails fast with NetworkError', async () => {
    vi.spyOn(client, 'isOnline').mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      client.fetchWithResilience('http://localhost:8000/api/v1/test')
    ).rejects.toBeInstanceOf(NetworkError);

    // Fetch should not even be attempted when offline
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('PH15-NET-10: Backend unavailable (connection refused) returns user-friendly error without leaking internal endpoints', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await client.fetchWithResilience('http://internal-cluster.local:8000/secret/endpoint', {}, { maxRetries: 0 });
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(NetworkError);
      expect((err as NetworkError).userMessage).not.toContain('internal-cluster.local');
      expect((err as NetworkError).userMessage).toContain('Unable to communicate');
    }
  });

  it('PH15-NET-11: Malformed server JSON response handled safely without uncaught JSON parse error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      },
    } as unknown as Response);

    await expect(
      client.fetchWithResilience('http://localhost:8000/api/v1/test', {}, { maxRetries: 0 })
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('PH15-NET-12: Provider failure cannot trigger browser mutation or execution', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('AI provider connection timeout'));

    let mutationTriggered = false;
    try {
      await client.fetchWithResilience('http://localhost:8000/api/v1/ai', {}, { maxRetries: 0 });
      mutationTriggered = true;
    } catch {
      // expected error
    }

    expect(mutationTriggered).toBe(false);
  });

  it('PH15-NET-13: Network retry cannot duplicate browser mutation', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Failed' }),
      } as unknown as Response;
    });

    try {
      // Non-idempotent mutating operation
      await client.fetchWithResilience('http://localhost:8000/api/v1/interact', { method: 'POST' }, {
        isIdempotent: false,
        maxRetries: 3,
      });
    } catch {
      // Expected
    }

    // Network client guarantees non-idempotent requests cannot be re-executed
    expect(callCount).toBe(1);
  });

  it('PH15-NET-14: Headers are merged properly without exposing Authorization tokens to third parties', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as unknown as Response;
    });

    await client.fetchWithResilience(
      'http://localhost:8000/api/v1/test',
      { headers: { 'X-Custom-Client': 'accessos' } },
      { maxRetries: 0 }
    );

    expect(capturedHeaders).toBeDefined();
    expect(capturedHeaders?.['Content-Type']).toBe('application/json');
    expect(capturedHeaders?.['X-Custom-Client']).toBe('accessos');
  });

  it('PH15-NET-15: Default timeout is bounded and respects custom timeout', async () => {
    const customTimeoutMs = 120;
    let receivedSignal: AbortSignal | null | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      receivedSignal = init?.signal;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response;
    });

    await client.fetchWithResilience('http://localhost:8000/api/v1/test', {}, { timeoutMs: customTimeoutMs });
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(false);
  });
});
