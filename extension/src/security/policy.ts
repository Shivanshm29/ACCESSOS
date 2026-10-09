/**
 * ACCESSOS Data Flow & Security Policies (Phase 11)
 * Enforces boundary rules for AI, storage, logging, and network egress.
 */

import { ALLOWED_NETWORK_HOSTS } from './constants';
import { DataClassification, type NetworkDestination } from './types';

export function canSendToAi(classification: DataClassification, key?: string): boolean {
  if (classification === DataClassification.HIGHLY_SENSITIVE) {
    return false;
  }
  if (key) {
    const k = key.toLowerCase();
    const blockedKeywords = ['password', 'pwd', 'token', 'auth', 'cvv', 'otp', 'html', 'cookie'];
    if (blockedKeywords.some((kw) => k.includes(kw))) {
      return false;
    }
  }
  return true;
}

export function canPersist(classification: DataClassification, key?: string): boolean {
  if (classification === DataClassification.HIGHLY_SENSITIVE) {
    return false;
  }
  if (key) {
    const k = key.toLowerCase();
    const blockedKeywords = ['password', 'pwd', 'token', 'auth', 'cvv', 'otp', 'raw_document', 'raw_html'];
    if (blockedKeywords.some((kw) => k.includes(kw))) {
      return false;
    }
  }
  return true;
}

export function canLog(classification: DataClassification, key?: string): boolean {
  if (
    classification === DataClassification.HIGHLY_SENSITIVE ||
    classification === DataClassification.SENSITIVE ||
    classification === DataClassification.PERSONAL
  ) {
    return false;
  }
  if (key) {
    const k = key.toLowerCase();
    const blockedKeywords = ['user_input', 'document_text', 'page_content', 'value', 'secret', 'name', 'income'];
    if (blockedKeywords.some((kw) => k.includes(kw))) {
      return false;
    }
  }
  return true;
}

export function isAllowedNetworkDestination(urlOrHost: string): boolean {
  if (!urlOrHost || typeof urlOrHost !== 'string') {
    return false;
  }

  let host = urlOrHost.trim();
  if (host.includes('://')) {
    try {
      const parsed = new URL(host);
      host = parsed.hostname;
    } catch {
      return false;
    }
  } else if (host.includes(':')) {
    host = host.split(':')[0];
  }

  return ALLOWED_NETWORK_HOSTS.has(host.toLowerCase());
}

export function getNetworkDestinations(): NetworkDestination[] {
  return [
    {
      name: 'ACCESSOS Backend',
      host: '127.0.0.1:8000',
      purpose: 'Local processing, deterministic analysis, and proxy to LLM',
      isAllowlisted: true,
    },
    {
      name: 'OpenAI API',
      host: 'api.openai.com',
      purpose: 'Optional direct/backend AI inference provider',
      isAllowlisted: true,
    },
    {
      name: 'Google Gemini API',
      host: 'generativelanguage.googleapis.com',
      purpose: 'Optional direct/backend AI inference provider',
      isAllowlisted: true,
    },
    {
      name: 'OpenRouter API',
      host: 'openrouter.ai',
      purpose: 'Optional direct/backend AI inference router',
      isAllowlisted: true,
    },
  ];
}
