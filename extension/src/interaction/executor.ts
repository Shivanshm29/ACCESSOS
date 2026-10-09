/**
 * ACCESSOS Allowlisted Interaction Executor (Phase 8).
 * Executes strictly validated and user-confirmed atomic browser actions on known DOM elements.
 *
 * SAFETY INVARIANTS:
 * 1. Independent target & policy validation before execution.
 * 2. Dedicated action handlers — zero generic or arbitrary DOM manipulation.
 * 3. Never submits forms (blocks submit(), requestSubmit(), clicking submit buttons).
 * 4. Never executes model-generated scripts (zero eval, new Function, script injection).
 * 5. Independent post-execution result verification; no autonomous retries.
 * 6. Low-level executor accepts ONLY ValidatedExecutionCommands produced by the validation pipeline.
 *    Direct invocation with untrusted intents or unconfirmed mutations is strictly barred.
 */

import type {
  ActionType,
  InteractionIntent,
  InteractionResult,
  ValidatedExecutionCommand,
  PrepareCommandResult,
} from './types';
import { validateTargetElement } from './validator';
import { evaluateInteractionPolicy, isBlockedAction } from './policy';
import { highlightElement, clearHighlight } from '../content/highlighter';

// Private capability token registry for one-shot, pipeline-validated execution commands
const ACTIVE_EXECUTION_TOKENS = new Set<string>();

export function createDomEvent(doc: Document, type: string, bubbles = true): Event {
  const win = doc.defaultView;
  if (win && (win as unknown as { Event?: typeof Event }).Event) {
    try {
      return new (win as unknown as { Event: typeof Event }).Event(type, { bubbles });
    } catch {
      // fallback
    }
  }
  if (typeof doc.createEvent === 'function') {
    try {
      const evt = doc.createEvent('Event');
      evt.initEvent(type, bubbles, true);
      return evt;
    } catch {
      // fallback
    }
  }
  return new Event(type, { bubbles });
}

/**
 * Prepares and seals a validated execution command from an untrusted interaction intent.
 * Only intents that pass syntax, target, policy, and value-provenance checks obtain a valid command token.
 */
export function prepareExecutionCommand(
  intent: InteractionIntent,
  doc: Document = document,
  options?: { confirmed?: boolean }
): PrepareCommandResult {
  // 1. Target Validation
  const targetCheck = validateTargetElement(
    intent.targetElementId,
    intent.actionType,
    doc,
    intent.optionValue
  );

  if (!targetCheck.valid || !targetCheck.element) {
    return {
      valid: false,
      errorStatus: targetCheck.errorStatus || 'TARGET_INVALID',
      message: targetCheck.message || 'Target validation failed.',
    };
  }

  const el = targetCheck.element;

  // 2. Policy Evaluation
  const policy = evaluateInteractionPolicy(intent, el);
  if (!policy.allowed) {
    return {
      valid: false,
      errorStatus: 'BLOCKED',
      blockedReason: policy.blockedReason,
      message: policy.blockedReason || 'Interaction blocked by safety policy.',
    };
  }

  // 3. Generate one-shot execution capability token
  const commandToken = `cmd_tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  ACTIVE_EXECUTION_TOKENS.add(commandToken);

  const command: ValidatedExecutionCommand = {
    commandToken,
    actionId: intent.actionId,
    actionType: intent.actionType,
    targetElementId: intent.targetElementId,
    targetElement: el,
    value: intent.value,
    valueSource: intent.valueSource,
    optionValue: intent.optionValue,
    checked: intent.checked,
    reason: intent.reason,
    riskLevel: policy.riskLevel,
    requiresConfirmation: policy.requiresConfirmation,
    confirmed: !!options?.confirmed,
    timestamp: Date.now(),
  };

  return {
    valid: true,
    command,
  };
}

/**
 * Low-level atomic DOM interaction executor.
 * STRICT EXECUTION BOUNDARY:
 * Accepts ONLY a ValidatedExecutionCommand created by prepareExecutionCommand.
 * Rejects arbitrary intent objects, unconfirmed mutating commands, blocked actions, and stale targets.
 */
export async function executeValidatedCommand(
  command: ValidatedExecutionCommand,
  doc: Document = document
): Promise<InteractionResult> {
  const timestamp = Date.now();

  // 1. Enforce Execution Boundary: Verify capability token
  if (
    !command ||
    typeof command !== 'object' ||
    !command.commandToken ||
    !ACTIVE_EXECUTION_TOKENS.has(command.commandToken)
  ) {
    return {
      actionId: command?.actionId || 'unvalidated',
      status: 'NOT_ALLOWED',
      actionType: command?.actionType || ('FOCUS' as ActionType),
      targetElementId: command?.targetElementId || 'unknown',
      message:
        'Execution rejected: command was not produced by the validation pipeline. Direct unvalidated execution is strictly forbidden.',
      changed: false,
      timestamp,
    };
  }

  // One-shot token consumption (prevents replay / autonomous loops)
  ACTIVE_EXECUTION_TOKENS.delete(command.commandToken);

  // 2. Verify Blocked Actions
  if (isBlockedAction(command.actionType)) {
    return {
      actionId: command.actionId,
      status: 'BLOCKED',
      actionType: command.actionType,
      targetElementId: command.targetElementId,
      message: `Action '${command.actionType}' is strictly blocked in Phase 8.`,
      changed: false,
      blockedReason: `Action '${command.actionType}' is blocked.`,
      timestamp,
    };
  }

  // 3. Confirmation Enforcement: Mutating actions cannot execute unconfirmed
  if (command.requiresConfirmation && !command.confirmed) {
    return {
      actionId: command.actionId,
      status: 'BLOCKED',
      actionType: command.actionType,
      targetElementId: command.targetElementId,
      message: 'Mutating command cannot execute without explicit user confirmation.',
      changed: false,
      requiresConfirmation: true,
      timestamp,
    };
  }

  // 4. Stale Target & Detached DOM Check
  if (!command.targetElement || !doc.contains(command.targetElement)) {
    return {
      actionId: command.actionId,
      status: 'TARGET_NOT_FOUND',
      actionType: command.actionType,
      targetElementId: command.targetElementId,
      message: `Element '${command.targetElementId}' became detached or stale before execution.`,
      changed: false,
      timestamp,
    };
  }

  // 5. Value Provenance Enforcement for TYPE
  if (command.actionType === 'TYPE') {
    if (command.valueSource !== 'USER_EXPLICIT') {
      return {
        actionId: command.actionId,
        status: 'BLOCKED',
        actionType: command.actionType,
        targetElementId: command.targetElementId,
        message: 'TYPE command rejected: mutating value lacks verified USER_EXPLICIT provenance.',
        changed: false,
        blockedReason: 'AI-generated or unverified values cannot be typed into DOM elements.',
        timestamp,
      };
    }
  }

  const el = command.targetElement;

  // 6. Dedicated Allowlisted Execution Handlers
  try {
    switch (command.actionType) {
      case 'FOCUS': {
        if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        el.focus();
        return {
          actionId: command.actionId,
          status: 'SUCCESS',
          actionType: command.actionType,
          targetElementId: command.targetElementId,
          message: `Focused on element '#${command.targetElementId}'.`,
          changed: false,
          requiresConfirmation: false,
          timestamp,
        };
      }

      case 'HIGHLIGHT': {
        const highlightResult = highlightElement(command.targetElementId, doc);
        return {
          actionId: command.actionId,
          status: highlightResult.success ? 'SUCCESS' : 'TARGET_NOT_FOUND',
          actionType: command.actionType,
          targetElementId: command.targetElementId,
          message: highlightResult.success
            ? `Highlighted element '#${command.targetElementId}'.`
            : highlightResult.error || 'Failed to highlight element.',
          changed: false,
          requiresConfirmation: false,
          timestamp,
        };
      }

      case 'CLEAR_HIGHLIGHT': {
        clearHighlight(doc);
        return {
          actionId: command.actionId,
          status: 'SUCCESS',
          actionType: command.actionType,
          targetElementId: command.targetElementId,
          message: 'Cleared highlights.',
          changed: false,
          requiresConfirmation: false,
          timestamp,
        };
      }

      case 'TYPE': {
        if (command.value === undefined || command.value === null) {
          return {
            actionId: command.actionId,
            status: 'REJECTED',
            actionType: command.actionType,
            targetElementId: command.targetElementId,
            message: 'No value provided for TYPE action.',
            changed: false,
            timestamp,
          };
        }

        const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
        if (typeof inputEl.focus === 'function') {
          inputEl.focus();
        }

        inputEl.value = command.value;

        // Framework resilience: invoke prototype setter if present (React/Angular/Vue internal tracker)
        try {
          const proto = inputEl instanceof HTMLTextAreaElement 
            ? (doc.defaultView?.HTMLTextAreaElement?.prototype || HTMLTextAreaElement.prototype) 
            : (doc.defaultView?.HTMLInputElement?.prototype || HTMLInputElement.prototype);
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
          if (descriptor && descriptor.set) {
            descriptor.set.call(inputEl, command.value);
          }
        } catch {
          // graceful fallback
        }

        // Dispatch standard synthetic input and change events for framework binding
        const inputEvent = createDomEvent(doc, 'input', true);
        const changeEvent = createDomEvent(doc, 'change', true);
        inputEl.dispatchEvent(inputEvent);
        inputEl.dispatchEvent(changeEvent);

        // 7. Independent Result Verification (handling inputs with maxLength or pattern formatting)
        const maxLen = (inputEl as HTMLInputElement).maxLength;
        const expectedVal = (maxLen && maxLen > 0 && command.value.length > maxLen)
          ? command.value.substring(0, maxLen)
          : command.value;

        const verified = inputEl.value === expectedVal || inputEl.value === command.value;
        if (!verified) {
          return {
            actionId: command.actionId,
            status: 'ERROR',
            actionType: command.actionType,
            targetElementId: command.targetElementId,
            message: `Verification failed: expected value '${expectedVal}', but found '${inputEl.value}'.`,
            changed: inputEl.value.length > 0,
            timestamp,
          };
        }

        return {
          actionId: command.actionId,
          status: 'SUCCESS',
          actionType: command.actionType,
          targetElementId: command.targetElementId,
          message: `Successfully populated '#${command.targetElementId}'.`,
          changed: true,
          requiresConfirmation: true,
          timestamp,
        };
      }

      case 'SELECT_OPTION': {
        const selectEl = el as HTMLSelectElement;
        const requested = command.optionValue!;

        let matchedValue: string | null = null;
        for (let i = 0; i < selectEl.options.length; i++) {
          const opt = selectEl.options[i];
          if (opt.value === requested || opt.text.trim() === requested.trim()) {
            matchedValue = opt.value;
            selectEl.selectedIndex = i;
            selectEl.value = opt.value;
            break;
          }
        }

        if (matchedValue === null) {
          return {
            actionId: command.actionId,
            status: 'TARGET_INVALID',
            actionType: command.actionType,
            targetElementId: command.targetElementId,
            message: `Option '${requested}' not found in select element.`,
            changed: false,
            timestamp,
          };
        }

        // Dispatch change and input events
        selectEl.dispatchEvent(createDomEvent(doc, 'change'));
        selectEl.dispatchEvent(createDomEvent(doc, 'input'));

        // 7. Independent Result Verification
        const verified = selectEl.value === matchedValue;
        if (!verified) {
          return {
            actionId: command.actionId,
            status: 'ERROR',
            actionType: command.actionType,
            targetElementId: command.targetElementId,
            message: `Verification failed: selected option does not match '${matchedValue}'.`,
            changed: false,
            timestamp,
          };
        }

        return {
          actionId: command.actionId,
          status: 'SUCCESS',
          actionType: command.actionType,
          targetElementId: command.targetElementId,
          message: `Successfully selected option '${matchedValue}' in '#${command.targetElementId}'.`,
          changed: true,
          requiresConfirmation: true,
          timestamp,
        };
      }

      case 'TOGGLE_CHECKBOX': {
        const checkboxEl = el as HTMLInputElement;
        const targetState = !!command.checked;

        checkboxEl.checked = targetState;
        checkboxEl.dispatchEvent(createDomEvent(doc, 'change'));
        checkboxEl.dispatchEvent(createDomEvent(doc, 'input'));

        // 7. Independent Result Verification
        const verified = checkboxEl.checked === targetState;
        if (!verified) {
          return {
            actionId: command.actionId,
            status: 'ERROR',
            actionType: command.actionType,
            targetElementId: command.targetElementId,
            message: `Verification failed: checkbox state is not ${targetState}.`,
            changed: false,
            timestamp,
          };
        }

        return {
          actionId: command.actionId,
          status: 'SUCCESS',
          actionType: command.actionType,
          targetElementId: command.targetElementId,
          message: `Successfully set checkbox '#${command.targetElementId}' to ${targetState}.`,
          changed: true,
          requiresConfirmation: true,
          timestamp,
        };
      }

      default:
        return {
          actionId: command.actionId,
          status: 'NOT_ALLOWED',
          actionType: command.actionType,
          targetElementId: command.targetElementId,
          message: `Action type '${command.actionType}' is not allowed for execution.`,
          changed: false,
          timestamp,
        };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      actionId: command.actionId,
      status: 'ERROR',
      actionType: command.actionType,
      targetElementId: command.targetElementId,
      message: `Execution failed with error: ${errorMsg}`,
      changed: false,
      timestamp,
    };
  }
}

/**
 * Public high-level interaction dispatch pipeline.
 * Runs validation -> policy -> prepares sealed command -> executes only if valid.
 */
export async function executeInteraction(
  intent: InteractionIntent,
  doc: Document = document,
  options?: { confirmed?: boolean }
): Promise<InteractionResult> {
  const prep = prepareExecutionCommand(intent, doc, options);
  if (!prep.valid || !prep.command) {
    return {
      actionId: intent.actionId,
      status: prep.errorStatus || 'TARGET_INVALID',
      actionType: intent.actionType,
      targetElementId: intent.targetElementId,
      message: prep.message || prep.blockedReason || 'Interaction failed validation.',
      changed: false,
      blockedReason: prep.blockedReason,
      requiresConfirmation: false,
      timestamp: Date.now(),
    };
  }

  return executeValidatedCommand(prep.command, doc);
}

