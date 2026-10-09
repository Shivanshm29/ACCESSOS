"""
Backend tests for Phase 14 Real-Site Schemas and Allowlist.
"""

import pytest
from app.realsite.schemas import (
    SiteCategory,
    CompatibilityClassification,
    TestMode,
    RealSiteEntry,
    RealSiteValidationResult,
)
from app.realsite.allowlist import (
    REAL_SITE_ALLOWLIST,
    is_site_allowlisted,
    get_allowlisted_site,
    validate_site_url,
)


def test_allowlist_contains_ten_categories():
    assert len(REAL_SITE_ALLOWLIST) == 10
    categories = {e.category for e in REAL_SITE_ALLOWLIST}
    assert len(categories) == 10
    assert SiteCategory.STATIC_INFORMATIONAL in categories
    assert SiteCategory.DOCUMENTATION_HELP in categories
    assert SiteCategory.ARTICLE_CONTENT in categories
    assert SiteCategory.SEARCH_INTERFACE in categories
    assert SiteCategory.FORM_NO_SUBMISSION in categories
    assert SiteCategory.MULTI_SECTION_FORM in categories
    assert SiteCategory.GOV_INSTITUTIONAL in categories
    assert SiteCategory.TABLES_DATA in categories
    assert SiteCategory.MODAL_DIALOG in categories
    assert SiteCategory.DYNAMIC_RENDERED in categories


def test_is_site_allowlisted_accepts_valid_url():
    assert is_site_allowlisted("https://en.wikipedia.org/wiki/Web_accessibility")
    assert is_site_allowlisted("https://developer.mozilla.org/en-US/docs/Learn/Forms")
    assert is_site_allowlisted("https://www.w3.org/WAI/tutorials/forms/example/")


def test_is_site_allowlisted_rejects_arbitrary_urls():
    assert not is_site_allowlisted("https://evil.com/login")
    assert not is_site_allowlisted("https://bank.example.com/transfer")
    assert not is_site_allowlisted("http://localhost:9999")
    assert not is_site_allowlisted("")


def test_validate_site_url_returns_allow_decision():
    allowed, site, err = validate_site_url("https://en.wikipedia.org/wiki/Web_accessibility")
    assert allowed is True
    assert site is not None
    assert site.id == "site-a-wikipedia"
    assert err is None

    allowed_bad, site_bad, err_bad = validate_site_url("https://unapproved.example.com")
    assert allowed_bad is False
    assert site_bad is None
    assert "NOT in the Phase 14 real-site allowlist" in err_bad


def test_realsite_validation_result_serialization():
    res = RealSiteValidationResult(
        siteId="site-a-wikipedia",
        siteName="Wikipedia - Web Accessibility",
        publicUrl="https://en.wikipedia.org/wiki/Web_accessibility",
        category=SiteCategory.STATIC_INFORMATIONAL,
        compatibility=CompatibilityClassification.READ_ONLY_SUPPORT,
    )
    dumped = res.model_dump()
    assert dumped["siteId"] == "site-a-wikipedia"
    assert dumped["compatibility"] == "READ_ONLY_SUPPORT"
    assert dumped["securityVerified"] is True
