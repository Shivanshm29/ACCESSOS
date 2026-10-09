/**
 * ACCESSOS Security Constants & Limits (Phase 11)
 */

export const SECURITY_VERSION = 1;

// Bounded Size & Depth Limits
export const MAX_STRING_LENGTH = 10000;
export const MAX_INSTRUCTION_LENGTH = 500;
export const MAX_PAYLOAD_BYTES = 524288; // 512 KB
export const MAX_DOCUMENT_BYTES = 10485760; // 10 MB
export const MAX_ARRAY_ITEMS = 100;
export const MAX_OBJECT_DEPTH = 5;
export const MAX_PROMPT_CHARS = 12000;
export const MAX_AI_RESPONSE_CHARS = 16000;

// Redaction Tokens
export const REDACTION_PASSWORD = '[REDACTED_PASSWORD]';
export const REDACTION_TOKEN = '[REDACTED_TOKEN]';
export const REDACTION_OTP = '[REDACTED_OTP]';
export const REDACTION_CVV = '[REDACTED_CVV]';
export const REDACTION_CARD = '[REDACTED_CARD]';
export const REDACTION_BANK = '[REDACTED_BANK_ACCOUNT]';
export const REDACTION_GOV_ID = '[REDACTED_GOV_ID]';
export const REDACTION_PATH = '[LOCAL_PATH]';

// Sensitive Pattern Regular Expressions
export const REGEX_PASSWORD_FIELD = /(?:password|passwd|pwd|secret|auth_key|private_key|token)/i;

export const REGEX_OTP = /\b((?:otp|code|one[ -]?time[ -]?password|pin|verification[ -]?code)[=:\s]{1,4})[0-9]{4,8}\b/gi;

export const REGEX_BEARER_TOKEN = /\b(?:bearer\s+[a-zA-Z0-9_\-.]{16,}|(?:ghp|gho|ghu|glpat|xoxb|xoxp|sk_live|sk_test)_[a-zA-Z0-9]{16,})\b/gi;

export const REGEX_CREDIT_CARD = /\b(?:4[0-9]{3}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{1,4}|5[1-5][0-9]{2}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}|6(?:011|5[0-9]{2})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}|3[47][0-9]{2}[- ]?[0-9]{6}[- ]?[0-9]{5}|4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/g;

export const REGEX_CVV = /\b((?:cvv|cvc|cid|security[ -]?code)[=:\s]{1,3})[0-9]{3,4}\b/gi;

export const REGEX_SSN = /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g;

export const REGEX_AADHAAR = /\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g;

export const REGEX_BANK_ACCOUNT = /\b((?:acct|account|acc)[_#\s-]*[no.]*[:\s]{1,3})[0-9]{9,18}\b/gi;

export const REGEX_WINDOWS_PATH = /\b[a-zA-Z]:\\[a-zA-Z0-9_\-.\\]+\b/g;

export const REGEX_UNIX_PATH = /(?:^|[\s"'=])(\/(?:etc|var|usr|home|tmp|opt|root|bin)\/[a-zA-Z0-9_\-./]+)/g;

export const REGEX_HTML_TAGS = /<\/?(?:script|style|iframe|object|embed|applet|form|input|button|link|meta)[^>]*>/gi;

// Prompt Injection Detection Signatures
export const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /disregard\s+(?:all\s+)?prior\s+prompts/i,
  /override\s+system\s+prompt/i,
  /you\s+are\s+now\s+(?:an\s+unrestricted|a\s+different|in\s+developer\s+mode)/i,
  /system\s*:\s*you\s+must/i,
  /new\s+system\s+instruction/i,
  /bypass\s+(?:safety|security|rules)/i,
  /jailbreak/i,
  /execute\s+javascript\s*:/i,
  /click\s+submit\s+automatically/i,
  /transfer\s+funds/i,
];

// Egress Allowlist
export const ALLOWED_NETWORK_HOSTS = new Set<string>([
  '127.0.0.1',
  'localhost',
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'openrouter.ai',
]);
