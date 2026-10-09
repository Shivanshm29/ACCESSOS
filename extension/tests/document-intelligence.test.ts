/**
 * Unit & Integration Tests for ACCESSOS Document Intelligence (Phase 9)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DocumentClient,
  extractPageRequirements,
  sanitizeFilename,
  truncateEvidence,
  redactSensitiveValue,
  sanitizeForLogging,
  MAX_FILE_SIZE_BYTES,
  type PageRequirement,
} from '../src/document/index';
import type { PageRepresentation } from '../src/core/types/index';

describe('Phase 9 Document Intelligence - Core Functionality', () => {
  let client: DocumentClient;

  beforeEach(() => {
    client = new DocumentClient('http://localhost:8000');
  });

  describe('1. File Validation and Sanitization', () => {
    it('accepts valid PDF, PNG, JPEG, and TXT files', () => {
      const pdfFile = new File(['%PDF-1.4 sample'], 'marksheet.pdf', { type: 'application/pdf' });
      const imgFile = new File(['fake-png'], 'identity.png', { type: 'image/png' });
      const txtFile = new File(['income statement'], 'income.txt', { type: 'text/plain' });

      expect(client.validateFile(pdfFile).valid).toBe(true);
      expect(client.validateFile(imgFile).valid).toBe(true);
      expect(client.validateFile(txtFile).valid).toBe(true);
    });

    it('rejects unsupported file formats', () => {
      const exeFile = new File(['binary'], 'script.exe', { type: 'application/x-msdownload' });
      const zipFile = new File(['binary'], 'archive.zip', { type: 'application/zip' });

      const res1 = client.validateFile(exeFile);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('Unsupported file format');

      const res2 = client.validateFile(zipFile);
      expect(res2.valid).toBe(false);
    });

    it('rejects oversized files exceeding 10MB', () => {
      // Create a mock large file
      const bigFile = {
        name: 'huge_document.pdf',
        size: MAX_FILE_SIZE_BYTES + 1024,
      } as File;

      const res = client.validateFile(bigFile);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds 10MB limit');
    });

    it('sanitizes filenames to prevent path traversal', () => {
      expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32\\calc.exe')).toBe('calc.exe');
      expect(sanitizeFilename('normal.pdf')).toBe('normal.pdf');
      expect(sanitizeFilename('')).toBe('unnamed_document');
    });

    it('truncates evidence snippets to bounded length', () => {
      const longText = 'Word '.repeat(100);
      const truncated = truncateEvidence(longText, 60);
      expect(truncated.length).toBeLessThanOrEqual(60);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('redacts sensitive values like account numbers and IDs', () => {
      expect(redactSensitiveValue('123456789012')).toBe('****9012');
      expect(redactSensitiveValue('1234')).toBe('****');
    });

    it('sanitizes logs removing cards, account numbers, and secrets', () => {
      const raw = 'Account 123456789012 card 4111 2222 3333 4444 secret: mytoken';
      const clean = sanitizeForLogging(raw);
      expect(clean).not.toContain('123456789012');
      expect(clean).not.toContain('4111');
      expect(clean).not.toContain('mytoken');
      expect(clean).toContain('[CARD-REDACTED]');
    });
  });

  describe('2. Page Requirement Extraction', () => {
    it('extracts upload requirements and expected applicant values from PageRepresentation', () => {
      const mockPageRep = {
        page: { title: 'Scholarship Form', url: 'https://demo.gov', hostname: 'demo.gov', pathname: '/' },
        sections: [],
        headings: [],
        fields: [
          {
            id: 'accessos-field-001',
            elementId: 'applicant_full_name',
            tag: 'input',
            order: 1,
            type: 'text',
            name: 'applicant_full_name',
            label: 'Full Legal Name',
            labelSource: 'explicit-label',
            required: true,
            disabled: false,
            readonly: false,
            sensitive: false,
            hasValue: true,
          },
          {
            id: 'accessos-field-002',
            elementId: 'doc_income_certificate',
            tag: 'input',
            order: 2,
            type: 'file',
            name: 'doc_income_certificate',
            label: 'Annual Household Income Certificate',
            labelSource: 'explicit-label',
            required: true,
            disabled: false,
            readonly: false,
            sensitive: false,
            hasValue: false,
          },
          {
            id: 'accessos-field-003',
            elementId: 'doc_bank_passbook',
            tag: 'input',
            order: 3,
            type: 'file',
            name: 'doc_bank_passbook',
            label: 'Bank Passbook Copy',
            labelSource: 'explicit-label',
            required: true,
            disabled: false,
            readonly: false,
            sensitive: false,
            hasValue: false,
          },
        ],
        buttons: [],
        links: [],
        instructions: [],
        errors: [],
        metrics: {} as any,
        accessibilitySignals: {} as any,
      } as unknown as PageRepresentation;

      const reqs = extractPageRequirements(mockPageRep);
      expect(reqs.length).toBe(2);

      const incomeReq = reqs.find((r) => r.targetFieldId === 'doc_income_certificate');
      expect(incomeReq).toBeDefined();
      expect(incomeReq?.expectedDocumentType).toBe('INCOME_CERTIFICATE');
      expect(incomeReq?.mandatory).toBe(true);

      const bankReq = reqs.find((r) => r.targetFieldId === 'doc_bank_passbook');
      expect(bankReq).toBeDefined();
      expect(bankReq?.expectedDocumentType).toBe('BANK_DOCUMENT');
    });
  });

  describe('3. Deterministic Local Analysis & Matching', () => {
    it('classifies Income Certificate and matches webpage requirement', () => {
      const text =
        'GOVERNMENT OF MAHARASHTRA\n' +
        'REVENUE DEPARTMENT\n' +
        'INCOME CERTIFICATE\n' +
        'Candidate Name: Devansh Varma\n' +
        'Annual Family Income: Rs. 1,80,000/- per annum\n' +
        'Issued by: Tahsildar, Pune\n';

      const reqs: PageRequirement[] = [
        {
          requirementId: 'req_income',
          targetFieldId: 'doc_income_certificate',
          requirementType: 'FILE_UPLOAD',
          description: 'Annual Household Income Certificate',
          mandatory: true,
          expectedDocumentType: 'INCOME_CERTIFICATE',
        },
      ];

      const res = client.localDeterministicAnalysis({
        filename: 'income_certificate.txt',
        text,
        pageRequirements: reqs,
      });

      expect(res.document.documentType.category).toBe('INCOME_CERTIFICATE');
      expect(res.document.documentType.confidence).toBeGreaterThanOrEqual(0.8);
      expect(res.requirementMatches.length).toBe(1);
      expect(res.requirementMatches[0].matchStatus).toBe('MATCH');
      expect(res.requirementMatches[0].suggestedUploadFieldId).toBe('doc_income_certificate');
    });

    it('detects mismatch when Bank Account Holder differs from Webpage Applicant', () => {
      const text =
        'STATE BANK OF INDIA\n' +
        'PASSBOOK\n' +
        'Account Holder: Rahul Varma\n' +
        'Account Number: 123456789012\n' +
        'IFSC: SBIN0001234\n';

      const reqs: PageRequirement[] = [
        {
          requirementId: 'req_bank',
          targetFieldId: 'doc_bank_passbook',
          requirementType: 'FILE_UPLOAD',
          description: 'Bank Passbook Copy',
          mandatory: true,
          expectedDocumentType: 'BANK_DOCUMENT',
          expectedValues: { applicant_name: 'Devansh Varma' },
        },
      ];

      const res = client.localDeterministicAnalysis({
        filename: 'bank_passbook.txt',
        text,
        pageRequirements: reqs,
      });

      expect(res.document.documentType.category).toBe('BANK_DOCUMENT');
      expect(res.requirementMatches.length).toBe(1);
      // Mismatch detected!
      expect(res.requirementMatches[0].matchStatus).toBe('AMBIGUOUS');
      expect(res.requirementMatches[0].warnings.length).toBeGreaterThan(0);
      expect(res.requirementMatches[0].warnings[0]).toContain('Name mismatch detected');
      expect(res.requirementMatches[0].warnings[0]).toContain('Devansh Varma');
      expect(res.requirementMatches[0].warnings[0]).toContain('Rahul Varma');
    });
  });
});
