import { describe, it, expect } from 'vitest';
import {
  MessageType,
  createMessage,
  isAnalyzePageMessage,
  isPageAnalysisResultMessage,
  type PageAnalysisResponsePayload,
} from '../src/core/messaging/index';
import type { PageMetadata } from '../src/core/types/index';

describe('Message Protocol Validation', () => {
  it('creates valid ANALYZE_PAGE message adhering to BaseMessage interface', () => {
    const msg = createMessage(MessageType.ANALYZE_PAGE);

    expect(msg.type).toBe(MessageType.ANALYZE_PAGE);
    expect(typeof msg.timestamp).toBe('number');
    expect(msg.timestamp).toBeLessThanOrEqual(Date.now());
    expect(isAnalyzePageMessage(msg)).toBe(true);
  });

  it('validates successful PAGE_ANALYSIS_RESULT payload', () => {
    const mockMetadata: PageMetadata = {
      title: 'Sample Portal',
      url: 'https://example.com/portal',
      hostname: 'example.com',
      pathname: '/portal',
      pageType: 'webpage',
      interactiveElementCount: 14,
    };

    const payload: PageAnalysisResponsePayload = {
      success: true,
      metadata: mockMetadata,
    };

    const resultMsg = createMessage(MessageType.PAGE_ANALYSIS_RESULT, payload);

    expect(isPageAnalysisResultMessage(resultMsg)).toBe(true);
    expect(resultMsg.payload?.success).toBe(true);
    if (resultMsg.payload && resultMsg.payload.success) {
      expect(resultMsg.payload.metadata.title).toBe('Sample Portal');
      expect(resultMsg.payload.metadata.interactiveElementCount).toBe(14);
    }
  });

  it('validates error PAGE_ANALYSIS_RESULT payload', () => {
    const payload: PageAnalysisResponsePayload = {
      success: false,
      error: 'DOM tree inaccessible',
    };

    const resultMsg = createMessage(MessageType.PAGE_ANALYSIS_RESULT, payload);

    expect(isPageAnalysisResultMessage(resultMsg)).toBe(true);
    expect(resultMsg.payload?.success).toBe(false);
    if (resultMsg.payload && !resultMsg.payload.success) {
      expect(resultMsg.payload.error).toBe('DOM tree inaccessible');
    }
  });

  it('rejects malformed messages with type guards', () => {
    expect(isAnalyzePageMessage(null)).toBe(false);
    expect(isAnalyzePageMessage({})).toBe(false);
    expect(isAnalyzePageMessage({ type: 'UNKNOWN_TYPE' })).toBe(false);

    expect(isPageAnalysisResultMessage(null)).toBe(false);
    expect(isPageAnalysisResultMessage({ type: MessageType.PAGE_ANALYSIS_RESULT })).toBe(false);
    expect(isPageAnalysisResultMessage({ type: MessageType.PING, payload: {} })).toBe(false);
  });
});
