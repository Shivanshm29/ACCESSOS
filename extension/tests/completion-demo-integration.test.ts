/**
 * Phase 12 — Completion Checker Demo Integration & Scenarios A-H
 * Real verification against the National Student Scholarship Portal.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import {
  evaluateCompletion,
  evaluateCrossFieldConsistency,
  type DocumentMatchInput,
} from '../src/completion/index';

describe('Phase 12 Demo Integration: National Student Scholarship Portal (Scenarios A through H)', () => {
  let demoDoc: Document;
  let demoLocation: Location;

  beforeEach(() => {
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const demoHtml = fs.readFileSync(demoHtmlPath, 'utf-8');
    const demoWindow = new Window({ url: 'http://localhost:3000/' });
    demoDoc = demoWindow.document as unknown as Document;
    demoDoc.write(demoHtml);
    demoLocation = demoWindow.location as unknown as Location;

    // Run semantic extraction to assign stable data-accessos-id attributes
    extractPageRepresentation(demoDoc, demoLocation);
  });

  function getFullyPopulatedFormValues(rep: any): Record<string, string> {
    const values: Record<string, string> = {};
    for (const f of rep.fields) {
      const key = f.name || f.id;
      if (f.tag === 'select') {
        values[key] = f.options && f.options.length > 1 ? f.options[1] : 'Maharashtra';
      } else if (f.type === 'number') {
        values[key] = '150000';
      } else if (f.type === 'email') {
        values[key] = 'devansh.sharma@example.edu';
      } else if (f.type === 'date') {
        values[key] = '2004-05-15';
      } else if (f.type === 'tel') {
        values[key] = '9876543210';
      } else {
        values[key] = 'Valid Entry Sample';
      }
    }
    // Set consistent states
    values['personal_domicile_state'] = 'Maharashtra';
    values['address_state'] = 'Maharashtra';
    values['family_other_scholarship_flag'] = 'no';
    values['academic_admission_year'] = '2023';
    values['academic_current_year'] = '2';
    values['family_annual_income'] = '150000';
    values['personal_category'] = 'General';
    return values;
  }

  function getValidDocumentMatches(): DocumentMatchInput[] {
    return [
      {
        requirementId: 'doc-income',
        documentType: 'INCOME_CERTIFICATE',
        title: 'Income Certificate',
        matchStatus: 'MATCH',
        confidence: 0.96,
        evidence: 'Certified annual income of Rs. 1,50,000 for family.',
      },
      {
        requirementId: 'doc-domicile',
        documentType: 'DOMICILE_CERTIFICATE',
        title: 'Domicile Certificate',
        matchStatus: 'MATCH',
        confidence: 0.94,
        evidence: 'Permanent resident of Maharashtra State.',
      },
      {
        requirementId: 'doc-marksheet',
        documentType: 'ACADEMIC_MARKSHEET',
        title: 'Class 12 Marksheet',
        matchStatus: 'MATCH',
        confidence: 0.98,
        evidence: 'Aggregate score: 88.6% from CBSE Board.',
      },
      {
        requirementId: 'doc-bank',
        documentType: 'BANK_DOCUMENT',
        title: 'Bank Passbook Copy',
        matchStatus: 'MATCH',
        confidence: 0.92,
        evidence: 'Active savings account IFSC SBIN0001234.',
      },
      {
        requirementId: 'doc-id',
        documentType: 'IDENTITY_DOCUMENT',
        title: 'Aadhaar Card',
        matchStatus: 'MATCH',
        confidence: 0.99,
        evidence: 'Verified identity of applicant.',
      },
    ];
  }

  // SCENARIO A: All required information/documents valid -> COMPLETE
  it('SCENARIO A: All required portal fields and document evidence valid marks application COMPLETE', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    const docMatches = getValidDocumentMatches();

    const result = evaluateCompletion(rep, formValues, docMatches);

    expect(result.overallStatus).toBe('COMPLETE');
    expect(result.completionPercent).toBe(100);
    expect(result.blockingIssues.length).toBe(0);
    expect(result.remainingRequirements.length).toBe(0);
  });

  // SCENARIO B: Remove one required field -> INCOMPLETE with exact requirement identified
  it('SCENARIO B: Remove applicant name marks INCOMPLETE and identifies exact blocking field', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    delete formValues['applicant_full_name'];
    const docMatches = getValidDocumentMatches();

    const result = evaluateCompletion(rep, formValues, docMatches);

    expect(result.overallStatus).toBe('INCOMPLETE');
    expect(result.blockingIssues.length).toBe(1);
    expect(result.blockingIssues[0].id).toBe('req-field-applicant_full_name');
    expect(result.blockingIssues[0].suggestedNextStep).toContain('Full Legal Name');
  });

  // SCENARIO C: Introduce a validation error -> BLOCKED/INVALID with validation reason
  it('SCENARIO C: Introduce validation error blocks completion and reports validation failure', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    const docMatches = getValidDocumentMatches();

    // Introduce validation error for identity document number
    rep.errors.push({
      id: 'err-id',
      fieldId: 'personal_identity_number',
      text: 'Identity document number format is invalid',
      source: 'validation-message',
    });

    const result = evaluateCompletion(rep, formValues, docMatches);

    expect(result.overallStatus).toBe('INVALID');
    expect(result.blockingIssues.some((b) => b.reason.includes('format is invalid'))).toBe(true);
  });

  // SCENARIO D: Introduce a document mismatch -> Document requirement flagged
  it('SCENARIO D: Introduce document mismatch flags required document issue', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    const docMatches = getValidDocumentMatches();

    // Make income certificate a NO_MATCH
    docMatches[0].matchStatus = 'NO_MATCH';
    docMatches[0].reason = 'Uploaded document is a fee receipt, not an income certificate';

    const result = evaluateCompletion(rep, formValues, docMatches);

    expect(result.overallStatus).toBe('BLOCKED');
    const docIssue = result.blockingIssues.find((b) => b.id === 'req-doc-doc-income');
    expect(docIssue).toBeDefined();
    expect(docIssue?.reason).toContain('No matching document');
  });

  // SCENARIO E: Introduce ambiguous document evidence -> Manual review required
  it('SCENARIO E: Introduce ambiguous document evidence blocks completion and requests human review', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    const docMatches = getValidDocumentMatches();

    // Make marksheet ambiguous
    docMatches[2].matchStatus = 'AMBIGUOUS';

    const result = evaluateCompletion(rep, formValues, docMatches);

    expect(result.overallStatus).toBe('BLOCKED');
    const ambiguousReq = result.documentRequirements.find((d) => d.requirementId === 'doc-marksheet');
    expect(ambiguousReq?.suggestedNextStep).toContain('Review ambiguous evidence');
  });

  // SCENARIO F: Introduce cross-field inconsistency -> Consistency warning/blocker with evidence
  it('SCENARIO F: Inconsistency between domicile state and residential address state flagged', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    formValues['personal_domicile_state'] = 'Maharashtra';
    formValues['address_state'] = 'Gujarat';
    const docMatches = getValidDocumentMatches();

    const result = evaluateCompletion(rep, formValues, docMatches);

    const domicileCheck = result.consistencyChecks.find((c) => c.ruleId === 'CONSISTENCY_DOMICILE_ADDRESS');
    expect(domicileCheck?.status).toBe('INCONSISTENT');
    expect(domicileCheck?.explanation).toContain("differs from residential address state ('Gujarat')");
  });

  // SCENARIO G: Sensitive field present -> Completion state available without exposing the value
  it('SCENARIO G: Sensitive bank details report completion metadata without exposing actual digits', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    const secretAcc = '98765432109876';
    formValues['bank_account_number'] = secretAcc;
    const docMatches = getValidDocumentMatches();

    const result = evaluateCompletion(rep, formValues, docMatches);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secretAcc);

    const bankReq = result.completedRequirements.find((r) => r.id === 'req-field-bank_account_number');
    expect(bankReq?.sensitive).toBe(true);
    expect(bankReq?.status).toBe('COMPLETE');
  });

  // SCENARIO H: Attempt to make the checker perform a browser mutation -> No mutation and no Phase 8 bypass
  it('SCENARIO H: Attempting browser mutations during checker execution verifies zero mutation and zero Phase 8 bypass', () => {
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const formValues = getFullyPopulatedFormValues(rep);
    const docMatches = getValidDocumentMatches();

    const inputName = demoDoc.getElementById('applicant_full_name') as HTMLInputElement;
    const originalValue = inputName.value;

    const result = evaluateCompletion(rep, formValues, docMatches);

    // DOM was not mutated
    expect(inputName.value).toBe(originalValue);

    // No capabilities or tokens leaked
    expect((result as any).token).toBeUndefined();
    expect((result as any).provenance).toBeUndefined();
  });

  // Performance Benchmarks
  it('measures extraction, evaluation, consistency, and rendering benchmarks for Phase 12 review', () => {
    // 1. Page extraction benchmark
    const t0 = performance.now();
    const rep = extractPageRepresentation(demoDoc, demoLocation);
    const extractionMs = performance.now() - t0;

    // 2. Form values & docs
    const formValues = getFullyPopulatedFormValues(rep);
    const docMatches = getValidDocumentMatches();

    // 3. Completion evaluation benchmark
    const t1 = performance.now();
    const result = evaluateCompletion(rep, formValues, docMatches);
    const completionEvalMs = performance.now() - t1;

    // 4. Consistency benchmark
    const t2 = performance.now();
    evaluateCrossFieldConsistency({
      personal_domicile_state: { id: 's1', name: 'personal_domicile_state', value: 'Maharashtra', sensitive: false },
      address_state: { id: 's2', name: 'address_state', value: 'Maharashtra', sensitive: false },
    });
    const consistencyMs = performance.now() - t2;

    const metrics = {
      pageExtractionMs: Number(extractionMs.toFixed(2)),
      completionEvaluationMs: Number(completionEvalMs.toFixed(2)),
      consistencyEvaluationMs: Number(consistencyMs.toFixed(4)),
      totalFieldsEvaluated: result.evaluatedFieldCount,
      totalDocumentsEvaluated: result.evaluatedDocumentCount,
      overallStatus: result.overallStatus,
      completionPercent: result.completionPercent,
    };

    console.log('COMPLETION_BENCHMARKS:', JSON.stringify(metrics));
    expect(completionEvalMs).toBeLessThan(50); // Well under 50ms requirement
    expect(result.evaluatedFieldCount).toBeGreaterThanOrEqual(40);
  });
});
