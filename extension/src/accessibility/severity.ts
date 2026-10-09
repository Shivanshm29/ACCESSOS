/**
 * ACCESSOS Accessibility Severity Model
 * Deterministic rule-level severities, penalty weights, and architectural rationales.
 */
import type { AccessibilitySeverity } from './types';

export const SEVERITY_WEIGHTS: Readonly<Record<AccessibilitySeverity, number>> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
  INFO: 0,
};

export interface SeverityRationale {
  severity: AccessibilitySeverity;
  weight: number;
  description: string;
  examples: string[];
}

export const SEVERITY_RATIONALES: Readonly<Record<AccessibilitySeverity, SeverityRationale>> = {
  CRITICAL: {
    severity: 'CRITICAL',
    weight: 20,
    description: 'Completely blocks task completion or interaction for users relying on assistive technology.',
    examples: ['Keyboard focus traps', 'Complete absence of interactive functionality'],
  },
  HIGH: {
    severity: 'HIGH',
    weight: 10,
    description: 'Severely impedes accessibility; causes ambiguity or invalid submissions without obvious recovery.',
    examples: [
      'Form fields without accessible names or labels',
      'Buttons without discernible names',
      'Duplicate DOM IDs breaking programmatic association',
    ],
  },
  MEDIUM: {
    severity: 'MEDIUM',
    weight: 5,
    description: 'Substantial usability or structural barrier; degrades navigation and perception.',
    examples: [
      'Informative images without alternative text',
      'Skipped heading hierarchy levels',
      'Missing main landmark',
      'Form controls in invalid state',
      'Validation error messages not programmatically associated',
    ],
  },
  LOW: {
    severity: 'LOW',
    weight: 2,
    description: 'Minor friction, visual detachment, or cognitive load increase.',
    examples: [
      'File upload constraints detached from inputs',
      'Required fields without visible or explanatory indication',
    ],
  },
  INFO: {
    severity: 'INFO',
    weight: 0,
    description: 'Informational observation or best practice recommendation with no penalty.',
    examples: ['Advisory recommendations'],
  },
};

export function getSeverityWeight(severity: AccessibilitySeverity): number {
  return SEVERITY_WEIGHTS[severity] ?? 0;
}
