/**
 * ACCESSOS Typed Localization Dictionary (Phase 10)
 *
 * Provides translations for English and Hindi with guaranteed fallback to English.
 */

import type { LanguageCode, TranslationKey } from './types';

export const TRANSLATIONS: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: {
    app_title: 'ACCESSOS',
    tab_guided: 'Guided Mode',
    tab_explain: 'Explain Anything',
    tab_doc_intel: 'Document Intelligence',
    tab_preferences: 'Preferences',
    tab_completion: 'Completion Checker',
    tab_analytics: 'Analytics',

    pref_general_title: 'General',
    pref_language_label: 'Language',
    pref_explanation_complexity_label: 'Explanation Complexity',

    pref_visual_title: 'Visual Assistance',
    pref_high_contrast_label: 'High Contrast Mode',
    pref_larger_text_label: 'Larger Text',
    pref_reduced_density_label: 'Reduced Density (Relaxed Spacing)',

    pref_guided_title: 'Guided Mode',
    pref_guided_why_label: "Show 'Why This Matters'",
    pref_guided_warnings_label: 'Show Barrier Warnings',
    pref_guided_progress_label: 'Show Progress Indicator',

    pref_interaction_title: 'Interactions',
    pref_confirmation_verbosity_label: 'Confirmation Verbosity',

    pref_docs_title: 'Document Intelligence',
    pref_doc_evidence_label: 'Show Grounded Evidence Snippets',
    pref_doc_confidence_label: 'Show Confidence Scores',

    pref_analytics_title: 'Local Analytics',
    pref_analytics_enabled_label: 'Enable Local Analytics (On-device only)',
    pref_analytics_clear_btn: 'Clear Analytics Data',

    pref_saved_toast: 'Preferences saved',
    pref_reset_btn: 'Reset to Defaults',
    safety_immutable_notice: 'Safety controls and confirmation gates remain strictly mandatory.',

    guided_step_heading: 'Current Step',
    guided_why_heading: 'Why This Matters',
    guided_warnings_heading: 'Accessibility Warnings',
    explain_input_placeholder: 'Select text on webpage or type here...',
    explain_btn_label: 'Explain in Plain Language',
    doc_select_prompt: 'Choose Document (PDF, Image, Text)',
    doc_analyze_btn: 'Analyze Document',

    analytics_dashboard_title: 'Local Impact Analytics',
    analytics_dashboard_notice: 'All analytics remain 100% on your device. Zero telemetry or external transmission.',
    analytics_clear_confirm: 'Are you sure you want to clear all recorded analytics metrics?',
  },
  hi: {
    app_title: 'एक्सेस ओएस (ACCESSOS)',
    tab_guided: 'गाइडेड मोड',
    tab_explain: 'सरल भाषा में समझें',
    tab_doc_intel: 'दस्तावेज़ सहायता',
    tab_preferences: 'प्राथमिकताएं',
    tab_completion: 'पूर्णता सत्यापन',
    tab_analytics: 'एनालिटिक्स',

    pref_general_title: 'सामान्य',
    pref_language_label: 'भाषा',
    pref_explanation_complexity_label: 'व्याख्या जटिलता',

    pref_visual_title: 'दृश्य सहायता',
    pref_high_contrast_label: 'उच्च कंट्रास्ट मोड',
    pref_larger_text_label: 'बड़ा पाठ',
    pref_reduced_density_label: 'खुला लेआउट (आसान दृश्यता)',

    pref_guided_title: 'गाइडेड मोड',
    pref_guided_why_label: "'यह क्यों आवश्यक है' दिखाएं",
    pref_guided_warnings_label: 'बाधा चेतावनी दिखाएं',
    pref_guided_progress_label: 'प्रगति संकेतक दिखाएं',

    pref_interaction_title: 'इंटरैक्शन',
    pref_confirmation_verbosity_label: 'पुष्टि विवरण स्तर',

    pref_docs_title: 'दस्तावेज़ विश्लेषण',
    pref_doc_evidence_label: 'साक्ष्य उद्धरण दिखाएं',
    pref_doc_confidence_label: 'विश्वास संकेतक दिखाएं',

    pref_analytics_title: 'स्थानीय एनालिटिक्स',
    pref_analytics_enabled_label: 'स्थानीय एनालिटिक्स सक्षम करें (केवल इस उपकरण पर)',
    pref_analytics_clear_btn: 'एनालिटिक्स डेटा मिटाएं',

    pref_saved_toast: 'प्राथमिकताएं सहेजी गईं',
    pref_reset_btn: 'डिफ़ॉल्ट पर रीसेट करें',
    safety_immutable_notice: 'सुरक्षा नियंत्रण और पुष्टि द्वार हमेशा अनिवार्य रहते हैं।',

    guided_step_heading: 'वर्तमान चरण',
    guided_why_heading: 'यह क्यों आवश्यक है',
    guided_warnings_heading: 'पहुंच संबंधी चेतावनियां',
    explain_input_placeholder: 'वेबपेज पर टेक्स्ट चुनें या यहां लिखें...',
    explain_btn_label: 'सरल भाषा में समझाएं',
    doc_select_prompt: 'दस्तावेज़ चुनें (पीडीएफ, छवि, टेक्स्ट)',
    doc_analyze_btn: 'दस्तावेज़ का विश्लेषण करें',

    analytics_dashboard_title: 'स्थानीय प्रभाव एनालिटिक्स',
    analytics_dashboard_notice: 'सभी आंकड़े 100% आपके डिवाइस पर ही रहते हैं। कोई बाहरी टेलीमेट्री नहीं।',
    analytics_clear_confirm: 'क्या आप सभी सहेजे गए एनालिटिक्स आंकड़े मिटाना चाहते हैं?',
  },
};

/**
 * Retrieves localized text with guaranteed fallback to English.
 */
export function getLocalizedText(key: TranslationKey, lang: LanguageCode = 'en'): string {
  const langDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return langDict[key] || TRANSLATIONS.en[key] || key;
}

/**
 * Returns complete translation dictionary for given language with fallback.
 */
export function getAllTranslations(lang: LanguageCode = 'en'): Record<TranslationKey, string> {
  const fallback = TRANSLATIONS.en;
  const target = TRANSLATIONS[lang] || fallback;
  return { ...fallback, ...target };
}
