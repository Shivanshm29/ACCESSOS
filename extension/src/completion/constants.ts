/**
 * ACCESSOS Completion Checker Constants (Phase 12)
 *
 * Defines workflow stages for the National Student Scholarship Portal
 * and bounded parameters for deterministic evaluation.
 */

import type { PortalStageDefinition } from './types';

export const PORTAL_STAGES: PortalStageDefinition[] = [
  {
    index: 0,
    id: 'sec-applicant',
    name: 'Applicant Identification & Basic Details',
    step: 1,
  },
  {
    index: 1,
    id: 'sec-personal',
    name: 'Personal Details & Identity',
    step: 2,
  },
  {
    index: 2,
    id: 'sec-academic',
    name: 'Academic Enrollment & Institutional Details',
    step: 3,
  },
  {
    index: 3,
    id: 'sec-family',
    name: 'Family Background & Income Appraisal',
    step: 4,
  },
  {
    index: 4,
    id: 'sec-address',
    name: 'Residential & Communication Address',
    step: 5,
  },
  {
    index: 5,
    id: 'sec-bank',
    name: 'Direct Benefit Transfer (DBT) Bank Account',
    step: 6,
  },
  {
    index: 6,
    id: 'sec-documents',
    name: 'Supporting Documents Upload & Verification',
    step: 7,
  },
  {
    index: 7,
    id: 'sec-declaration',
    name: 'Statutory Declaration & Application Finalization',
    step: 8,
  },
];

export const MAX_COMPLETION_ISSUES_SHOWN = 50;
export const MAX_EVIDENCE_LENGTH = 300;
