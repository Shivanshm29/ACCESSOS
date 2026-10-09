/**
 * ACCESSOS User Preferences Types (Phase 10)
 *
 * Defines strongly typed preference schemas, bounds, and localization contracts.
 */

export type LanguageCode = 'en' | 'hi';

export type ExplanationComplexity = 'SIMPLE' | 'STANDARD' | 'DETAILED';

export type ConfirmationVerbosity = 'STANDARD' | 'DETAILED';

export interface UserPreferences {
  version: number;
  language: LanguageCode;
  explanationMode: ExplanationComplexity;
  highContrast: boolean;
  largerText: boolean;
  reducedDensity: boolean;
  guidedShowWhy: boolean;
  guidedShowWarnings: boolean;
  guidedShowProgress: boolean;
  confirmationVerbosity: ConfirmationVerbosity;
  documentShowEvidence: boolean;
  documentShowConfidence: boolean;
  analyticsEnabled: boolean;
}

export type PreferenceUpdate = Partial<Omit<UserPreferences, 'version'>>;

export type TranslationKey =
  | 'app_title'
  | 'tab_guided'
  | 'tab_explain'
  | 'tab_doc_intel'
  | 'tab_preferences'
  | 'tab_completion'
  | 'tab_analytics'
  | 'pref_general_title'
  | 'pref_language_label'
  | 'pref_explanation_complexity_label'
  | 'pref_visual_title'
  | 'pref_high_contrast_label'
  | 'pref_larger_text_label'
  | 'pref_reduced_density_label'
  | 'pref_guided_title'
  | 'pref_guided_why_label'
  | 'pref_guided_warnings_label'
  | 'pref_guided_progress_label'
  | 'pref_interaction_title'
  | 'pref_confirmation_verbosity_label'
  | 'pref_docs_title'
  | 'pref_doc_evidence_label'
  | 'pref_doc_confidence_label'
  | 'pref_analytics_title'
  | 'pref_analytics_enabled_label'
  | 'pref_analytics_clear_btn'
  | 'pref_saved_toast'
  | 'pref_reset_btn'
  | 'safety_immutable_notice'
  | 'guided_step_heading'
  | 'guided_why_heading'
  | 'guided_warnings_heading'
  | 'explain_input_placeholder'
  | 'explain_btn_label'
  | 'doc_select_prompt'
  | 'doc_analyze_btn'
  | 'analytics_dashboard_title'
  | 'analytics_dashboard_notice'
  | 'analytics_clear_confirm';
