/**
 * ACCESSOS Dedicated Completion Checker Test Suite (Phase 12)
 * Tests COMP-01 through COMP-30 as strictly specified by roadmap.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import type { PageRepresentation, FieldInfo, ErrorInfo } from '../src/core/types/representation';
import {
  evaluateCompletion,
  evaluateStageSummaries,
  PORTAL_STAGES,
  type CompletionRequirement,
} from '../src/completion/index';
import { validateMessageEnvelope, MessageType } from '../src/core/messaging/index';
import { highlightElement } from '../src/content/highlighter';
import { validateAiOutput, cleanForLogging, redactSensitiveCredentials, recordSecurityEvent } from '../src/security/index';

function createMockRepresentation(fields: Partial<FieldInfo>[] = [], errors: Partial<ErrorInfo>[] = []): PageRepresentation {
  const fullFields: FieldInfo[] = fields.map((f, i) => ({
    id: f.id || `field_${i}`,
    tag: f.tag || 'input',
    type: f.type || 'text',
    name: f.name || f.id || `field_${i}`,
    label: f.label || `Field ${i}`,
    labelSource: 'explicit-label',
    required: f.required ?? true,
    disabled: false,
    readonly: false,
    hasValue: f.hasValue ?? false,
    sensitive: f.sensitive ?? false,
    order: i,
    sectionId: f.sectionId || 'sec-applicant',
    ...f,
  }));

  const fullErrors: ErrorInfo[] = errors.map((e, i) => ({
    id: e.id || `err_${i}`,
    fieldId: e.fieldId,
    text: e.text || 'Validation error',
    source: 'error-class',
    ...e,
  }));

  return {
    page: { title: 'Test Portal', url: 'https://example.com/apply', hostname: 'example.com', pathname: '/apply' },
    headings: [],
    sections: [],
    fields: fullFields,
    buttons: [],
    links: [],
    instructions: [],
    errors: fullErrors,
    accessibilitySignals: {
      missingLabels: [],
      missingAltImages: [],
      buttonsWithoutAccessibleName: [],
      linksWithoutAccessibleName: [],
      ariaInvalidFields: [],
      headingHierarchyAnomalies: [],
      emptyInteractiveElements: [],
      hasMainLandmark: true,
      keyboardFocusabilityIssues: [],
      totalSignalsCount: 0,
    },
    metrics: {
      headingCount: 0,
      sectionCount: 1,
      fieldCount: fullFields.length,
      requiredFieldCount: fullFields.filter((f) => f.required).length,
      buttonCount: 0,
      linkCount: 0,
      instructionCount: 0,
      errorCount: fullErrors.length,
      imageCount: 0,
      missingLabelCount: 0,
      missingAccessibleNameCount: 0,
      formComplexity: {
        fieldCount: fullFields.length,
        requiredFieldCount: fullFields.filter((f) => f.required).length,
        sectionCount: 1,
        conditionalSectionsCount: 0,
        fileUploadCount: 0,
      },
    },
    extractedAt: Date.now(),
  };
}

describe('Phase 12 Completion Checker Test Suite (COMP-01 to COMP-30)', () => {
  let doc: Document;

  beforeEach(() => {
    const win = new Window({ url: 'http://localhost/scholarship' });
    doc = win.document as unknown as Document;
  });

  // COMP-01: All required fields populated -> COMPLETE
  it('COMP-01: All required fields populated marks application COMPLETE', () => {
    const rep = createMockRepresentation([
      { id: 'f1', name: 'applicant_name', label: 'Full Name', required: true },
      { id: 'f2', name: 'email', label: 'Email Address', required: true },
    ]);
    const formValues = { applicant_name: 'Ananya Sharma', email: 'ananya@example.com' };
    const result = evaluateCompletion(rep, formValues);

    expect(result.overallStatus).toBe('COMPLETE');
    expect(result.completionPercent).toBe(100);
    expect(result.blockingIssues.length).toBe(0);
  });

  // COMP-02: One required field missing -> INCOMPLETE
  it('COMP-02: One required field missing marks workflow INCOMPLETE and identifies exact field', () => {
    const rep = createMockRepresentation([
      { id: 'f1', name: 'applicant_name', label: 'Full Name', required: true },
      { id: 'f2', name: 'dob', label: 'Date of Birth', required: true },
    ]);
    const formValues = { applicant_name: 'Ananya Sharma' }; // missing dob
    const result = evaluateCompletion(rep, formValues);

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.blockingIssues.length).toBe(1);
    expect(result.blockingIssues[0].targetElementId).toBe('f2');
    expect(result.blockingIssues[0].title).toBe('Date of Birth');
    expect(result.blockingIssues[0].isBlocking).toBe(true);
  });

  // COMP-03: Multiple required fields missing -> all blocking requirements reported
  it('COMP-03: Multiple required fields missing reports all blocking requirements', () => {
    const rep = createMockRepresentation([
      { id: 'f1', name: 'f1', label: 'Field 1', required: true },
      { id: 'f2', name: 'f2', label: 'Field 2', required: true },
      { id: 'f3', name: 'f3', label: 'Field 3', required: true },
    ]);
    const result = evaluateCompletion(rep, {});

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.blockingIssues.length).toBe(3);
    const ids = result.blockingIssues.map((b) => b.targetElementId);
    expect(ids).toEqual(['f1', 'f2', 'f3']);
  });

  // COMP-04: Optional field missing -> does not block completion
  it('COMP-04: Optional field missing does not block completion', () => {
    const rep = createMockRepresentation([
      { id: 'f1', name: 'f1', label: 'Required Field', required: true },
      { id: 'f2', name: 'f2', label: 'Optional Notes', required: false },
    ]);
    const formValues = { f1: 'Provided Value' }; // f2 is missing
    const result = evaluateCompletion(rep, formValues);

    expect(result.overallStatus).toBe('COMPLETE');
    expect(result.blockingIssues.length).toBe(0);
    expect(result.completionPercent).toBe(50); // 1 of 2 populated
  });

  // COMP-05: Existing validation error -> completion blocked
  it('COMP-05: Existing validation error blocks completion with INVALID status', () => {
    const rep = createMockRepresentation(
      [{ id: 'field_email', name: 'email', label: 'Email', required: true }],
      [{ id: 'err1', fieldId: 'field_email', text: 'Invalid email format' }]
    );
    const formValues = { email: 'not-an-email' };
    const result = evaluateCompletion(rep, formValues);

    expect(result.overallStatus).toBe('INVALID');
    expect(result.blockingIssues.length).toBe(1);
    expect(result.blockingIssues[0].status).toBe('INVALID');
    expect(result.blockingIssues[0].reason).toContain('Invalid email format');
  });

  // COMP-06: Sensitive field missing -> state reported without exposing value
  it('COMP-06: Sensitive field missing reports safe state metadata without value leakage', () => {
    const rep = createMockRepresentation([
      { id: 'bank_pin', name: 'bank_pin', label: 'Security PIN', required: true, sensitive: true },
    ]);
    const result = evaluateCompletion(rep, {});

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.blockingIssues[0].sensitive).toBe(true);
    expect(result.blockingIssues[0].reason).toContain("Required field 'Security PIN' is missing");
  });

  // COMP-07: Sensitive field populated -> value never appears in completion output
  it('COMP-07: Sensitive field populated verifies value NEVER appears in completion output', () => {
    const secretPin = '987654321';
    const rep = createMockRepresentation([
      { id: 'secret_key', name: 'secret_key', label: 'Secret Key', required: true, sensitive: true },
    ]);
    const formValues = { secret_key: secretPin };
    const result = evaluateCompletion(rep, formValues);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secretPin);
    expect(result.overallStatus).toBe('COMPLETE');
    expect(result.completedRequirements[0].sensitive).toBe(true);
  });

  // COMP-08: Required document MATCH -> requirement satisfied
  it('COMP-08: Required document MATCH satisfies requirement', () => {
    const rep = createMockRepresentation([]);
    const docMatches = [
      {
        requirementId: 'doc_income',
        documentType: 'INCOME_CERTIFICATE',
        title: 'Income Certificate',
        matchStatus: 'MATCH',
        confidence: 0.95,
        evidence: 'Annual family income certified at Rs. 1,50,000.',
      },
    ];
    const result = evaluateCompletion(rep, {}, docMatches);

    expect(result.overallStatus).toBe('COMPLETE');
    expect(result.documentRequirements[0].isSatisfied).toBe(true);
    expect(result.documentRequirements[0].isBlocking).toBe(false);
  });

  // COMP-09: Required document PARTIAL_MATCH -> requirement not fully satisfied
  it('COMP-09: Required document PARTIAL_MATCH leaves requirement unsatisfied and blocks completion', () => {
    const rep = createMockRepresentation([]);
    const docMatches = [
      {
        requirementId: 'doc_domicile',
        documentType: 'DOMICILE_CERTIFICATE',
        title: 'Domicile Certificate',
        matchStatus: 'PARTIAL_MATCH',
        confidence: 0.65,
      },
    ];
    const result = evaluateCompletion(rep, {}, docMatches);

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.documentRequirements[0].isSatisfied).toBe(false);
    expect(result.documentRequirements[0].isBlocking).toBe(true);
  });

  // COMP-10: Required document NO_MATCH -> requirement blocked
  it('COMP-10: Required document NO_MATCH marks requirement BLOCKED', () => {
    const rep = createMockRepresentation([]);
    const docMatches = [
      {
        requirementId: 'doc_id',
        documentType: 'IDENTITY_DOCUMENT',
        title: 'Aadhaar Card',
        matchStatus: 'NO_MATCH',
      },
    ];
    const result = evaluateCompletion(rep, {}, docMatches);

    expect(result.overallStatus).toBe('BLOCKED');
    expect(result.documentRequirements[0].isSatisfied).toBe(false);
  });

  // COMP-11: Required document AMBIGUOUS -> requirement blocked / needs review
  it('COMP-11: Required document AMBIGUOUS marks requirement BLOCKED and instructs review', () => {
    const rep = createMockRepresentation([]);
    const docMatches = [
      {
        requirementId: 'doc_marks',
        documentType: 'ACADEMIC_MARKSHEET',
        title: 'Class 12 Marksheet',
        matchStatus: 'AMBIGUOUS',
        reason: 'Multiple student names found on sheet',
      },
    ];
    const result = evaluateCompletion(rep, {}, docMatches);

    expect(result.overallStatus).toBe('BLOCKED');
    expect(result.documentRequirements[0].suggestedNextStep).toContain('Review ambiguous evidence');
  });

  // COMP-12: NOT_ENOUGH_EVIDENCE -> not treated as satisfied
  it('COMP-12: NOT_ENOUGH_EVIDENCE is not treated as satisfied', () => {
    const rep = createMockRepresentation([]);
    const docMatches = [
      {
        requirementId: 'doc_bank',
        documentType: 'BANK_DOCUMENT',
        title: 'Bank Passbook Copy',
        matchStatus: 'NOT_ENOUGH_EVIDENCE',
      },
    ];
    const result = evaluateCompletion(rep, {}, docMatches);

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.documentRequirements[0].isSatisfied).toBe(false);
  });

  // COMP-13: Filename alone cannot satisfy document requirement
  it('COMP-13: Filename alone cannot satisfy document requirement even if status is MATCH', () => {
    const rep = createMockRepresentation([]);
    const docMatches = [
      {
        requirementId: 'doc_fake',
        documentType: 'INCOME_CERTIFICATE',
        title: 'Income Certificate',
        matchStatus: 'MATCH',
        filenameOnlyMatch: true, // Untrusted filename-only match
      },
    ];
    const result = evaluateCompletion(rep, {}, docMatches);

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.documentRequirements[0].isSatisfied).toBe(false);
    expect(result.documentRequirements[0].reason).toContain('Insufficient evidence');
  });

  // COMP-14: Cross-field inconsistency detected
  it('COMP-14: Cross-field inconsistency detected deterministically', () => {
    const rep = createMockRepresentation([
      { id: 'f_dom', name: 'personal_domicile_state', label: 'Domicile State', required: true },
      { id: 'f_addr', name: 'address_state', label: 'Address State', required: true },
    ]);
    const formValues = {
      personal_domicile_state: 'Maharashtra',
      address_state: 'Karnataka',
    };
    const result = evaluateCompletion(rep, formValues);

    const inconsistency = result.consistencyChecks.find((c) => c.status === 'INCONSISTENT');
    expect(inconsistency).toBeDefined();
    expect(inconsistency?.ruleId).toBe('CONSISTENCY_DOMICILE_ADDRESS');
  });

  // COMP-15: Insufficient evidence does not become an inconsistency claim
  it('COMP-15: Insufficient evidence does not become a fraudulent inconsistency claim', () => {
    const rep = createMockRepresentation([
      { id: 'f_dom', name: 'personal_domicile_state', label: 'Domicile State', required: true },
      { id: 'f_addr', name: 'address_state', label: 'Address State', required: true },
    ]);
    const formValues = { personal_domicile_state: 'Maharashtra' }; // address_state empty
    const result = evaluateCompletion(rep, formValues);

    const check = result.consistencyChecks.find((c) => c.ruleId === 'CONSISTENCY_DOMICILE_ADDRESS');
    expect(check?.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.warnings.some((w) => w.id === 'req-cons-CONSISTENCY_DOMICILE_ADDRESS')).toBe(false);
  });

  // COMP-16: Completed stage correctly marked COMPLETE
  it('COMP-16: Completed stage correctly marked COMPLETE', () => {
    const reqs: CompletionRequirement[] = [
      {
        id: 'r1',
        type: 'REQUIRED_FIELD',
        title: 'Applicant Name',
        description: 'Desc',
        status: 'COMPLETE',
        severity: 'INFO',
        stageId: 'sec-applicant',
        reason: 'Populated',
        suggestedNextStep: 'Done',
        isBlocking: false,
      },
    ];
    const summaries = evaluateStageSummaries(reqs, PORTAL_STAGES);
    const applicantStage = summaries.find((s) => s.stageId === 'sec-applicant');
    expect(applicantStage?.status).toBe('COMPLETE');
    expect(applicantStage?.completedRequirements).toBe(1);
    expect(applicantStage?.totalRequirements).toBe(1);
  });

  // COMP-17: Incomplete stage correctly marked INCOMPLETE
  it('COMP-17: Incomplete stage correctly marked INCOMPLETE', () => {
    const reqs: CompletionRequirement[] = [
      {
        id: 'r1',
        type: 'REQUIRED_FIELD',
        title: 'Domicile Doc',
        description: 'Desc',
        status: 'INCOMPLETE',
        severity: 'BLOCKING',
        stageId: 'sec-personal',
        reason: 'Missing',
        suggestedNextStep: 'Provide',
        isBlocking: true,
      },
    ];
    const summaries = evaluateStageSummaries(reqs, PORTAL_STAGES);
    const personalStage = summaries.find((s) => s.stageId === 'sec-personal');
    expect(personalStage?.status).toBe('INCOMPLETE');
    expect(personalStage?.blockingIssuesCount).toBe(1);
  });

  // COMP-18: Overall completion is blocked by unresolved blocking requirement
  it('COMP-18: Overall completion is blocked by unresolved blocking requirement', () => {
    const rep = createMockRepresentation([
      { id: 'f1', name: 'f1', label: 'F1', required: true },
      { id: 'f2', name: 'f2', label: 'F2', required: true },
    ]);
    const formValues = { f1: 'Val' }; // f2 missing
    const result = evaluateCompletion(rep, formValues);

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.completionPercent).toBe(50);
  });

  // COMP-19: Non-blocking warning does not incorrectly mark workflow incomplete
  it('COMP-19: Non-blocking warning does not incorrectly mark workflow incomplete', () => {
    const rep = createMockRepresentation([
      { id: 'f_dom', name: 'personal_domicile_state', label: 'Domicile State', required: true },
      { id: 'f_addr', name: 'address_state', label: 'Address State', required: true },
    ]);
    const formValues = {
      personal_domicile_state: 'Maharashtra',
      address_state: 'Karnataka', // Triggers non-blocking warning
    };
    const result = evaluateCompletion(rep, formValues);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBe(0);
    expect(result.overallStatus).toBe('COMPLETE');
  });

  // COMP-20: Completion checker cannot mutate DOM values
  it('COMP-20: Completion checker evaluation is strictly non-mutating on DOM inputs', () => {
    const input = doc.createElement('input');
    input.id = 'applicant_name';
    input.value = 'Original User Value';
    doc.body.appendChild(input);

    const rep = createMockRepresentation([
      { id: 'applicant_name', name: 'applicant_name', label: 'Name', required: true },
    ]);
    evaluateCompletion(rep, { applicant_name: 'Evaluated' });

    expect(input.value).toBe('Original User Value');
  });

  // COMP-21: Completion checker cannot click controls
  it('COMP-21: Completion checker cannot trigger automated click events', () => {
    let clicked = false;
    const btn = doc.createElement('button');
    btn.id = 'submit-btn';
    btn.onclick = () => { clicked = true; };
    doc.body.appendChild(btn);

    const rep = createMockRepresentation([]);
    evaluateCompletion(rep, {});

    expect(clicked).toBe(false);
  });

  // COMP-22: Completion checker cannot submit form
  it('COMP-22: Completion checker cannot trigger form submission', () => {
    let submitted = false;
    const form = doc.createElement('form');
    form.onsubmit = (e) => {
      e.preventDefault();
      submitted = true;
    };
    doc.body.appendChild(form);

    const rep = createMockRepresentation([]);
    evaluateCompletion(rep, {});

    expect(submitted).toBe(false);
  });

  // COMP-23: Completion checker cannot upload documents
  it('COMP-23: Completion checker cannot automatically upload files to input[type=file]', () => {
    const fileInput = doc.createElement('input');
    fileInput.type = 'file';
    doc.body.appendChild(fileInput);

    const rep = createMockRepresentation([]);
    evaluateCompletion(rep, {}, [{ requirementId: 'r1', matchStatus: 'MATCH' }]);

    expect(fileInput.files?.length || 0).toBe(0);
  });

  // COMP-24: Completion checker cannot create Phase 8 execution capability
  it('COMP-24: Completion checker contains zero execution tokens or Phase 8 capability generation', () => {
    const rep = createMockRepresentation([]);
    const result = evaluateCompletion(rep, {});

    const record = result as unknown as Record<string, unknown>;
    expect(record['capabilityToken']).toBeUndefined();
    expect(record['executionToken']).toBeUndefined();
    expect(record['executeIntent']).toBeUndefined();
  });

  // COMP-25: Completion checker cannot forge USER_EXPLICIT provenance
  it('COMP-25: Completion checker output never generates USER_EXPLICIT provenance tokens', () => {
    const rep = createMockRepresentation([]);
    const result = evaluateCompletion(rep, {});

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('USER_EXPLICIT');
  });

  // COMP-26: Arbitrary CSS selectors/XPath are rejected
  it('COMP-26: Arbitrary CSS selectors and XPath strings fail safely in highlighting', () => {
    const maliciousSelectors = [
      'div > span:nth-child(2)',
      '//input[@name="password"]',
      'body input[type="text"]',
      '<script>alert(1)</script>',
    ];

    maliciousSelectors.forEach((sel) => {
      const res = highlightElement(sel, doc);
      expect(res.found).toBe(false);
      expect(res.success).toBe(false);
    });
  });

  // COMP-27: Missing/stale target IDs fail safely
  it('COMP-27: Stale or nonexistent target IDs fail safely without DOM mutation or errors', () => {
    const res = highlightElement('nonexistent_target_id_999', doc);
    expect(res.found).toBe(false);
    expect(res.success).toBe(false);
    expect(res.error).toContain('could not be located');
  });

  // COMP-28: Sensitive completion information is absent from logs
  it('COMP-28: Sensitive form credentials and tokens are redacted before logging', () => {
    const sensitiveStr = 'API token: sk_live_123456789012345678, Card: 4111 1111 1111 1111, CVV: 123, SSN: 123-45-6789';
    const redacted = redactSensitiveCredentials(sensitiveStr);

    expect(redacted).not.toContain('sk_live_123456789012345678');
    expect(redacted).not.toContain('4111 1111 1111 1111');
    expect(redacted).not.toContain('123-45-6789');
    expect(redacted).toContain('[REDACTED_TOKEN]');
    expect(redacted).toContain('[REDACTED_CARD]');
    expect(redacted).toContain('[REDACTED_CVV]');
    expect(redacted).toContain('[REDACTED_GOV_ID]');

    // Audit event logging also omits raw parameters
    const auditEvent = recordSecurityEvent('COMPLETION_EVALUATION', 'COMPLETION', true, 'Evaluated safely');
    const cleaned = cleanForLogging(auditEvent);
    expect(cleaned).toHaveProperty('reasonCategory');
    expect(JSON.stringify(cleaned)).not.toContain('sk_live_');
  });

  // COMP-29: Completion output containing malicious/untrusted content is sanitized
  it('COMP-29: Untrusted content in AI explanations is validated against executable scripts', () => {
    const maliciousAiOutput = {
      summary: 'Status check <script>stealCookies()</script>',
      nextStep: 'Click here',
    };
    const validation = validateAiOutput(maliciousAiOutput);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('script');
  });

  // COMP-30: Malformed completion payload fails closed
  it('COMP-30: Malformed message payload fails closed via message envelope validator', () => {
    const malformedPayloads = [
      null,
      undefined,
      'string instead of object',
      { type: 'UNKNOWN_MESSAGE_TYPE' },
      { type: MessageType.CHECK_COMPLETION, script: '<script>alert(1)</script>' },
    ];

    malformedPayloads.forEach((payload) => {
      const res = validateMessageEnvelope(payload);
      expect(res.valid).toBe(false);
    });
  });
});
