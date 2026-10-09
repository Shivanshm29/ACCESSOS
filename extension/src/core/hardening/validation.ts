/**
 * ACCESSOS Input/Output Validation & Boundary Hardening (Phase 15 Production Hardening)
 * Features:
 * 1. Deep schema validation and size/depth bounding.
 * 2. Prototype pollution guards.
 * 3. URL protocol allowlisting (http/https only; blocks javascript:, data:, file:).
 * 4. Untrusted prompt injection pattern detection.
 * 5. Safe JSON parsing with deterministic fallback.
 */

import { ValidationError } from './errors';

export interface ValidationBounds {
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  maxDepth?: number;
}

const DEFAULT_BOUNDS: Required<ValidationBounds> = {
  maxStringLength: 10000,
  maxArrayLength: 200,
  maxObjectKeys: 100,
  maxDepth: 10,
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted|new|jailbroken)/i,
  /system\s+prompt\s*:/i,
  /bypass\s+security\s+controls/i,
  /delete\s+(?:all\s+)?user\s+data/i,
];

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export class InputOutputValidator {
  /**
   * Safely parses JSON with deterministic fallback and bounded size check.
   */
  public safeJsonParse<T>(raw: unknown, fallback: T, maxBytes: number = 65536): T {
    if (typeof raw !== 'string') {
      return fallback;
    }

    if (raw.length > maxBytes) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw);
      return this.sanitizeObject(parsed) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Recursively validates and bounds an object, stripping prototype pollution vectors.
   */
  public sanitizeObject(obj: unknown, bounds: ValidationBounds = {}, currentDepth = 0): unknown {
    const limits = { ...DEFAULT_BOUNDS, ...bounds };

    if (currentDepth >= limits.maxDepth) {
      return null; // Truncate deeply nested trees
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return obj.length > limits.maxStringLength ? obj.slice(0, limits.maxStringLength) : obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      const boundedArr = obj.slice(0, limits.maxArrayLength);
      return boundedArr.map((item) => this.sanitizeObject(item, limits, currentDepth + 1));
    }

    if (typeof obj === 'object') {
      const cleanObj: Record<string, unknown> = {};
      const entries = Object.entries(obj).slice(0, limits.maxObjectKeys);

      for (const [key, value] of entries) {
        // Prototype pollution guard
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        cleanObj[key] = this.sanitizeObject(value, limits, currentDepth + 1);
      }

      return cleanObj;
    }

    return null;
  }

  /**
   * Validates a URL for safe protocols (http: and https: only).
   */
  public isSafeUrl(urlStr: string): boolean {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
      const parsed = new URL(urlStr);
      return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase());
    } catch {
      return false;
    }
  }

  /**
   * Detects prompt injection attempts in untrusted webpage text.
   */
  public containsPromptInjection(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  }

  /**
   * Validates a message envelope against Phase 15 schema requirements.
   */
  public validateEnvelope(msg: unknown): { valid: boolean; error?: string } {
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: 'Envelope must be a non-null object' };
    }

    const record = msg as Record<string, unknown>;
    if (typeof record.type !== 'string' || !record.type.trim()) {
      return { valid: false, error: 'Message type must be a non-empty string' };
    }

    if (typeof record.id !== 'string') {
      return { valid: false, error: 'Message id must be a string' };
    }

    if (typeof record.timestamp !== 'number' || isNaN(record.timestamp)) {
      return { valid: false, error: 'Message timestamp must be a valid number' };
    }

    return { valid: true };
  }

  /**
   * Asserts that a value matches an enum array or throws a ValidationError.
   */
  public assertEnum<T extends string>(value: unknown, allowed: readonly T[], fieldName: string): T {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      throw new ValidationError(
        `Invalid enum value '${String(value)}' for field '${fieldName}'. Allowed values: ${allowed.join(', ')}`
      );
    }
    return value as T;
  }
}

export const inputOutputValidator = new InputOutputValidator();
