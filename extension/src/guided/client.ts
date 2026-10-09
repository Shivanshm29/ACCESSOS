/**
 * ACCESSOS Guided Mode API Client
 * Requests structured, grounded step sequences from the FastAPI backend.
 */
import type {
  GuidedModeStartRequest,
  GuidedModeResponse,
} from './types';
import type { PageMetadata, PageRepresentation } from '../core/types/index';
import type { AccessibilityReport } from '../accessibility/types';
import type { AIPageAnalysisResponse } from '../ai/types';

export class GuidedModeError extends Error {
  public userMessage: string;
  constructor(message: string, userMessage: string = 'Guided Mode is temporarily unavailable.') {
    super(message);
    this.name = 'GuidedModeError';
    this.userMessage = userMessage;
  }
}

/**
 * Builds the Guided Mode request payload from structured page representation and analyses.
 */
export function buildGuidedModeRequest(
  metadata: PageMetadata,
  representation?: PageRepresentation,
  accessibilityReport?: AccessibilityReport,
  aiAnalysis?: AIPageAnalysisResponse,
  userGoal?: string,
  targetStageIndex?: number
): GuidedModeStartRequest {
  return {
    page: {
      title: metadata.title,
      url: metadata.url,
      hostname: metadata.hostname,
      pathname: metadata.pathname,
    },
    representation: representation as unknown as Record<string, unknown> | undefined,
    accessibilityReport: accessibilityReport as unknown as Record<string, unknown> | undefined,
    aiPageAnalysis: aiAnalysis as unknown as Record<string, unknown> | undefined,
    userGoal,
    targetStageIndex,
  };
}

import { hardenedNetworkClient } from '../core/hardening/network';
import { sanitizeErrorMessage } from '../core/hardening/errors';
import { getBackendUrl, DEFAULT_BACKEND_URL } from '../core/config';
export { DEFAULT_BACKEND_URL };

/**
 * Requests Guided Mode steps from the FastAPI backend.
 */
export async function requestGuidedModeStart(
  payload: GuidedModeStartRequest,
  backendUrl: string = getBackendUrl(),
  timeoutMs: number = 20000
): Promise<GuidedModeResponse> {
  const url = `${backendUrl.replace(/\/$/, '')}/api/v1/guided/start`;

  try {
    const data = await hardenedNetworkClient.fetchWithResilience<GuidedModeResponse>(
      url,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        timeoutMs,
        isIdempotent: true, // Read-only planning query
        maxRetries: 0,
      }
    );
    return data;
  } catch (error: unknown) {
    if (error instanceof GuidedModeError) {
      throw error;
    }
    if (error instanceof Error && 'statusCode' in error && 'userMessage' in error) {
      throw new GuidedModeError(error.message, (error as { userMessage: string }).userMessage);
    }
    const sanitized = sanitizeErrorMessage(error);
    const msg = error instanceof Error ? error.message : 'Network error';
    if (msg.includes('timed out') || (error instanceof Error && error.name === 'TimeoutError')) {
      throw new GuidedModeError('Request timed out', 'Guided Mode generation timed out. Please try again.');
    }
    if (msg.includes('offline') || msg.includes('Internet')) {
      throw new GuidedModeError('Offline', 'No internet connection. Please check your network.');
    }
    throw new GuidedModeError(msg, sanitized || 'Guided Mode is temporarily unavailable. Backend is not reachable.');
  }
}
