/**
 * ACCESSOS Explain Anything API Client
 * Requests structured, plain-language explanations from the FastAPI backend.
 */
import type { ExplainAnythingRequest, ExplainAnythingResponse } from './types';

export class ExplainAnythingError extends Error {
  public userMessage: string;
  constructor(message: string, userMessage: string = 'Explanation is temporarily unavailable.') {
    super(message);
    this.name = 'ExplainAnythingError';
    this.userMessage = userMessage;
  }
}

import { hardenedNetworkClient } from '../core/hardening/network';
import { sanitizeErrorMessage } from '../core/hardening/errors';
import { getBackendUrl, DEFAULT_BACKEND_URL } from '../core/config';
export { DEFAULT_BACKEND_URL };

/**
 * Sends a bounded, sanitized explanation request to the backend.
 */
export async function requestExplanation(
  payload: ExplainAnythingRequest,
  backendUrl: string = getBackendUrl(),
  timeoutMs: number = 15000
): Promise<ExplainAnythingResponse> {
  const url = `${backendUrl.replace(/\/$/, '')}/api/v1/explain`;

  try {
    const data = await hardenedNetworkClient.fetchWithResilience<ExplainAnythingResponse>(
      url,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        timeoutMs,
        isIdempotent: true,
        maxRetries: 0,
      }
    );
    return data;
  } catch (error: unknown) {
    if (error instanceof ExplainAnythingError) {
      throw error;
    }
    if (error instanceof Error && 'statusCode' in error && 'userMessage' in error) {
      throw new ExplainAnythingError(error.message, (error as { userMessage: string }).userMessage);
    }
    const sanitized = sanitizeErrorMessage(error);
    const msg = error instanceof Error ? error.message : 'Network error';
    if (msg.includes('timed out') || (error instanceof Error && error.name === 'TimeoutError')) {
      throw new ExplainAnythingError('Request timed out', 'Explanation request timed out. Please try again.');
    }
    if (msg.includes('offline') || msg.includes('Internet')) {
      throw new ExplainAnythingError('Offline', 'No internet connection. Please check your network.');
    }
    throw new ExplainAnythingError(msg, sanitized || 'Explain Anything is temporarily unavailable. Backend is not reachable.');
  }
}
