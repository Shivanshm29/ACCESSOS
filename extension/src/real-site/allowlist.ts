/**
 * ACCESSOS Real-Site Allowlist (Phase 14)
 * Explicit allowlist of real, non-sensitive, public websites for compatibility testing.
 * Rejects arbitrary URLs, authenticated portals, banking/payment flows, and private accounts.
 */

import {
  SiteCategory,
  CompatibilityClassification,
  type RealSiteEntry,
} from './types';

export const REAL_SITE_ALLOWLIST: RealSiteEntry[] = [
  {
    id: 'site-a-wikipedia',
    name: 'Wikipedia - Web Accessibility',
    publicUrl: 'https://en.wikipedia.org/wiki/Web_accessibility',
    category: SiteCategory.STATIC_INFORMATIONAL,
    whySelected: 'Canonical static informational reference with deep heading structure, table of contents, and references.',
    expectedDomCharacteristics: [
      'Hierarchical headings (H1-H4)',
      'Navigation landmarks',
      'Extensive in-text links',
      'Semantic content sections',
      'Zero interactive forms',
    ],
    permittedOperations: [
      'DOM extraction',
      'Semantic page representation',
      'Accessibility evaluation',
      'AI page grounding',
      'Plain-language explanation',
    ],
    prohibitedOperations: [
      'Any DOM mutation',
      'Account login or editing',
      'External link navigation',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.READ_ONLY_SUPPORT,
  },
  {
    id: 'site-b-mdn-docs',
    name: 'MDN Web Docs - HTML Forms Guide',
    publicUrl: 'https://developer.mozilla.org/en-US/docs/Learn/Forms',
    category: SiteCategory.DOCUMENTATION_HELP,
    whySelected: 'Extensive public technical documentation with code blocks, sidebar navigation, breadcrumbs, and articles.',
    expectedDomCharacteristics: [
      'Navigation landmarks',
      'Code blocks and pre elements',
      'Search input element',
      'Breadcrumb lists',
      'Sidebar table of contents',
    ],
    permittedOperations: [
      'DOM extraction',
      'Accessibility evaluation',
      'Technical concept explanation',
      'AI summary extraction',
    ],
    prohibitedOperations: [
      'Live search form submission',
      'Any DOM mutation',
      'External navigation',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.READ_ONLY_SUPPORT,
  },
  {
    id: 'site-c-w3c-wai',
    name: 'W3C WAI - Introduction to Accessibility',
    publicUrl: 'https://www.w3.org/WAI/fundamentals/accessibility-intro/',
    category: SiteCategory.ARTICLE_CONTENT,
    whySelected: 'Authoritative international accessibility guidance with standard semantic landmarks, callouts, and clean markup.',
    expectedDomCharacteristics: [
      'W3C standard header and footer',
      'Main content landmark',
      'Semantic callout boxes',
      'Clear heading hierarchy',
    ],
    permittedOperations: [
      'DOM extraction',
      'Accessibility audit',
      'AI page reasoning',
      'Explain Anything concept breakdown',
    ],
    prohibitedOperations: [
      'Any DOM mutation',
      'Automated crawling',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.READ_ONLY_SUPPORT,
  },
  {
    id: 'site-d-archive-search',
    name: 'Internet Archive - Public Search Interface',
    publicUrl: 'https://archive.org/search',
    category: SiteCategory.SEARCH_INTERFACE,
    whySelected: 'Representative public search interface with search inputs, facet checkboxes, filter dropdowns, and button elements.',
    expectedDomCharacteristics: [
      'Search input with label/placeholder',
      'Filter facet checkboxes',
      'Sort dropdown select',
      'Search trigger buttons',
    ],
    permittedOperations: [
      'DOM extraction',
      'Accessibility evaluation',
      'Safe non-mutating focus and highlight',
      'AI search interface comprehension',
    ],
    prohibitedOperations: [
      'Live query submission to servers',
      'Automated scraping',
      'Account login',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.PARTIAL_SUPPORT,
  },
  {
    id: 'site-e-w3c-form',
    name: 'W3C WAI - Accessible Contact Form Example',
    publicUrl: 'https://www.w3.org/WAI/tutorials/forms/example/',
    category: SiteCategory.FORM_NO_SUBMISSION,
    whySelected: 'Accessible benchmark form with explicit labels, fieldsets, required asterisks, helper instructions, and validation hints.',
    expectedDomCharacteristics: [
      'Semantic form element',
      'Fieldset with legend',
      'Text inputs with explicit labels',
      'Select dropdown',
      'Textarea element',
      'Submit button element',
    ],
    permittedOperations: [
      'DOM extraction',
      'Accessibility engine audit',
      'AI form structure analysis',
      'Controlled safe typing test (with explicit mock confirmation)',
      'Completion requirement evaluation',
    ],
    prohibitedOperations: [
      'Actual HTTP submission to external host',
      'Sensitive data input',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.FULL_SUPPORT,
  },
  {
    id: 'site-f-usagov-feedback',
    name: 'USAGov Public Feedback Questionnaire',
    publicUrl: 'https://www.usa.gov/feedback',
    category: SiteCategory.MULTI_SECTION_FORM,
    whySelected: 'Public questionnaire exposing radio groups, checkboxes, multi-step sections, and conditional inputs without requiring login.',
    expectedDomCharacteristics: [
      'Multi-step form sections',
      'Radio button groups with legends',
      'Checkbox selections',
      'Feedback textarea',
      'Step progress indicators',
    ],
    permittedOperations: [
      'DOM extraction',
      'Accessibility audit',
      'Guided Mode stage reasoning',
      'Completion checking on public sections',
    ],
    prohibitedOperations: [
      'Live submission of feedback',
      'Personal data entry',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.PARTIAL_SUPPORT,
  },
  {
    id: 'site-g-govuk-passport',
    name: 'GOV.UK - Passport Guidance Page',
    publicUrl: 'https://www.gov.uk/apply-renew-passport',
    category: SiteCategory.GOV_INSTITUTIONAL,
    whySelected: 'Public government information portal featuring step-by-step guidance, prerequisite lists, and explicit document requirements.',
    expectedDomCharacteristics: [
      'Numbered step-by-step navigation',
      'Document requirements bullet list',
      'Government service callout banners',
      'Action link button to start portal',
    ],
    permittedOperations: [
      'DOM extraction',
      'Accessibility audit',
      'Document requirement recognition',
      'Plain-language explanation of legal terms',
    ],
    prohibitedOperations: [
      'External portal account creation',
      'Form submission',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.READ_ONLY_SUPPORT,
  },
  {
    id: 'site-h-bls-data-table',
    name: 'US Bureau of Labor Statistics - Employment Data Table',
    publicUrl: 'https://www.bls.gov/news.release/empsit.t01.htm',
    category: SiteCategory.TABLES_DATA,
    whySelected: 'Complex public statistical data table with hierarchical column and row headers, scope attributes, and numeric figures.',
    expectedDomCharacteristics: [
      'HTML table with caption',
      'Hierarchical th elements with scope',
      'Multiple row header cells',
      'Extensive tabular numeric data',
    ],
    permittedOperations: [
      'DOM extraction',
      'Table accessibility compliance inspection',
      'Explain Anything terminology analysis',
      'AI data summary grounding',
    ],
    prohibitedOperations: [
      'Any DOM mutation',
      'Automated bulk data harvesting',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.READ_ONLY_SUPPORT,
  },
  {
    id: 'site-i-w3c-modal-dialog',
    name: 'W3C WAI-ARIA - Modal Dialog Example',
    publicUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/',
    category: SiteCategory.MODAL_DIALOG,
    whySelected: 'Accessible interactive modal pattern featuring role="dialog", aria-modal="true", trap-focus loop, and dismissal buttons.',
    expectedDomCharacteristics: [
      'Dialog trigger button',
      'role="dialog" overlay container',
      'aria-modal="true" attribute',
      'Modal focus trap buttons and inputs',
      'Close button with accessible label',
    ],
    permittedOperations: [
      'DOM extraction',
      'Accessibility audit of modal states',
      'Controlled safe interaction on trigger button',
      'Focus trapping safety check',
    ],
    prohibitedOperations: [
      'Live external submission',
      'Arbitrary script injection',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.PARTIAL_SUPPORT,
  },
  {
    id: 'site-j-w3c-tabs-pattern',
    name: 'W3C WAI-ARIA - Tabs Pattern Example',
    publicUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs/',
    category: SiteCategory.DYNAMIC_RENDERED,
    whySelected: 'Client-side dynamic tab interface toggling active tabpanels via aria-selected and hidden attributes dynamically.',
    expectedDomCharacteristics: [
      'role="tablist" container',
      'role="tab" buttons with aria-selected',
      'role="tabpanel" content containers',
      'Dynamic hidden attribute toggles',
    ],
    permittedOperations: [
      'DOM extraction across dynamic states',
      'Accessibility audit of active tab',
      'Safe tab focus switching',
      'Dynamic content refresh evaluation',
    ],
    prohibitedOperations: [
      'Arbitrary script injection',
      'Uncontrolled continuous DOM polling',
    ],
    dateTested: '2026-10-07',
    expectedCompatibility: CompatibilityClassification.PARTIAL_SUPPORT,
  },
];

/**
 * Normalizes URL string for allowlist matching (ignores trailing slash, lowercases).
 */
export function normalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return urlStr.trim().replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Validates whether a target URL is in the Phase 14 real-site allowlist.
 */
export function isSiteAllowlisted(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const targetNorm = normalizeUrl(url);
  return REAL_SITE_ALLOWLIST.some((entry) => normalizeUrl(entry.publicUrl) === targetNorm);
}

/**
 * Retrieves the allowlist entry for a given URL, if permitted.
 */
export function getAllowlistedSite(url: string): RealSiteEntry | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const targetNorm = normalizeUrl(url);
  return REAL_SITE_ALLOWLIST.find((entry) => normalizeUrl(entry.publicUrl) === targetNorm);
}

/**
 * Validates a test target URL and returns an explicit allow/deny decision.
 */
export function validateSiteUrl(url: string): {
  allowed: boolean;
  site?: RealSiteEntry;
  reason?: string;
} {
  if (!url || typeof url !== 'string') {
    return {
      allowed: false,
      reason: 'URL must be a non-empty string.',
    };
  }

  const site = getAllowlistedSite(url);
  if (!site) {
    return {
      allowed: false,
      reason: `URL '${url}' is NOT in the Phase 14 real-site allowlist. Testing rejected by safety policy.`,
    };
  }

  return {
    allowed: true,
    site,
  };
}

/**
 * Returns all allowlisted site entries.
 */
export function getAllAllowlistedSites(): RealSiteEntry[] {
  return [...REAL_SITE_ALLOWLIST];
}
