/**
 * ACCESSOS Extension Runtime & Build-Time Configuration
 */

// Default local development backend URL
export const DEFAULT_BACKEND_URL = 'http://localhost:8000';

// Optional build-time injected backend URL
const INJECTED_BACKEND_URL =
  (typeof process !== 'undefined' && process.env?.VITE_BACKEND_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) ||
  '';

/**
 * Validates whether a given URL string is an acceptable HTTP/HTTPS endpoint.
 */
export function isValidBackendUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    if (!parsed.hostname || parsed.hostname.length === 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the active backend URL:
 * 1. Build-time override (VITE_BACKEND_URL) if specified and valid.
 * 2. Default fallback (DEFAULT_BACKEND_URL).
 */
export function getBackendUrl(): string {
  if (INJECTED_BACKEND_URL && isValidBackendUrl(INJECTED_BACKEND_URL)) {
    return INJECTED_BACKEND_URL.replace(/\/+$/, '');
  }
  return DEFAULT_BACKEND_URL;
}
