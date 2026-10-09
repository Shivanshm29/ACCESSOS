/**
 * ACCESSOS Document Intelligence Types (Phase 9)
 *
 * Strongly typed contracts for document ingestion, classification,
 * grounded fact extraction, and webpage requirement matching.
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PAGE_COUNT = 20;
export const MAX_EXTRACTED_TEXT_LENGTH = 50_000;
export const MAX_EVIDENCE_LENGTH = 250;
export const MAX_FACTS_COUNT = 50;

export const SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.txt'] as const;
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
] as const;

export type SupportedExtension = typeof SUPPORTED_EXTENSIONS[number];
export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

export type DocumentType =
  | 'IDENTITY_DOCUMENT'
  | 'DOMICILE_CERTIFICATE'
  | 'ACADEMIC_MARKSHEET'
  | 'INCOME_CERTIFICATE'
  | 'BANK_DOCUMENT'
  | 'DECLARATION'
  | 'MISCELLANEOUS'
  | 'UNKNOWN';

export type FactType =
  | 'APPLICANT_NAME'
  | 'FATHER_NAME'
  | 'DOB'
  | 'INSTITUTION_NAME'
  | 'EXAMINATION_YEAR'
  | 'PERCENTAGE_MARKS'
  | 'GRADE_OR_CGPA'
  | 'INCOME_AMOUNT'
  | 'DOMICILE_STATE'
  | 'BANK_ACCOUNT_HOLDER'
  | 'BANK_ACCOUNT_NUMBER'
  | 'BANK_NAME'
  | 'BANK_IFSC_CODE'
  | 'DOCUMENT_DATE'
  | 'CERTIFICATE_NUMBER'
  | 'OTHER';

export type FactSensitivity = 'NON_SENSITIVE' | 'SENSITIVE' | 'HIGHLY_SENSITIVE';

export type MatchStatus =
  | 'MATCH'
  | 'PARTIAL_MATCH'
  | 'NO_MATCH'
  | 'AMBIGUOUS'
  | 'NOT_ENOUGH_EVIDENCE';

export interface ExtractedFact {
  factType: FactType;
  value: string;
  confidence: number;
  sourcePage: number;
  evidence: string;
  sensitivity: FactSensitivity;
  documentId?: string;
}

export interface DocumentPageRepresentation {
  pageNumber: number;
  text: string;
  headings: string[];
  detectedFacts: ExtractedFact[];
  evidenceSnippets: string[];
}

export interface DocumentClassification {
  category: DocumentType;
  confidence: number;
  reason: string;
  evidence?: string | null;
}

export interface DocumentRepresentation {
  documentId: string;
  filename: string;
  mimeType: string;
  pageCount: number;
  extractedTextAvailable: boolean;
  pages: DocumentPageRepresentation[];
  metadata: Record<string, unknown>;
  documentType: DocumentClassification;
  extractionWarnings: string[];
}

export interface PageRequirement {
  requirementId: string;
  targetFieldId?: string;
  requirementType?: string;
  description: string;
  mandatory: boolean;
  expectedDocumentType?: DocumentType;
  expectedValues?: Record<string, string>;
}

export interface DocumentRequirementMatch {
  requirementId: string;
  requirementDescription: string;
  documentId: string;
  matchStatus: MatchStatus;
  confidence: number;
  evidence: string;
  reason: string;
  suggestedUploadFieldId?: string;
  warnings: string[];
}

export interface DocumentAnalysisRequest {
  documentId?: string;
  filename: string;
  fileBase64?: string;
  text?: string;
  mimeType?: string;
  pageRequirements?: PageRequirement[];
  pageUrl?: string;
}

export interface DocumentAnalysisResponse {
  document: DocumentRepresentation;
  extractedFacts: ExtractedFact[];
  requirementMatches: DocumentRequirementMatch[];
  summary: string;
  analysisWarnings: string[];
  processingTimeMs: number;
}
