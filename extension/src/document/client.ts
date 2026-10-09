/**
 * ACCESSOS Document Intelligence API Client (Phase 9)
 *
 * Client for interacting with the backend document analysis endpoints
 * with local deterministic fallback when the backend is offline.
 */

import {
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_EXTENSIONS,
  type DocumentAnalysisRequest,
  type DocumentAnalysisResponse,
  type DocumentRepresentation,
  type DocumentRequirementMatch,
  type ExtractedFact,
  type MatchStatus,
} from './types';
import { sanitizeFilename, truncateEvidence } from './sanitizer';
import { getBackendUrl, DEFAULT_BACKEND_URL } from '../core/config';
export { DEFAULT_BACKEND_URL };

export class DocumentClient {
  private baseUrl: string;

  constructor(baseUrl: string = getBackendUrl()) {
    this.baseUrl = baseUrl;
  }

  /**
   * Validate local file before sending to backend or processing.
   */
  public validateFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return {
        valid: false,
        error: 'No file selected. Please select a valid document.',
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      };
    }

    const name = file.name.toLowerCase();
    const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!hasValidExt) {
      return {
        valid: false,
        error: `Unsupported file format. Please provide a PDF, PNG, JPEG, or TXT file.`,
      };
    }

    return { valid: true };
  }

  /**
   * Send document analysis request to backend or execute deterministic fallback.
   */
  public async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResponse> {
    const cleanFilename = sanitizeFilename(request.filename);
    const sanitizedRequest = { ...request, filename: cleanFilename };

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/document/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedRequest),
      });

      if (response.ok) {
        return (await response.json()) as DocumentAnalysisResponse;
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error: ${response.status}`);
    } catch (err) {
      // Local deterministic fallback if backend is unreachable or for isolated testing
      return this.localDeterministicAnalysis(sanitizedRequest);
    }
  }

  /**
   * Client-side deterministic analysis fallback for offline or standalone operation.
   */
  public localDeterministicAnalysis(request: DocumentAnalysisRequest): DocumentAnalysisResponse {
    const startTime = performance.now();
    const text = request.text || '';
    const filename = request.filename;
    const docId = request.documentId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const lower = text.toLowerCase();
    let category: DocumentRepresentation['documentType']['category'] = 'UNKNOWN';
    let confidence = 0.0;
    let reason = 'Insufficient markers to determine document type';
    let evidence: string | undefined = undefined;

    const extractionWarnings: string[] = [];
    if (lower.includes('corrupt')) {
      extractionWarnings.push('Document appears corrupt or damaged.');
    }
    if (lower.includes('encrypted') || lower.includes('password')) {
      extractionWarnings.push('Document is password-protected or encrypted.');
    }

    if (lower.includes('income') && (lower.includes('annual') || lower.includes('tahsildar') || lower.includes('family income'))) {
      category = 'INCOME_CERTIFICATE';
      confidence = 0.88;
      reason = 'Document identified as Income Certificate based on income terminology and issuing revenue officer markers.';
      evidence = truncateEvidence(text.slice(0, 150));
    } else if (lower.includes('marksheet') || lower.includes('statement of marks') || lower.includes('cgpa') || lower.includes('percentage')) {
      category = 'ACADEMIC_MARKSHEET';
      confidence = 0.90;
      reason = 'Document identified as Academic Marksheet based on marks and examination terminology.';
      evidence = truncateEvidence(text.slice(0, 150));
    } else if (lower.includes('passbook') || lower.includes('ifsc') || (lower.includes('bank') && lower.includes('account number'))) {
      category = 'BANK_DOCUMENT';
      confidence = 0.92;
      reason = 'Document identified as Bank Passbook based on banking account markers.';
      evidence = truncateEvidence(text.slice(0, 150));
    } else if (lower.includes('domicile') || lower.includes('residence certificate')) {
      category = 'DOMICILE_CERTIFICATE';
      confidence = 0.88;
      reason = 'Document identified as Domicile Certificate based on residential jurisdiction markers.';
      evidence = truncateEvidence(text.slice(0, 150));
    } else if (lower.includes('aadhaar') || lower.includes('voter') || lower.includes('passport')) {
      category = 'IDENTITY_DOCUMENT';
      confidence = 0.89;
      reason = 'Document identified as Identity Proof.';
      evidence = truncateEvidence(text.slice(0, 150));
    }

    const facts: ExtractedFact[] = [];
    const nameMatch = text.match(/(?:Name|Candidate Name|Applicant Name)\s*[:\-]\s*([A-Za-z\s]+)/i);
    if (nameMatch && nameMatch[1].trim().split(/\s+/).length >= 2) {
      facts.push({
        factType: 'APPLICANT_NAME',
        value: nameMatch[1].trim(),
        confidence: 0.9,
        sourcePage: 1,
        evidence: truncateEvidence(nameMatch[0]),
        sensitivity: 'NON_SENSITIVE',
        documentId: docId,
      });
    }

    const holderMatch = text.match(/(?:Account\s+Holder(?:\s+Name)?|A\/c\s+Holder(?:\s+Name)?|In\s+the\s+Name\s+of)\s*[:\-]\s*([A-Za-z\s]+)/i);
    if (holderMatch && holderMatch[1].trim().split(/\s+/).length >= 2) {
      facts.push({
        factType: 'BANK_ACCOUNT_HOLDER',
        value: holderMatch[1].trim(),
        confidence: 0.92,
        sourcePage: 1,
        evidence: truncateEvidence(holderMatch[0]),
        sensitivity: 'SENSITIVE',
        documentId: docId,
      });
    }

    const matches: DocumentRequirementMatch[] = [];
    if (request.pageRequirements) {
      for (const req of request.pageRequirements) {
        let matchStatus: MatchStatus = 'NO_MATCH';
        let matchConf = 0.1;
        let matchReason = `Document type (${category}) does not match expected requirement.`;
        const warnings: string[] = [];

        if (req.expectedDocumentType === category && category !== 'UNKNOWN') {
          matchStatus = 'MATCH';
          matchConf = confidence;
          matchReason = `Document matches requirement for ${req.description}.`;

          // Check name mismatch if bank document
          if (category === 'BANK_DOCUMENT' && req.expectedValues?.applicant_name) {
            const expName = req.expectedValues.applicant_name.toLowerCase();
            const holderFact = facts.find((f) => f.factType === 'BANK_ACCOUNT_HOLDER');
            if (holderFact && !holderFact.value.toLowerCase().includes(expName.split(' ')[0])) {
              matchStatus = 'AMBIGUOUS';
              matchConf = 0.45;
              const warn = `Name mismatch detected: Page applicant is '${req.expectedValues.applicant_name}', but bank document shows holder '${holderFact.value}'.`;
              warnings.push(warn);
              matchReason = warn;
            }
          }
        }

        matches.push({
          requirementId: req.requirementId,
          requirementDescription: req.description,
          documentId: docId,
          matchStatus,
          confidence: matchConf,
          evidence: evidence || '',
          reason: matchReason,
          suggestedUploadFieldId: req.targetFieldId,
          warnings,
        });
      }
    }

    const docRep: DocumentRepresentation = {
      documentId: docId,
      filename,
      mimeType: request.mimeType || 'text/plain',
      pageCount: 1,
      extractedTextAvailable: Boolean(text.trim()),
      pages: [
        {
          pageNumber: 1,
          text,
          headings: [],
          detectedFacts: facts,
          evidenceSnippets: evidence ? [evidence] : [],
        },
      ],
      metadata: { localFallback: true },
      documentType: {
        category,
        confidence,
        reason,
        evidence,
      },
      extractionWarnings,
    };

    return {
      document: docRep,
      extractedFacts: facts,
      requirementMatches: matches,
      summary: `Document '${filename}' identified as ${category.replace(/_/g, ' ')} with ${Math.round(confidence * 100)}% confidence.`,
      analysisWarnings: extractionWarnings,
      processingTimeMs: Math.round(performance.now() - startTime),
    };
  }
}
