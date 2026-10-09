"""
ACCESSOS Analytics Sanitizer & Aggregator (Phase 13)
Ensures strict privacy protection, rejecting sensitive keywords and bounding payload sizes.
"""

import re
import json
from typing import Dict, Any, Optional
from app.analytics.schemas import (
    AnalyticsEvent,
    AnalyticsAggregates,
    DurationBucket,
    AnalyticsEventType,
)

MAX_ANALYTICS_EVENT_PAYLOAD_BYTES = 4096

FORBIDDEN_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"passwd", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"otp", re.IGNORECASE),
    re.compile(r"cvv", re.IGNORECASE),
    re.compile(r"card", re.IGNORECASE),
    re.compile(r"bank", re.IGNORECASE),
    re.compile(r"account", re.IGNORECASE),
    re.compile(r"aadhaar", re.IGNORECASE),
    re.compile(r"ssn", re.IGNORECASE),
    re.compile(r"bearer\s+", re.IGNORECASE),
    re.compile(r"<script", re.IGNORECASE),
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"eval\(", re.IGNORECASE),
]


def get_duration_bucket(duration_ms: float) -> DurationBucket:
    if duration_ms < 1000:
        return DurationBucket.LESS_THAN_1S
    if duration_ms < 5000:
        return DurationBucket.ONE_TO_FIVE_S
    if duration_ms < 15000:
        return DurationBucket.FIVE_TO_FIFTEEN_S
    if duration_ms < 30000:
        return DurationBucket.FIFTEEN_TO_THIRTY_S
    if duration_ms < 60000:
        return DurationBucket.THIRTY_TO_SIXTY_S
    return DurationBucket.OVER_SIXTY_S


def sanitize_analytics_event(raw: Any) -> Optional[AnalyticsEvent]:
    if not isinstance(raw, dict):
        return None

    try:
        serialized = json.dumps(raw)
    except Exception:
        return None

    if len(serialized) > MAX_ANALYTICS_EVENT_PAYLOAD_BYTES:
        return None

    # Check for executable code or scripts
    if "<script" in serialized or "javascript:" in serialized or "eval(" in serialized:
        return None

    # Check if raw data contains forbidden sensitive keys
    for k in raw.keys():
        for pat in FORBIDDEN_PATTERNS:
            if pat.search(str(k)):
                return None

    # Anonymized target check: no CSS selectors or XPath
    target = raw.get("anonymizedTargetCategory")
    if target and any(c in str(target) for c in ["#", ".", "[", "/", ">", "$"]):
        raw["anonymizedTargetCategory"] = "unknown"

    try:
        return AnalyticsEvent.model_validate(raw)
    except Exception:
        return None


def update_aggregates(
    current: AnalyticsAggregates,
    event: AnalyticsEvent,
) -> AnalyticsAggregates:
    data = current.model_dump()
    data["totalEvents"] = data.get("totalEvents", 0) + 1
    data["lastUpdated"] = event.timestamp

    if event.durationBucket:
        bucket_key = event.durationBucket.value
        data["durationBuckets"][bucket_key] = data["durationBuckets"].get(bucket_key, 0) + 1

    if event.errorCode:
        err_key = event.errorCode.value
        data["errors"][err_key] = data["errors"].get(err_key, 0) + 1

    ev_type = event.eventType

    if ev_type == AnalyticsEventType.ACCESSIBILITY_ANALYSIS:
        data["accessibility"]["analyses"] += 1
        if event.countMetrics:
            crit = event.countMetrics.get("critical", 0)
            high = event.countMetrics.get("high", 0)
            med = event.countMetrics.get("medium", 0)
            low = event.countMetrics.get("low", 0)
            total = event.countMetrics.get("totalBarriers", crit + high + med + low)

            data["accessibility"]["barriers"]["critical"] += crit
            data["accessibility"]["barriers"]["high"] += high
            data["accessibility"]["barriers"]["medium"] += med
            data["accessibility"]["barriers"]["low"] += low
            data["accessibility"]["totalBarriers"] += total

            if total > 0:
                data["accessibility"]["pagesWithBarriers"] += 1

            if "score" in event.countMetrics:
                data["accessibility"]["scoreSum"] += event.countMetrics["score"]
                data["accessibility"]["scoreCount"] += 1
                data["accessibility"]["averageScore"] = round(
                    data["accessibility"]["scoreSum"] / data["accessibility"]["scoreCount"]
                )

    elif ev_type == AnalyticsEventType.GUIDED_MODE_STARTED:
        data["guidedMode"]["started"] += 1

    elif ev_type == AnalyticsEventType.GUIDED_STEP_COMPLETED:
        data["guidedMode"]["stepsCompleted"] += 1

    elif ev_type == AnalyticsEventType.GUIDED_MODE_COMPLETED:
        data["guidedMode"]["completed"] += 1
        started = data["guidedMode"]["started"]
        if started > 0:
            data["guidedMode"]["completionRate"] = round(
                (data["guidedMode"]["completed"] / started) * 100
            )

    elif ev_type == AnalyticsEventType.USER_EXITED_FEATURE:
        if event.feature == "guided":
            data["guidedMode"]["stepsExited"] += 1
        elif event.feature == "explain":
            data["explainAnything"]["exited"] += 1

    elif ev_type == AnalyticsEventType.EXPLANATION_REQUESTED:
        data["explainAnything"]["requests"] += 1
        if event.coarseResultCategory and event.coarseResultCategory.value == "SUCCESS":
            data["explainAnything"]["completed"] += 1
        if event.stageId in ("SIMPLE", "STANDARD", "DETAILED"):
            data["explainAnything"]["modes"][event.stageId] += 1
        else:
            data["explainAnything"]["modes"]["STANDARD"] += 1

    elif ev_type == AnalyticsEventType.DOCUMENT_ANALYSIS:
        data["documents"]["analyzed"] += 1
        if event.success:
            data["documents"]["successful"] += 1
        else:
            data["documents"]["failed"] += 1

        if event.coarseResultCategory:
            cat = event.coarseResultCategory.value
            if cat == "MATCH":
                data["documents"]["matches"] += 1
            elif cat == "PARTIAL_MATCH":
                data["documents"]["partialMatches"] += 1
            elif cat == "NO_MATCH":
                data["documents"]["noMatches"] += 1
            elif cat == "AMBIGUOUS":
                data["documents"]["ambiguous"] += 1
            elif cat == "NOT_ENOUGH_EVIDENCE":
                data["documents"]["notEnoughEvidence"] += 1

    elif ev_type == AnalyticsEventType.COMPLETION_CHECK:
        data["completion"]["checks"] += 1
        if event.coarseResultCategory:
            cat = event.coarseResultCategory.value
            if cat == "COMPLETE":
                data["completion"]["complete"] += 1
            elif cat == "INCOMPLETE":
                data["completion"]["incomplete"] += 1
            elif cat == "BLOCKED":
                data["completion"]["blocked"] += 1
            elif cat == "INVALID":
                data["completion"]["invalid"] += 1

        if event.countMetrics:
            if "blockingIssues" in event.countMetrics:
                data["completion"]["totalBlockers"] += event.countMetrics["blockingIssues"]
            if "warnings" in event.countMetrics:
                data["completion"]["totalWarnings"] += event.countMetrics["warnings"]
            if "percent" in event.countMetrics:
                pct = event.countMetrics["percent"]
                if pct >= 100:
                    data["completion"]["progressBuckets"]["100%"] += 1
                elif pct >= 76:
                    data["completion"]["progressBuckets"]["76-99%"] += 1
                elif pct >= 51:
                    data["completion"]["progressBuckets"]["51-75%"] += 1
                elif pct >= 26:
                    data["completion"]["progressBuckets"]["26-50%"] += 1
                else:
                    data["completion"]["progressBuckets"]["0-25%"] += 1

    elif ev_type == AnalyticsEventType.SAFE_INTERACTION_CONFIRMED:
        data["interactions"]["requested"] += 1
        data["interactions"]["confirmed"] += 1
        _apply_interaction_action(data, event)

    elif ev_type == AnalyticsEventType.SAFE_INTERACTION_BLOCKED:
        data["interactions"]["requested"] += 1
        data["interactions"]["blocked"] += 1
        _apply_interaction_action(data, event)

    return AnalyticsAggregates.model_validate(data)


def _apply_interaction_action(data: Dict[str, Any], event: AnalyticsEvent) -> None:
    target = event.anonymizedTargetCategory.value if event.anonymizedTargetCategory else "unknown"
    if target in ("button", "link"):
        data["interactions"]["byAction"]["CLICK"] += 1
    elif target == "input":
        data["interactions"]["byAction"]["INPUT"] += 1
    elif target in ("select", "checkbox", "radio"):
        data["interactions"]["byAction"]["SELECT"] += 1
    elif target == "section":
        data["interactions"]["byAction"]["HIGHLIGHT"] += 1
    else:
        data["interactions"]["byAction"]["OTHER"] += 1
