/**
 * ACCESSOS Analytics Aggregator (Phase 13)
 *
 * Implements deterministic in-memory and local aggregation of privacy-safe events.
 * Converts individual events into coarse metrics without storing user details.
 */

import type {
  AnalyticsAggregates,
  AnalyticsEvent,
} from './types';
import { AnalyticsEventType } from './types';

export function updateAggregates(
  current: AnalyticsAggregates,
  event: AnalyticsEvent
): AnalyticsAggregates {
  const next: AnalyticsAggregates = JSON.parse(JSON.stringify(current));

  next.totalEvents += 1;
  next.lastUpdated = event.timestamp || Date.now();

  // Duration Buckets
  if (event.durationBucket && next.durationBuckets[event.durationBucket] !== undefined) {
    next.durationBuckets[event.durationBucket] += 1;
  }

  // Error counts
  if (event.errorCode) {
    next.errors[event.errorCode] = (next.errors[event.errorCode] || 0) + 1;
  }

  // Feature / Event Type specific aggregations
  switch (event.eventType) {
    case AnalyticsEventType.ACCESSIBILITY_ANALYSIS: {
      next.accessibility.analyses += 1;
      if (event.countMetrics) {
        const crit = event.countMetrics.critical || 0;
        const high = event.countMetrics.high || 0;
        const med = event.countMetrics.medium || 0;
        const low = event.countMetrics.low || 0;
        const total = event.countMetrics.totalBarriers !== undefined
          ? event.countMetrics.totalBarriers
          : crit + high + med + low;

        next.accessibility.barriers.critical += crit;
        next.accessibility.barriers.high += high;
        next.accessibility.barriers.medium += med;
        next.accessibility.barriers.low += low;
        next.accessibility.totalBarriers += total;

        if (total > 0) {
          next.accessibility.pagesWithBarriers += 1;
        }

        if (typeof event.countMetrics.score === 'number') {
          next.accessibility.scoreSum += event.countMetrics.score;
          next.accessibility.scoreCount += 1;
          next.accessibility.averageScore = Math.round(
            next.accessibility.scoreSum / next.accessibility.scoreCount
          );
        }
      }
      break;
    }

    case AnalyticsEventType.GUIDED_MODE_STARTED: {
      next.guidedMode.started += 1;
      break;
    }

    case AnalyticsEventType.GUIDED_STEP_COMPLETED: {
      next.guidedMode.stepsCompleted += 1;
      break;
    }

    case AnalyticsEventType.GUIDED_MODE_COMPLETED: {
      next.guidedMode.completed += 1;
      if (next.guidedMode.started > 0) {
        next.guidedMode.completionRate = Math.round(
          (next.guidedMode.completed / next.guidedMode.started) * 100
        );
      }
      break;
    }

    case AnalyticsEventType.USER_EXITED_FEATURE: {
      if (event.feature === 'guided') {
        next.guidedMode.stepsExited += 1;
      } else if (event.feature === 'explain') {
        next.explainAnything.exited += 1;
      }
      break;
    }

    case AnalyticsEventType.EXPLANATION_REQUESTED: {
      next.explainAnything.requests += 1;
      if (event.coarseResultCategory === 'SUCCESS') {
        next.explainAnything.completed += 1;
      }
      if (event.stageId === 'SIMPLE' || event.stageId === 'STANDARD' || event.stageId === 'DETAILED') {
        next.explainAnything.modes[event.stageId] += 1;
      } else if (event.countMetrics?.mode === 1) {
        next.explainAnything.modes.SIMPLE += 1;
      } else if (event.countMetrics?.mode === 2) {
        next.explainAnything.modes.STANDARD += 1;
      } else if (event.countMetrics?.mode === 3) {
        next.explainAnything.modes.DETAILED += 1;
      } else {
        next.explainAnything.modes.STANDARD += 1;
      }
      break;
    }

    case AnalyticsEventType.DOCUMENT_ANALYSIS: {
      next.documents.analyzed += 1;
      if (event.success) {
        next.documents.successful += 1;
      } else {
        next.documents.failed += 1;
      }
      if (event.coarseResultCategory === 'MATCH') next.documents.matches += 1;
      else if (event.coarseResultCategory === 'PARTIAL_MATCH') next.documents.partialMatches += 1;
      else if (event.coarseResultCategory === 'NO_MATCH') next.documents.noMatches += 1;
      else if (event.coarseResultCategory === 'AMBIGUOUS') next.documents.ambiguous += 1;
      else if (event.coarseResultCategory === 'NOT_ENOUGH_EVIDENCE') next.documents.notEnoughEvidence += 1;
      break;
    }

    case AnalyticsEventType.DOCUMENT_REQUIREMENT_MATCH: {
      if (event.coarseResultCategory === 'MATCH') next.documents.matches += 1;
      else if (event.coarseResultCategory === 'PARTIAL_MATCH') next.documents.partialMatches += 1;
      else if (event.coarseResultCategory === 'NO_MATCH') next.documents.noMatches += 1;
      else if (event.coarseResultCategory === 'AMBIGUOUS') next.documents.ambiguous += 1;
      else if (event.coarseResultCategory === 'NOT_ENOUGH_EVIDENCE') next.documents.notEnoughEvidence += 1;
      break;
    }

    case AnalyticsEventType.COMPLETION_CHECK: {
      next.completion.checks += 1;
      if (event.coarseResultCategory === 'COMPLETE') next.completion.complete += 1;
      else if (event.coarseResultCategory === 'INCOMPLETE') next.completion.incomplete += 1;
      else if (event.coarseResultCategory === 'BLOCKED') next.completion.blocked += 1;
      else if (event.coarseResultCategory === 'INVALID') next.completion.invalid += 1;

      if (event.countMetrics) {
        if (typeof event.countMetrics.blockingIssues === 'number') {
          next.completion.totalBlockers += event.countMetrics.blockingIssues;
        }
        if (typeof event.countMetrics.warnings === 'number') {
          next.completion.totalWarnings += event.countMetrics.warnings;
        }
        if (typeof event.countMetrics.percent === 'number') {
          const pct = event.countMetrics.percent;
          if (pct >= 100) next.completion.progressBuckets['100%'] += 1;
          else if (pct >= 76) next.completion.progressBuckets['76-99%'] += 1;
          else if (pct >= 51) next.completion.progressBuckets['51-75%'] += 1;
          else if (pct >= 26) next.completion.progressBuckets['26-50%'] += 1;
          else next.completion.progressBuckets['0-25%'] += 1;
        }
      }
      break;
    }

    case AnalyticsEventType.COMPLETION_ACHIEVED: {
      next.completion.complete += 1;
      if (event.countMetrics?.checksBeforeCompletion) {
        next.completion.checksBeforeCompletion = event.countMetrics.checksBeforeCompletion;
      }
      break;
    }

    case AnalyticsEventType.COMPLETION_BLOCKED: {
      next.completion.blocked += 1;
      break;
    }

    case AnalyticsEventType.SAFE_INTERACTION_CONFIRMED: {
      next.interactions.requested += 1;
      next.interactions.confirmed += 1;
      applyInteractionActionCategory(next, event);
      break;
    }

    case AnalyticsEventType.SAFE_INTERACTION_BLOCKED: {
      next.interactions.requested += 1;
      next.interactions.blocked += 1;
      applyInteractionActionCategory(next, event);
      break;
    }

    case AnalyticsEventType.ERROR: {
      if (event.coarseResultCategory === 'CANCELLED') {
        next.interactions.cancelled += 1;
      }
      break;
    }

    default:
      break;
  }

  return next;
}

function applyInteractionActionCategory(
  aggregates: AnalyticsAggregates,
  event: AnalyticsEvent
): void {
  const target = event.anonymizedTargetCategory;
  if (target === 'button' || target === 'link') {
    aggregates.interactions.byAction.CLICK += 1;
  } else if (target === 'input') {
    aggregates.interactions.byAction.INPUT += 1;
  } else if (target === 'select' || target === 'checkbox' || target === 'radio') {
    aggregates.interactions.byAction.SELECT += 1;
  } else if (target === 'section') {
    aggregates.interactions.byAction.HIGHLIGHT += 1;
  } else {
    aggregates.interactions.byAction.OTHER += 1;
  }
}
