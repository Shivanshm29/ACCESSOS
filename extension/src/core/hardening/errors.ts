/**
 * ACCESSOS Global Error Handling & Sanitization (Phase 15 Production Hardening)
 * Provides typed error classes, classification, safe sanitization (zero PII/credential leak),
 * and deterministic fallback helpers.
 */

export type ErrorCategory =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'LIFECYCLE'
  | 'VALIDATION'
  | 'POLICY'
  | 'STORAGE'
  | 'PROVIDER'
  | 'UNKNOWN';

export class AppError extends Error {
  public category: ErrorCategory;
  public userMessage: string;
  public isSanitized: boolean;

  constructor(
    message: string,
    category: ErrorCategory = 'UNKNOWN',
    userMessage: string = 'An unexpected error occurred. Please try again.'
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.userMessage = userMessage;
    this.isSanitized = true;
  }
}

export class NetworkError extends AppError {
  public statusCode?: number;
  constructor(message: string, statusCode?: number, userMessage: string = 'Network connection failed. Please check your connection.') {
    super(message, 'NETWORK', userMessage);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Request timed out', userMessage: string = 'The operation timed out. Please try again.') {
    super(message, 'TIMEOUT', userMessage);
    this.name = 'TimeoutError';
  }
}

export class LifecycleError extends AppError {
  constructor(message: string, userMessage: string = 'Page state changed. Please refresh and try again.') {
    super(message, 'LIFECYCLE', userMessage);
    this.name = 'LifecycleError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, userMessage: string = 'Input validation failed. Please check the provided data.') {
    super(message, 'VALIDATION', userMessage);
    this.name = 'ValidationError';
  }
}

export class PolicyError extends AppError {
  constructor(message: string, userMessage: string = 'This operation was blocked by safety policy.') {
    super(message, 'POLICY', userMessage);
    this.name = 'PolicyError';
  }
}

export class StorageError extends AppError {
  constructor(message: string, userMessage: string = 'Storage operation failed. Using safe default settings.') {
    super(message, 'STORAGE', userMessage);
    this.name = 'StorageError';
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, userMessage: string = 'AI assistant is temporarily unavailable. Using standard mode.') {
    super(message, 'PROVIDER', userMessage);
    this.name = 'AIProviderError';
  }
}

const SENSITIVE_PATTERNS = [
  /password[=:]\s*['"]?[^\s,'"]+['"]?/gi,
  /secret[=:]\s*['"]?[^\s,'"]+['"]?/gi,
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /token[=:]\s*(?:bearer\s+)?['"]?[^\s,'"]+['"]?/gi,
  /api[_-]?key[=:]\s*['"]?[^\s,'"]+['"]?/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email regex
  /\b(?:\d{4}[ -]?){3}\d{4}\b/g, // Credit card regex
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN regex
  /https?:\/\/[^\s]+(?:\?[^\s]*)/gi, // URLs with query params that might have tokens
];

/**
 * Sanitizes any error message or string, stripping potential credentials, tokens, PII,
 * and raw HTML dumps before logging or user presentation.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred.';

  let rawMessage = '';
  if (error instanceof AppError && error.userMessage) {
    rawMessage = error.userMessage;
  } else if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else {
    try {
      rawMessage = JSON.stringify(error);
    } catch {
      rawMessage = 'Unserializable error';
    }
  }

  // Strip sensitive patterns
  let sanitized = rawMessage;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Strip raw HTML tags if any leaked
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Bound message length to prevent oversized logging or UI disruption
  if (sanitized.length > 300) {
    sanitized = sanitized.slice(0, 300) + '...';
  }

  return sanitized.trim() || 'An unexpected error occurred.';
}

/**
 * Deterministically classifies an unknown error into a standardized category.
 */
export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof AppError) {
    return error.category;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('abort') || msg.includes('timeout') || msg.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('connection')) {
      return 'NETWORK';
    }
    if (
      msg.includes('receiving end does not exist') ||
      msg.includes('context invalidated') ||
      msg.includes('tab closed') ||
      msg.includes('navigated')
    ) {
      return 'LIFECYCLE';
    }
    if (msg.includes('blocked') || msg.includes('forbidden') || msg.includes('policy')) {
      return 'POLICY';
    }
    if (msg.includes('schema') || msg.includes('validation') || msg.includes('invalid')) {
      return 'VALIDATION';
    }
    if (msg.includes('storage') || msg.includes('quota')) {
      return 'STORAGE';
    }
  }

  return 'UNKNOWN';
}

/**
 * Wraps an async operation in deterministic error handling with safe fallback.
 * Guarantees no uncaught exceptions and no sensitive value leakage.
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  onError?: (sanitizedError: string, category: ErrorCategory) => void
): Promise<T> {
  try {
    return await operation();
  } catch (err: unknown) {
    const sanitizedMsg = sanitizeErrorMessage(err);
    const category = classifyError(err);
    if (onError) {
      try {
        onError(sanitizedMsg, category);
      } catch {
        // Suppress secondary handler exceptions
      }
    }
    return fallbackValue;
  }
}
