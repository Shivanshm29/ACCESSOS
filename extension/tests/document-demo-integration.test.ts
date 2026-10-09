/**
 * Phase 9 Document Intelligence Demo Integration Tests
 *
 * Verifies document intelligence against the National Student Scholarship Portal (demo-site/index.html).
 * Demonstrates:
 * 1. Academic marksheet matching
 * 2. Income certificate matching
 * 3. Domicile proof matching
 * 4. Bank document matching & mismatch detection
 * 5. Safe upload recommendation with zero auto-upload or form mutation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Window } from 'happy-dom';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import {
  DocumentClient,
  extractPageRequirements,
  type PageRequirement,
} from '../src/document/index';

describe('Phase 9 Document Intelligence - Scholarship Portal Demo Integration', () => {
  let win: Window;
  let document: Document;
  let client: DocumentClient;
  let pageRequirements: PageRequirement[];

  beforeEach(() => {
    const demoHtmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const htmlContent = fs.readFileSync(demoHtmlPath, 'utf-8');
    win = new Window({ url: 'http://localhost:3000/' });
    document = win.document as unknown as Document;
    document.write(htmlContent);
    client = new DocumentClient('http://localhost:8000');

    // Extract PageRepresentation and PageRequirements from the scholarship portal
    const pageRep = extractPageRepresentation(document, win.location as unknown as Location);
    pageRequirements = extractPageRequirements(pageRep, document);
  });

  it('1. Extracts all 5 mandatory document upload requirements from the Scholarship Portal', () => {
    expect(pageRequirements.length).toBe(5);

    const targetFieldIds = pageRequirements.map((r) => r.targetFieldId);
    expect(targetFieldIds).toContain('doc_identity_proof');
    expect(targetFieldIds).toContain('doc_income_certificate');
    expect(targetFieldIds).toContain('doc_bonafide_certificate');
    expect(targetFieldIds).toContain('doc_marksheet');
    expect(targetFieldIds).toContain('doc_bank_passbook');

    const incomeReq = pageRequirements.find((r) => r.targetFieldId === 'doc_income_certificate');
    expect(incomeReq?.expectedDocumentType).toBe('INCOME_CERTIFICATE');
    expect(incomeReq?.mandatory).toBe(true);

    const marksheetReq = pageRequirements.find((r) => r.targetFieldId === 'doc_marksheet');
    expect(marksheetReq?.expectedDocumentType).toBe('ACADEMIC_MARKSHEET');

    const bankReq = pageRequirements.find((r) => r.targetFieldId === 'doc_bank_passbook');
    expect(bankReq?.expectedDocumentType).toBe('BANK_DOCUMENT');
  });

  it('2. Demonstrates Academic Marksheet ingestion and requirement matching', () => {
    const marksheetText =
      'MAHARASHTRA STATE BOARD OF SECONDARY AND HIGHER SECONDARY EDUCATION\n' +
      'STATEMENT OF MARKS\n' +
      'Candidate Name: Devansh Varma\n' +
      'Seat No: M-2025-99214\n' +
      'Total Marks: 450 / 500\n' +
      'Percentage: 90.0%\n' +
      'Result: PASSED FIRST CLASS WITH DISTINCTION\n';

    const res = client.localDeterministicAnalysis({
      filename: 'academic_marksheet.txt',
      text: marksheetText,
      pageRequirements,
    });

    expect(res.document.documentType.category).toBe('ACADEMIC_MARKSHEET');
    expect(res.document.documentType.confidence).toBeGreaterThanOrEqual(0.85);

    const match = res.requirementMatches.find((m) => m.suggestedUploadFieldId === 'doc_marksheet');
    expect(match).toBeDefined();
    expect(match?.matchStatus).toBe('MATCH');
    expect(match?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('3. Demonstrates Income Certificate ingestion and recommendation without automatic upload', () => {
    const incomeText =
      'GOVERNMENT OF MAHARASHTRA\n' +
      'REVENUE AND FOREST DEPARTMENT\n' +
      'INCOME CERTIFICATE\n' +
      'This is to certify that Shri Devansh Varma resides in Taluk Pune Urban.\n' +
      'Gross Annual Family Income: Rs. 1,80,000/- (Rupees One Lakh Eighty Thousand Only)\n' +
      'Issued by: Tahsildar & Sub-Divisional Magistrate\n';

    const uploadField = document.getElementById('doc_income_certificate') as HTMLInputElement;
    expect(uploadField).not.toBeNull();
    expect(uploadField.files?.length).toBe(0);

    const res = client.localDeterministicAnalysis({
      filename: 'income_certificate.txt',
      text: incomeText,
      pageRequirements,
    });

    expect(res.document.documentType.category).toBe('INCOME_CERTIFICATE');

    const match = res.requirementMatches.find((m) => m.suggestedUploadFieldId === 'doc_income_certificate');
    expect(match).toBeDefined();
    expect(match?.matchStatus).toBe('MATCH');
    expect(match?.suggestedUploadFieldId).toBe('doc_income_certificate');

    // CRITICAL: Document analysis must NOT mutate the webpage file input
    expect(uploadField.files?.length).toBe(0);
  });

  it('4. Demonstrates Domicile Certificate classification', () => {
    const domicileText =
      'GOVERNMENT OF MAHARASHTRA\n' +
      'DOMICILE CERTIFICATE\n' +
      'Candidate: Devansh Varma\n' +
      'Certified Ordinarily Resident in State of Maharashtra.\n';

    const res = client.localDeterministicAnalysis({
      filename: 'domicile_certificate.txt',
      text: domicileText,
      pageRequirements,
    });

    expect(res.document.documentType.category).toBe('DOMICILE_CERTIFICATE');
    expect(res.document.documentType.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('5. Demonstrates Mismatch Detection: Page applicant vs Bank Passbook holder', () => {
    // Populate page applicant name as "Devansh Varma"
    const nameInput = document.getElementById('applicant_full_name') as HTMLInputElement;
    nameInput.value = 'Devansh Varma';

    // Re-extract requirements so expectedValues has applicant_name = 'Devansh Varma'
    const pageRep = extractPageRepresentation(document, win.location as unknown as Location);
    const updatedReqs = extractPageRequirements(pageRep, document);

    // Mismatched Bank Document has holder: "Rahul Varma"
    const bankText =
      'STATE BANK OF INDIA\n' +
      'SAVINGS BANK PASSBOOK\n' +
      'Account Holder Name: Rahul Varma\n' +
      'Account Number: 987654321098\n' +
      'IFSC Code: SBIN0001234\n';

    const res = client.localDeterministicAnalysis({
      filename: 'bank_passbook.txt',
      text: bankText,
      pageRequirements: updatedReqs,
    });

    expect(res.document.documentType.category).toBe('BANK_DOCUMENT');

    const bankMatch = res.requirementMatches.find((m) => m.suggestedUploadFieldId === 'doc_bank_passbook');
    expect(bankMatch).toBeDefined();
    // Must be flagged as AMBIGUOUS with mismatch warning!
    expect(bankMatch?.matchStatus).toBe('AMBIGUOUS');
    expect(bankMatch?.warnings.length).toBeGreaterThan(0);
    expect(bankMatch?.warnings[0]).toContain('Name mismatch detected');
    expect(bankMatch?.warnings[0]).toContain('Devansh Varma');
    expect(bankMatch?.warnings[0]).toContain('Rahul Varma');
  });

  it('6. Demonstrates that analyzing documents leaves all form fields on the webpage untouched', () => {
    const initialName = (document.getElementById('applicant_full_name') as HTMLInputElement).value;
    const initialBankAcc = (document.getElementById('bank_account_number') as HTMLInputElement).value;

    client.localDeterministicAnalysis({
      filename: 'sample_doc.txt',
      text: 'Candidate Name: Injected Name\nAccount Number: 999999999999\n',
      pageRequirements,
    });

    // Form values must remain completely unchanged
    expect((document.getElementById('applicant_full_name') as HTMLInputElement).value).toBe(initialName);
    expect((document.getElementById('bank_account_number') as HTMLInputElement).value).toBe(initialBankAcc);
  });
});
