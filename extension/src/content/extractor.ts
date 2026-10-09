/**
 * ACCESSOS Page Metadata Extractor
 * Extracts foundational metadata locally from the active webpage document.
 * Strictly passive and privacy-preserving: no text harvesting or transmission.
 */
import type { PageMetadata } from '../core/types/index';

export function extractPageMetadata(
  doc: Document = document,
  loc: Location = window.location
): PageMetadata {
  // Count basic interactive elements: input, textarea, select, button, links
  const interactiveElements = doc.querySelectorAll('input, textarea, select, button, a');

  return {
    title: doc.title || '',
    url: loc.href || '',
    hostname: loc.hostname || '',
    pathname: loc.pathname || '',
    pageType: 'webpage',
    interactiveElementCount: interactiveElements.length,
  };
}
