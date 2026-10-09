/**
 * ACCESSOS Semantic Page Representation Schema
 * Core domain contract between client-side DOM understanding and future AI orchestration.
 */

export interface PageInfo {
  title: string;
  url: string;
  hostname: string;
  pathname: string;
}

export interface HeadingInfo {
  id: string;
  level: number;
  text: string;
  order: number;
}

export interface SectionInfo {
  id: string;
  role: string;
  heading?: string;
  summary: string;
  fieldIds: string[];
  buttonIds: string[];
  linkIds: string[];
}

export type LabelSource =
  | 'explicit-label'
  | 'wrapped-label'
  | 'aria-labelledby'
  | 'aria-label'
  | 'fieldset'
  | 'nearby-text'
  | 'placeholder'
  | 'none';

export interface ValidationAttributes {
  pattern?: string;
  min?: string;
  max?: string;
  minLength?: number;
  maxLength?: number;
}

export interface FieldInfo {
  id: string;
  tag: 'input' | 'textarea' | 'select';
  type: string;
  name?: string;
  elementId?: string;
  label: string;
  labelSource: LabelSource;
  placeholder?: string;
  description?: string;
  required: boolean;
  requiredSource?: 'required-attr' | 'aria-required';
  disabled: boolean;
  readonly: boolean;
  hasValue: boolean;
  sensitive: boolean;
  options?: string[];
  autocomplete?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  validationAttributes?: ValidationAttributes;
  order: number;
  sectionId?: string;
}

export interface ButtonInfo {
  id: string;
  text: string;
  type: 'submit' | 'button' | 'reset';
  ariaLabel?: string;
  disabled: boolean;
  order: number;
  sectionId?: string;
}

export interface LinkInfo {
  id: string;
  text: string;
  href: string;
  ariaLabel?: string;
  isExternal: boolean;
  order: number;
  sectionId?: string;
}

export interface InstructionInfo {
  id: string;
  text: string;
  source: 'paragraph' | 'help-text' | 'description' | 'aria-describedby' | 'alert';
  order: number;
  sectionId?: string;
}

export interface ErrorInfo {
  id: string;
  fieldId?: string;
  text: string;
  severity?: 'error' | 'warning';
  source: 'aria-alert' | 'aria-invalid' | 'validation-message' | 'error-class';
}

export interface AccessibilitySignals {
  missingLabels: { fieldId: string; description: string }[];
  missingAltImages: { src?: string; order: number }[];
  buttonsWithoutAccessibleName: { buttonId: string }[];
  linksWithoutAccessibleName: { linkId: string; href?: string }[];
  ariaInvalidFields: { fieldId: string }[];
  headingHierarchyAnomalies: {
    headingId: string;
    level: number;
    expectedLevel?: number;
    message: string;
  }[];
  emptyInteractiveElements: { elementId: string; tag: string }[];
  hasMainLandmark: boolean;
  keyboardFocusabilityIssues: { elementId: string; reason: string }[];
  totalSignalsCount: number;
}

export interface FormComplexityIndicators {
  fieldCount: number;
  requiredFieldCount: number;
  sectionCount: number;
  conditionalSectionsCount: number;
  fileUploadCount: number;
}

export interface PageMetrics {
  headingCount: number;
  sectionCount: number;
  fieldCount: number;
  requiredFieldCount: number;
  buttonCount: number;
  linkCount: number;
  instructionCount: number;
  errorCount: number;
  imageCount: number;
  missingLabelCount: number;
  missingAccessibleNameCount: number;
  formComplexity: FormComplexityIndicators;
}

export interface PageRepresentation {
  page: PageInfo;
  headings: HeadingInfo[];
  sections: SectionInfo[];
  fields: FieldInfo[];
  buttons: ButtonInfo[];
  links: LinkInfo[];
  instructions: InstructionInfo[];
  errors: ErrorInfo[];
  accessibilitySignals: AccessibilitySignals;
  metrics: PageMetrics;
  extractedAt: number;
}
