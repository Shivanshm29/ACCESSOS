"""
Unit tests for ACCESSOS Analytics Schemas (Phase 13)
"""

import pytest
from pydantic import ValidationError
from app.analytics.schemas import (
    AnalyticsEventType,
    DurationBucket,
    CoarseResultCategory,
    CoarseErrorCategory,
    AnonymizedTargetCategory,
    AnalyticsEvent,
    AnalyticsSession,
    AnalyticsAggregates,
)


def test_analytics_event_valid():
    event = AnalyticsEvent(
        eventId="evt-123",
        eventType=AnalyticsEventType.ACCESSIBILITY_ANALYSIS,
        timestamp=1690000000000,
        sessionId="sess-456",
        feature="accessibility",
        durationBucket=DurationBucket.LESS_THAN_1S,
        success=True,
        coarseResultCategory=CoarseResultCategory.SUCCESS,
        anonymizedTargetCategory=AnonymizedTargetCategory.SECTION,
        countMetrics={"totalBarriers": 3, "score": 75},
        version=1,
    )
    assert event.eventId == "evt-123"
    assert event.eventType == AnalyticsEventType.ACCESSIBILITY_ANALYSIS
    assert event.feature == "accessibility"
    assert event.durationBucket == DurationBucket.LESS_THAN_1S
    assert event.countMetrics["score"] == 75


def test_analytics_event_rejects_extra_fields():
    with pytest.raises(ValidationError):
        AnalyticsEvent(
            eventId="evt-123",
            eventType=AnalyticsEventType.ACCESSIBILITY_ANALYSIS,
            timestamp=1690000000000,
            sessionId="sess-456",
            feature="accessibility",
            password="secret_password",  # Disallowed extra field
        )


def test_analytics_session_defaults():
    session = AnalyticsSession(
        sessionId="sess-xyz",
        startedAt=1690000000000,
        lastActiveAt=1690000010000,
        eventCount=5,
    )
    assert session.sessionId == "sess-xyz"
    assert session.eventCount == 5


def test_analytics_aggregates_defaults():
    aggregates = AnalyticsAggregates()
    assert aggregates.totalEvents == 0
    assert aggregates.accessibility.analyses == 0
    assert aggregates.guidedMode.started == 0
    assert aggregates.explainAnything.requests == 0
    assert aggregates.documents.analyzed == 0
    assert aggregates.completion.checks == 0
    assert aggregates.interactions.requested == 0
