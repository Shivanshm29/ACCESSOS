"""
Unit tests for ACCESSOS Analytics Sanitizer & Aggregator (Phase 13)
"""

from app.analytics.schemas import (
    AnalyticsEventType,
    DurationBucket,
    CoarseResultCategory,
    AnonymizedTargetCategory,
    AnalyticsAggregates,
)
from app.analytics.sanitizer import (
    get_duration_bucket,
    sanitize_analytics_event,
    update_aggregates,
)


def test_get_duration_bucket():
    assert get_duration_bucket(500) == DurationBucket.LESS_THAN_1S
    assert get_duration_bucket(2500) == DurationBucket.ONE_TO_FIVE_S
    assert get_duration_bucket(8000) == DurationBucket.FIVE_TO_FIFTEEN_S
    assert get_duration_bucket(20000) == DurationBucket.FIFTEEN_TO_THIRTY_S
    assert get_duration_bucket(45000) == DurationBucket.THIRTY_TO_SIXTY_S
    assert get_duration_bucket(75000) == DurationBucket.OVER_SIXTY_S


def test_sanitize_analytics_event_valid():
    raw = {
        "eventId": "evt-01",
        "eventType": "ACCESSIBILITY_ANALYSIS",
        "timestamp": 1690000000000,
        "sessionId": "sess-01",
        "feature": "accessibility",
        "success": True,
        "anonymizedTargetCategory": "section",
        "countMetrics": {"totalBarriers": 2},
        "version": 1,
    }
    event = sanitize_analytics_event(raw)
    assert event is not None
    assert event.eventId == "evt-01"
    assert event.eventType == AnalyticsEventType.ACCESSIBILITY_ANALYSIS


def test_sanitize_analytics_event_rejects_passwords_and_tokens():
    raw_with_password = {
        "eventId": "evt-02",
        "eventType": "ACCESSIBILITY_ANALYSIS",
        "timestamp": 1690000000000,
        "sessionId": "sess-01",
        "feature": "accessibility",
        "password": "my_cleartext_password",
    }
    assert sanitize_analytics_event(raw_with_password) is None

    raw_with_token = {
        "eventId": "evt-03",
        "eventType": "ACCESSIBILITY_ANALYSIS",
        "timestamp": 1690000000000,
        "sessionId": "sess-01",
        "feature": "accessibility",
        "authToken": "bearer xyz123",
    }
    assert sanitize_analytics_event(raw_with_token) is None


def test_sanitize_analytics_event_rejects_scripts():
    raw_with_script = {
        "eventId": "evt-04",
        "eventType": "ACCESSIBILITY_ANALYSIS",
        "timestamp": 1690000000000,
        "sessionId": "sess-01",
        "feature": "accessibility",
        "stageId": "<script>alert(1)</script>",
    }
    assert sanitize_analytics_event(raw_with_script) is None


def test_sanitize_analytics_event_anonymizes_css_selectors():
    raw_with_css = {
        "eventId": "evt-05",
        "eventType": "SAFE_INTERACTION_CONFIRMED",
        "timestamp": 1690000000000,
        "sessionId": "sess-01",
        "feature": "interaction",
        "anonymizedTargetCategory": "#submit-btn > .active",
        "version": 1,
    }
    event = sanitize_analytics_event(raw_with_css)
    assert event is not None
    assert event.anonymizedTargetCategory == AnonymizedTargetCategory.UNKNOWN


def test_update_aggregates_mathematical_consistency():
    aggregates = AnalyticsAggregates()
    raw = {
        "eventId": "evt-01",
        "eventType": "ACCESSIBILITY_ANALYSIS",
        "timestamp": 1690000000000,
        "sessionId": "sess-01",
        "feature": "accessibility",
        "durationBucket": "<1s",
        "success": True,
        "countMetrics": {"critical": 1, "high": 2, "medium": 0, "low": 1, "score": 80},
        "version": 1,
    }
    event = sanitize_analytics_event(raw)
    assert event is not None

    next_agg = update_aggregates(aggregates, event)
    assert next_agg.totalEvents == 1
    assert next_agg.accessibility.analyses == 1
    assert next_agg.accessibility.barriers.critical == 1
    assert next_agg.accessibility.barriers.high == 2
    assert next_agg.accessibility.barriers.low == 1
    assert next_agg.accessibility.totalBarriers == 4
    assert next_agg.accessibility.averageScore == 80
    assert next_agg.durationBuckets["<1s"] == 1
