"""
ACCESSOS Real-Site Allowlist (Phase 14)
Python mirror of the Phase 14 curated real-site allowlist.
"""

from urllib.parse import urlparse
from typing import List, Optional, Tuple
from app.realsite.schemas import (
    RealSiteEntry,
    SiteCategory,
    CompatibilityClassification,
)

REAL_SITE_ALLOWLIST: List[RealSiteEntry] = [
    RealSiteEntry(
        id="site-a-wikipedia",
        name="Wikipedia - Web Accessibility",
        publicUrl="https://en.wikipedia.org/wiki/Web_accessibility",
        category=SiteCategory.STATIC_INFORMATIONAL,
        whySelected="Canonical static informational reference with deep heading structure and references.",
        expectedDomCharacteristics=[
            "Hierarchical headings (H1-H4)",
            "Navigation landmarks",
            "Extensive in-text links",
            "Semantic content sections",
        ],
        permittedOperations=["DOM extraction", "Accessibility evaluation", "AI reasoning"],
        prohibitedOperations=["Any DOM mutation", "Account login", "External navigation"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.READ_ONLY_SUPPORT,
    ),
    RealSiteEntry(
        id="site-b-mdn-docs",
        name="MDN Web Docs - HTML Forms Guide",
        publicUrl="https://developer.mozilla.org/en-US/docs/Learn/Forms",
        category=SiteCategory.DOCUMENTATION_HELP,
        whySelected="Extensive public technical documentation with code blocks and sidebars.",
        expectedDomCharacteristics=["Navigation landmarks", "Code blocks", "Search input"],
        permittedOperations=["DOM extraction", "Accessibility evaluation", "Technical concept explanation"],
        prohibitedOperations=["Live search submission", "Any DOM mutation"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.READ_ONLY_SUPPORT,
    ),
    RealSiteEntry(
        id="site-c-w3c-wai",
        name="W3C WAI - Introduction to Accessibility",
        publicUrl="https://www.w3.org/WAI/fundamentals/accessibility-intro/",
        category=SiteCategory.ARTICLE_CONTENT,
        whySelected="Authoritative international accessibility guidance with standard landmarks.",
        expectedDomCharacteristics=["Standard header and footer", "Main content landmark", "Callout boxes"],
        permittedOperations=["DOM extraction", "Accessibility audit", "Explain Anything"],
        prohibitedOperations=["Any DOM mutation", "Automated crawling"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.READ_ONLY_SUPPORT,
    ),
    RealSiteEntry(
        id="site-d-archive-search",
        name="Internet Archive - Public Search Interface",
        publicUrl="https://archive.org/search",
        category=SiteCategory.SEARCH_INTERFACE,
        whySelected="Representative public search interface with search inputs, filter checkboxes, and facets.",
        expectedDomCharacteristics=["Search input", "Filter facet checkboxes", "Sort select dropdown"],
        permittedOperations=["DOM extraction", "Accessibility evaluation", "Safe non-mutating focus"],
        prohibitedOperations=["Live query submission", "Account login"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.PARTIAL_SUPPORT,
    ),
    RealSiteEntry(
        id="site-e-w3c-form",
        name="W3C WAI - Accessible Contact Form Example",
        publicUrl="https://www.w3.org/WAI/tutorials/forms/example/",
        category=SiteCategory.FORM_NO_SUBMISSION,
        whySelected="Accessible benchmark form with explicit labels, fieldsets, and validation hints.",
        expectedDomCharacteristics=["Form element", "Fieldset with legend", "Text inputs", "Select dropdown"],
        permittedOperations=["DOM extraction", "Accessibility engine audit", "Controlled safe typing test"],
        prohibitedOperations=["Actual HTTP submission to external host"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.FULL_SUPPORT,
    ),
    RealSiteEntry(
        id="site-f-usagov-feedback",
        name="USAGov Public Feedback Questionnaire",
        publicUrl="https://www.usa.gov/feedback",
        category=SiteCategory.MULTI_SECTION_FORM,
        whySelected="Public questionnaire exposing radio groups, checkboxes, and multi-step sections.",
        expectedDomCharacteristics=["Multi-step form sections", "Radio button groups", "Feedback textarea"],
        permittedOperations=["DOM extraction", "Accessibility audit", "Guided Mode stage reasoning"],
        prohibitedOperations=["Live submission of feedback", "Personal data entry"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.PARTIAL_SUPPORT,
    ),
    RealSiteEntry(
        id="site-g-govuk-passport",
        name="GOV.UK - Passport Guidance Page",
        publicUrl="https://www.gov.uk/apply-renew-passport",
        category=SiteCategory.GOV_INSTITUTIONAL,
        whySelected="Public government information portal featuring step-by-step guidance and document lists.",
        expectedDomCharacteristics=["Numbered step navigation", "Document requirements list", "Start button link"],
        permittedOperations=["DOM extraction", "Accessibility audit", "Document requirement recognition"],
        prohibitedOperations=["External portal account creation", "Form submission"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.READ_ONLY_SUPPORT,
    ),
    RealSiteEntry(
        id="site-h-bls-data-table",
        name="US Bureau of Labor Statistics - Employment Data Table",
        publicUrl="https://www.bls.gov/news.release/empsit.t01.htm",
        category=SiteCategory.TABLES_DATA,
        whySelected="Complex public statistical data table with hierarchical column and row headers.",
        expectedDomCharacteristics=["HTML table with caption", "Hierarchical th elements", "Tabular data"],
        permittedOperations=["DOM extraction", "Table accessibility inspection", "Explain Anything"],
        prohibitedOperations=["Any DOM mutation", "Bulk data harvesting"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.READ_ONLY_SUPPORT,
    ),
    RealSiteEntry(
        id="site-i-w3c-modal-dialog",
        name="W3C WAI-ARIA - Modal Dialog Example",
        publicUrl="https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/",
        category=SiteCategory.MODAL_DIALOG,
        whySelected="Accessible interactive modal pattern with role='dialog' and aria-modal='true'.",
        expectedDomCharacteristics=["Dialog trigger button", "role='dialog' overlay", "Modal inputs"],
        permittedOperations=["DOM extraction", "Modal state accessibility audit", "Controlled trigger check"],
        prohibitedOperations=["Live external submission", "Arbitrary script injection"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.PARTIAL_SUPPORT,
    ),
    RealSiteEntry(
        id="site-j-w3c-tabs-pattern",
        name="W3C WAI-ARIA - Tabs Pattern Example",
        publicUrl="https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs/",
        category=SiteCategory.DYNAMIC_RENDERED,
        whySelected="Client-side dynamic tab interface toggling tabpanels dynamically.",
        expectedDomCharacteristics=["role='tablist'", "role='tab'", "role='tabpanel'"],
        permittedOperations=["DOM extraction", "Dynamic tab accessibility audit", "Safe focus switching"],
        prohibitedOperations=["Arbitrary script injection", "Uncontrolled polling"],
        dateTested="2026-10-07",
        expectedCompatibility=CompatibilityClassification.PARTIAL_SUPPORT,
    ),
]


def normalize_url(url_str: str) -> str:
    try:
        parsed = urlparse(url_str)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/").lower()
    except Exception:
        return url_str.strip().rstrip("/").lower()


def is_site_allowlisted(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    target = normalize_url(url)
    return any(normalize_url(e.publicUrl) == target for e in REAL_SITE_ALLOWLIST)


def get_allowlisted_site(url: str) -> Optional[RealSiteEntry]:
    if not url or not isinstance(url, str):
        return None
    target = normalize_url(url)
    for e in REAL_SITE_ALLOWLIST:
        if normalize_url(e.publicUrl) == target:
            return e
    return None


def validate_site_url(url: str) -> Tuple[bool, Optional[RealSiteEntry], Optional[str]]:
    if not url or not isinstance(url, str):
        return False, None, "URL must be a non-empty string."
    site = get_allowlisted_site(url)
    if not site:
        return False, None, f"URL '{url}' is NOT in the Phase 14 real-site allowlist."
    return True, site, None
