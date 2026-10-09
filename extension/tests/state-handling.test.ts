import { describe, it, expect } from 'vitest';
import { isRestrictedUrl, formatDisplayUrl } from '../src/popup/popup';
import type { PageMetadata, PopupState } from '../src/core/types/index';

describe('Error and State Handling', () => {
  it('correctly detects restricted or unsupported browser URLs', () => {
    // Restricted internal schemes
    expect(isRestrictedUrl('chrome://extensions/')).toBe(true);
    expect(isRestrictedUrl('chrome://settings/')).toBe(true);
    expect(isRestrictedUrl('edge://extensions/')).toBe(true);
    expect(isRestrictedUrl('about:blank')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abcdef12345/popup.html')).toBe(true);
    expect(isRestrictedUrl('devtools://devtools/bundled/inspector.html')).toBe(true);
    expect(isRestrictedUrl('view-source:https://example.com')).toBe(true);
    expect(isRestrictedUrl('')).toBe(true);
    expect(isRestrictedUrl(undefined)).toBe(true);

    // Standard accessible web pages
    expect(isRestrictedUrl('https://example.com/login')).toBe(false);
    expect(isRestrictedUrl('http://localhost:3000')).toBe(false);
    expect(isRestrictedUrl('http://127.0.0.1:8000')).toBe(false);
    expect(isRestrictedUrl('file:///C:/Users/shiva/projects/index.html')).toBe(false);
  });

  it('formats display URL with hostname and path as specified', () => {
    const metadataWithStandardPath: PageMetadata = {
      title: 'Portal',
      url: 'https://service.gov/apply/form?step=1',
      hostname: 'service.gov',
      pathname: '/apply/form',
      pageType: 'webpage',
      interactiveElementCount: 5,
    };
    expect(formatDisplayUrl(metadataWithStandardPath)).toBe('service.gov/apply/form');

    const metadataRootPath: PageMetadata = {
      title: 'Home',
      url: 'https://service.gov/',
      hostname: 'service.gov',
      pathname: '/',
      pageType: 'webpage',
      interactiveElementCount: 1,
    };
    expect(formatDisplayUrl(metadataRootPath)).toBe('service.gov/');

    const metadataEmptyHostname: PageMetadata = {
      title: 'Local File',
      url: 'file:///path/to/test.html',
      hostname: '',
      pathname: '/path/to/test.html',
      pageType: 'webpage',
      interactiveElementCount: 2,
    };
    expect(formatDisplayUrl(metadataEmptyHostname)).toBe('file:///path/to/test.html');
  });

  it('validates state transitions and representation types', () => {
    const validStates: PopupState[] = [
      'IDLE',
      'ANALYZING',
      'SUCCESS',
      'UNSUPPORTED_PAGE',
      'ERROR',
    ];

    expect(validStates).toHaveLength(5);
    validStates.forEach((state) => {
      expect(typeof state).toBe('string');
    });
  });
});
