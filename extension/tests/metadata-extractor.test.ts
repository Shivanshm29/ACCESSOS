import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageMetadata } from '../src/content/extractor';

describe('Page Metadata Extraction', () => {
  it('extracts exactly 9 interactive elements from specified test DOM (2 inputs, 1 textarea, 1 select, 2 buttons, 3 links)', () => {
    const window = new Window({
      url: 'https://service.gov.example/portal/apply',
    });
    const document = window.document;

    document.title = 'Application Form';
    document.body.innerHTML = `
      <form id="test-form">
        <!-- 2 inputs -->
        <input type="text" name="first_name" />
        <input type="number" name="age" />

        <!-- 1 textarea -->
        <textarea name="comments"></textarea>

        <!-- 1 select -->
        <select name="country">
          <option value="us">United States</option>
        </select>

        <!-- 2 buttons -->
        <button type="submit">Submit</button>
        <button type="button">Reset</button>

        <!-- 3 links -->
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/faq">FAQ</a>
      </form>
    `;

    const metadata = extractPageMetadata(document as unknown as Document, window.location as unknown as Location);

    expect(metadata.interactiveElementCount).toBe(9);
  });

  it('correctly extracts metadata from tests/fixtures/accessos-test-page.html', () => {
    const fixturePath = path.resolve(__dirname, '../../tests/fixtures/accessos-test-page.html');
    const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

    const window = new Window({
      url: 'http://localhost:3000/fixtures/accessos-test-page.html',
    });
    const document = window.document;
    document.write(fixtureHtml);

    const metadata = extractPageMetadata(document as unknown as Document, window.location as unknown as Location);

    expect(metadata.title).toBe('ACCESSOS Test Sandbox Page');
    expect(metadata.url).toBe('http://localhost:3000/fixtures/accessos-test-page.html');
    expect(metadata.hostname).toBe('localhost');
    expect(metadata.pathname).toBe('/fixtures/accessos-test-page.html');
    expect(metadata.pageType).toBe('webpage');
    expect(metadata.interactiveElementCount).toBe(9);
  });

  it('validates complete metadata structure and types', () => {
    const window = new Window({
      url: 'https://municipal-services.org/permits/residential',
    });
    const document = window.document;
    document.title = 'Municipal Permits & Licenses';

    const metadata = extractPageMetadata(document as unknown as Document, window.location as unknown as Location);

    // Verify all specified attributes
    expect(metadata.title).toBe('Municipal Permits & Licenses');
    expect(metadata.url).toBe('https://municipal-services.org/permits/residential');
    expect(metadata.hostname).toBe('municipal-services.org');
    expect(metadata.pathname).toBe('/permits/residential');
    expect(metadata.pageType).toBe('webpage');
    expect(typeof metadata.interactiveElementCount).toBe('number');
  });

  it('handles empty documents without crashing', () => {
    const window = new Window({ url: 'about:blank' });
    const document = window.document;

    const metadata = extractPageMetadata(document as unknown as Document, window.location as unknown as Location);

    expect(metadata.title).toBe('');
    expect(metadata.pageType).toBe('webpage');
    expect(metadata.interactiveElementCount).toBe(0);
  });
});
