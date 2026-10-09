/**
 * ACCESSOS Safe Interaction Policy Engine (Phase 8).
 * Evaluates proposed actions against allowlists, sensitive data protections,
 * and user confirmation requirements.
 */

import type { InteractionIntent, PolicyEvaluation, ActionType } from './types';

export const BLOCKED_ACTIONS = new Set<string>([
  'SUBMIT',
  'NAVIGATE',
  'DELETE',
  'PURCHASE',
  'SEND',
  'LOGIN',
  'DOWNLOAD',
  'UPLOAD',
  'EXECUTE_SCRIPT',
  'CLICK_SUBMIT',
]);

const SENSITIVE_KEYWORDS = [
  'password',
  'pwd',
  'secret',
  'token',
  'otp',
  'auth',
  'cvv',
  'cvc',
  'credit_card',
  'card_number',
  'bank_account',
  'pin',
  'ssn',
  'security_code',
];

export function isBlockedAction(actionName?: string): boolean {
  if (!actionName || typeof actionName !== 'string') return false;
  return BLOCKED_ACTIONS.has(actionName.trim().toUpperCase());
}

/**
 * Checks whether an element is a password or sensitive credential field.
 */
export function isSensitiveField(el?: HTMLElement | null, fieldType?: string): boolean {
  if (!el && !fieldType) return false;

  if (fieldType) {
    const cleanType = fieldType.toLowerCase();
    if (SENSITIVE_KEYWORDS.some((kw) => cleanType.includes(kw))) {
      return true;
    }
  }

  if (el && typeof el.getAttribute === 'function') {
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    if (tagName === 'input') {
      const inputType = ((el as HTMLInputElement).type || el.getAttribute('type') || '').toLowerCase();
      if (inputType === 'password') {
        return true;
      }
    }

    const attrs = [
      el.id,
      el.getAttribute('name'),
      el.getAttribute('autocomplete'),
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('data-accessos-id'),
    ];

    for (const attr of attrs) {
      if (attr) {
        const lower = attr.toLowerCase();
        if (SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw))) {
          return true;
        }
      }
    }

    // Check label text if present
    const id = el.id;
    if (id && el.ownerDocument) {
      const label = el.ownerDocument.querySelector(`label[for="${id}"]`);
      if (label?.textContent) {
        const textLower = label.textContent.toLowerCase();
        if (SENSITIVE_KEYWORDS.some((kw) => textLower.includes(kw))) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Evaluates an interaction intent against policy rules.
 */
export function evaluateInteractionPolicy(
  intent: InteractionIntent,
  elOrDoc?: HTMLElement | Document | null
): PolicyEvaluation {
  let targetEl: HTMLElement | null = null;
  if (elOrDoc) {
    if ((elOrDoc as unknown as { nodeType?: number }).nodeType === 9) {
      const doc = elOrDoc as Document;
      targetEl = (doc.querySelector(`[data-accessos-id="${intent?.targetElementId}"]`) ||
        doc.getElementById(intent?.targetElementId || '')) as HTMLElement | null;
    } else if (typeof (elOrDoc as HTMLElement).getAttribute === 'function') {
      targetEl = elOrDoc as HTMLElement;
    }
  }

  // 1. Check if action type is explicitly forbidden or missing
  if (!intent || !intent.actionType || isBlockedAction(intent.actionType)) {
    return {
      allowed: false,
      riskLevel: 'BLOCKED',
      requiresConfirmation: false,
      blockedReason: `Action '${intent?.actionType}' is invalid or strictly blocked in Phase 8 for security reasons.`,
    };
  }

  // 2. Check for sensitive field constraints
  const sensitive = isSensitiveField(targetEl) || (intent.targetElementId ? isSensitiveField(null, intent.targetElementId) : false);

  if (sensitive) {
    // Automated TYPE into sensitive fields is strictly blocked
    if (intent.actionType === 'TYPE') {
      return {
        allowed: false,
        riskLevel: 'BLOCKED',
        requiresConfirmation: false,
        blockedReason:
          'Automated data entry into sensitive fields (passwords, tokens, payment credentials) is strictly blocked.',
      };
    }

    // FOCUS and HIGHLIGHT are permitted to help user locate the field visually
    if (intent.actionType === 'FOCUS' || intent.actionType === 'HIGHLIGHT' || intent.actionType === 'CLEAR_HIGHLIGHT') {
      return {
        allowed: true,
        riskLevel: 'LOW',
        requiresConfirmation: false,
      };
    }

    return {
      allowed: false,
      riskLevel: 'BLOCKED',
      requiresConfirmation: false,
      blockedReason: 'Automated manipulation of sensitive fields is forbidden.',
    };
  }

  // 3. Action-specific validation
  switch (intent.actionType as ActionType) {
    case 'TYPE':
      if (intent.value === undefined || intent.value === null || intent.value === '') {
        return {
          allowed: false,
          riskLevel: 'MEDIUM',
          requiresConfirmation: true,
          blockedReason: 'TYPE action requires an explicit, non-empty value.',
        };
      }

      // Provenance validation (Issue 1)
      if (intent.source === 'AI_SUGGESTION' && intent.valueSource === 'USER_EXPLICIT') {
        return {
          allowed: false,
          riskLevel: 'BLOCKED',
          requiresConfirmation: false,
          blockedReason: 'AI suggestions cannot forge USER_EXPLICIT value provenance.',
        };
      }

      if (intent.valueSource !== 'USER_EXPLICIT') {
        return {
          allowed: false,
          riskLevel: 'BLOCKED',
          requiresConfirmation: false,
          blockedReason:
            'TYPE action rejected: mutating value must have explicit trusted user provenance (USER_EXPLICIT). AI-generated values cannot be typed.',
        };
      }

      return {
        allowed: true,
        riskLevel: 'LOW',
        requiresConfirmation: true,
      };

    case 'SELECT_OPTION':
      if (!intent.optionValue) {
        return {
          allowed: false,
          riskLevel: 'MEDIUM',
          requiresConfirmation: true,
          blockedReason: 'SELECT_OPTION requires an explicit optionValue.',
        };
      }
      return {
        allowed: true,
        riskLevel: 'LOW',
        requiresConfirmation: true,
      };

    case 'TOGGLE_CHECKBOX':
      if (intent.checked === undefined || intent.checked === null) {
        return {
          allowed: false,
          riskLevel: 'MEDIUM',
          requiresConfirmation: true,
          blockedReason: 'TOGGLE_CHECKBOX requires an explicit boolean target state.',
        };
      }
      return {
        allowed: true,
        riskLevel: 'LOW',
        requiresConfirmation: true,
      };

    case 'FOCUS':
    case 'HIGHLIGHT':
    case 'CLEAR_HIGHLIGHT':
      return {
        allowed: true,
        riskLevel: 'LOW',
        requiresConfirmation: false,
      };

    default:
      return {
        allowed: false,
        riskLevel: 'BLOCKED',
        requiresConfirmation: false,
        blockedReason: `Unsupported action type: ${intent.actionType}`,
      };
  }
}
