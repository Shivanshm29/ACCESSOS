/**
 * ACCESSOS Real-Site Testing Domain Types (Phase 14)
 * Strongly typed models for real-site allowlists, validation modes,
 * compatibility classifications, and privacy-safe reporting.
 */


export enum SiteCategory {
  STATIC_INFORMATIONAL = 'STATIC_INFORMATIONAL', // A: Static informational page
  DOCUMENTATION_HELP = 'DOCUMENTATION_HELP',     // B: Public documentation/help page
  ARTICLE_CONTENT = 'ARTICLE_CONTENT',           // C: Public article/content page
  SEARCH_INTERFACE = 'SEARCH_INTERFACE',         // D: Public search interface
  FORM_NO_SUBMISSION = 'FORM_NO_SUBMISSION',     // E: Public form with no real submission
  MULTI_SECTION_FORM = 'MULTI_SECTION_FORM',     // F: Public multi-section form / questionnaire
  GOV_INSTITUTIONAL = 'GOV_INSTITUTIONAL',       // G: Public government/institutional information page
  TABLES_DATA = 'TABLES_DATA',                   // H: Public page with tables/data
  MODAL_DIALOG = 'MODAL_DIALOG',                 // I: Public page with modal/dialog interaction
  DYNAMIC_RENDERED = 'DYNAMIC_RENDERED',         // J: Public page with dynamically rendered content
}

export enum CompatibilityClassification {
  FULL_SUPPORT = 'FULL_SUPPORT',
  PARTIAL_SUPPORT = 'PARTIAL_SUPPORT',
  READ_ONLY_SUPPORT = 'READ_ONLY_SUPPORT',
  UNSUPPORTED = 'UNSUPPORTED',
  BLOCKED_BY_SAFETY_POLICY = 'BLOCKED_BY_SAFETY_POLICY',
}

export enum TestMode {
  MODE_A_READ_ONLY = 'MODE_A_READ_ONLY',
  MODE_B_CONTROLLED_INTERACTION = 'MODE_B_CONTROLLED_INTERACTION',
}

export interface RealSiteEntry {
  id: string;
  name: string;
  publicUrl: string;
  category: SiteCategory;
  whySelected: string;
  expectedDomCharacteristics: string[];
  permittedOperations: string[];
  prohibitedOperations: string[];
  dateTested: string;
  expectedCompatibility: CompatibilityClassification;
}

export interface ExtractionMetrics {
  titlePresent: boolean;
  headingsCount: number;
  landmarksCount: number;
  sectionsCount: number;
  formsCount: number;
  fieldsCount: number;
  buttonsCount: number;
  linksCount: number;
  instructionsCount: number;
  imagesCount: number;
  stableIdsGenerated: number;
  extractionDurationMs: number;
}

export interface AccessibilityMetrics {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  score: number;
  scoreBand: string;
  analysisDurationMs: number;
}

export interface RealSiteValidationResult {
  siteId: string;
  siteName: string;
  publicUrl: string;
  category: SiteCategory;
  mode: TestMode;
  extractionSuccess: boolean;
  extractionMetrics?: ExtractionMetrics;
  accessibilitySuccess: boolean;
  accessibilityMetrics?: AccessibilityMetrics;
  aiAnalysisReady: boolean;
  aiSanitized: boolean;
  promptInjectionDefended: boolean;
  guidedModeStatus: 'SUPPORTED' | 'GUIDED_MODE_UNSUPPORTED' | 'NOT_APPLICABLE';
  explainAnythingStatus: 'SUPPORTED' | 'REDACTED' | 'NOT_APPLICABLE';
  documentRequirementsIdentified: number;
  completionStatus: 'SUPPORTED' | 'COMPLETION_UNSUPPORTED' | 'INSUFFICIENT_STRUCTURED_REQUIREMENTS';
  safeInteractionOutcome: 'BLOCKED' | 'CONFIRMED' | 'NOT_APPLICABLE' | 'POLICY_BLOCKED';
  compatibility: CompatibilityClassification;
  majorLimitations: string[];
  securityVerified: boolean;
  privacyVerified: boolean;
  testedDate: string;
}

export interface RealSiteMatrixRow {
  site: string;
  category: string;
  extraction: string;
  accessibility: string;
  aiAnalysis: string;
  guidedMode: string;
  explainAnything: string;
  docRequirements: string;
  completionChecker: string;
  safeInteraction: string;
  compatibility: string;
  majorLimitation: string;
  securityResult: string;
  testedDate: string;
}
