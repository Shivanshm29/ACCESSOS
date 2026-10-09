/**
 * ACCESSOS AI Client
 * Communicates with the local or remote FastAPI backend for Phase 5 AI Page Analysis.
 */
import type { AIPageAnalysisRequest, AIPageAnalysisResponse } from './types';
import type { PageMetadata, PageRepresentation } from '../core/types/index';
import type { AccessibilityReport } from '../accessibility/types';

import { hardenedNetworkClient } from '../core/hardening/network';
import { sanitizeErrorMessage } from '../core/hardening/errors';
import { getBackendUrl, DEFAULT_BACKEND_URL } from '../core/config';
export { DEFAULT_BACKEND_URL };

export class AIClientError extends Error {
  public userMessage: string;
  constructor(message: string, userMessage: string = 'AI analysis is temporarily unavailable.') {
    super(message);
    this.name = 'AIClientError';
    this.userMessage = userMessage;
  }
}

/**
 * Builds the request payload from Phase 1, Phase 2, and Phase 4 structures.
 */
export function buildAIAnalysisRequest(
  metadata: PageMetadata,
  representation?: PageRepresentation,
  accessibilityReport?: AccessibilityReport,
  userGoal?: string
): AIPageAnalysisRequest {
  return {
    page: {
      title: metadata.title,
      url: metadata.url,
      hostname: metadata.hostname,
      pathname: metadata.pathname,
    },
    representation: representation as unknown as Record<string, unknown> | undefined,
    accessibilityReport: accessibilityReport as unknown as Record<string, unknown> | undefined,
    userGoal,
  };
}

/**
 * Requests AI analysis from the FastAPI backend.
 */
export async function requestAIPageAnalysis(
  payload: AIPageAnalysisRequest,
  backendUrl: string = getBackendUrl(),
  timeoutMs: number = 20000
): Promise<AIPageAnalysisResponse> {
  const url = `${backendUrl.replace(/\/$/, '')}/api/v1/analyze/page`;

  try {
    const data = await hardenedNetworkClient.fetchWithResilience<AIPageAnalysisResponse>(
      url,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        timeoutMs,
        isIdempotent: true, // Read-only query
        maxRetries: 0,
      }
    );
    return data;
  } catch (error: unknown) {
    if (error instanceof AIClientError) {
      throw error;
    }
    if (error instanceof Error && 'statusCode' in error && 'userMessage' in error) {
      throw new AIClientError(error.message, (error as { userMessage: string }).userMessage);
    }
    const sanitized = sanitizeErrorMessage(error);
    const msg = error instanceof Error ? error.message : 'Network error';
    if (msg.includes('timed out') || (error instanceof Error && error.name === 'TimeoutError')) {
      throw new AIClientError('Request timed out', 'AI analysis timed out. Please try again.');
    }
    if (msg.includes('offline') || msg.includes('Internet')) {
      throw new AIClientError('Offline', 'No internet connection. Please check your network.');
    }
    throw new AIClientError(msg, sanitized || 'AI analysis is temporarily unavailable. Backend is not reachable.');
  }
}
