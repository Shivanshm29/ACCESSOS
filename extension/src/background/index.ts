/**
 * ACCESSOS Background Service Worker
 * Manages extension lifecycle, cross-tab state, and backend relay.
 */
import {
  MessageType,
  createMessage,
  validateMessageEnvelope,
} from '../core/messaging/index';
import { analyticsService } from '../analytics/index';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ACCESSOS] Background service worker initialized.');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const envelopeValidation = validateMessageEnvelope(message);
  if (!envelopeValidation.valid) {
    sendResponse({ success: false, error: envelopeValidation.error, status: 'REJECTED' });
    return false;
  }

  if (message && message.type === MessageType.PING) {
    sendResponse(createMessage(MessageType.PONG, { status: 'ready' }));
    return true;
  }

  if (message && message.type === MessageType.GET_ANALYTICS) {
    void (async () => {
      const aggregates = await analyticsService.getAggregates();
      const session = analyticsService.getSession();
      const recentEvents = await analyticsService.getRecentEvents();
      sendResponse(
        createMessage(MessageType.ANALYTICS_DATA, {
          success: true,
          aggregates,
          session,
          recentEvents,
        })
      );
    })();
    return true;
  }

  if (message && message.type === MessageType.CLEAR_ANALYTICS) {
    void (async () => {
      await analyticsService.clearAnalytics();
      sendResponse(createMessage(MessageType.ANALYTICS_CLEARED, { success: true }));
    })();
    return true;
  }

  if (message && message.type === MessageType.RECORD_ANALYTICS_EVENT) {
    void (async () => {
      const accepted = await analyticsService.recordEvent(message.payload);
      sendResponse({ success: accepted });
    })();
    return true;
  }

  return true;
});
