/**
 * Phase 14 Real-Site Matrix & Integration Test Suite
 * Validates the complete matrix of 10 real-world public websites (Categories A through J),
 * verifies compatibility classifications, generates the full test matrix,
 * and benchmarks extraction and analysis performance.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import {
  realSiteHarness,
  REAL_SITE_ALLOWLIST,
  getSiteFixtureHtml,
  SiteCategory,
  CompatibilityClassification,
  TestMode,
  type RealSiteValidationResult,
  type RealSiteMatrixRow,
} from '../src/real-site/index';
import { analyticsService } from '../src/analytics/index';
import { PreferencesStorage } from '../src/preferences/storage';
import { DEFAULT_PREFERENCES } from '../src/preferences/defaults';

describe('Phase 14 Real-Site Matrix & Integration Suite (Categories A through J)', () => {
  let window: Window;
  let document: Document;

  beforeEach(async () => {
    window = new Window();
    document = window.document as unknown as Document;
    vi.stubGlobal('window', window);
    vi.stubGlobal('document', document);
    await PreferencesStorage.savePreferences({
      ...DEFAULT_PREFERENCES,
      analyticsEnabled: true,
    });
    await analyticsService.clearAnalytics();
  });

  it('1. Executes validation harness across all 10 allowlisted real sites without errors', async () => {
    const results: RealSiteValidationResult[] = [];

    for (const site of REAL_SITE_ALLOWLIST) {
      const html = getSiteFixtureHtml(site.id);
      expect(html.length).toBeGreaterThan(50);
      document.documentElement.innerHTML = html;

      const mode =
        site.category === SiteCategory.FORM_NO_SUBMISSION ||
        site.category === SiteCategory.MODAL_DIALOG
          ? TestMode.MODE_B_CONTROLLED_INTERACTION
          : TestMode.MODE_A_READ_ONLY;

      const res = await realSiteHarness.validateSite(site, document, mode);
      results.push(res);

      expect(res.extractionSuccess).toBe(true);
      expect(res.accessibilitySuccess).toBe(true);
      expect(res.aiAnalysisReady).toBe(true);
      expect(res.aiSanitized).toBe(true);
      expect(res.securityVerified).toBe(true);
      expect(res.privacyVerified).toBe(true);
    }

    expect(results.length).toBe(10);
  });

  it('2. Correctly assigns compatibility classifications across diverse site categories', async () => {
    for (const site of REAL_SITE_ALLOWLIST) {
      document.documentElement.innerHTML = getSiteFixtureHtml(site.id);

      const mode =
        site.category === SiteCategory.FORM_NO_SUBMISSION
          ? TestMode.MODE_B_CONTROLLED_INTERACTION
          : TestMode.MODE_A_READ_ONLY;

      const res = await realSiteHarness.validateSite(site, document, mode);

      expect(res.compatibility).toBe(site.expectedCompatibility);

      // Verify classification rules:
      if (res.compatibility === CompatibilityClassification.READ_ONLY_SUPPORT) {
        // Must be an informational, doc, article, table, or guidance page
        expect([
          SiteCategory.STATIC_INFORMATIONAL,
          SiteCategory.DOCUMENTATION_HELP,
          SiteCategory.ARTICLE_CONTENT,
          SiteCategory.GOV_INSTITUTIONAL,
          SiteCategory.TABLES_DATA,
        ]).toContain(res.category);
      } else if (res.compatibility === CompatibilityClassification.FULL_SUPPORT) {
        expect(res.category).toBe(SiteCategory.FORM_NO_SUBMISSION);
        expect(res.completionStatus).toBe('SUPPORTED');
      } else if (res.compatibility === CompatibilityClassification.PARTIAL_SUPPORT) {
        expect([
          SiteCategory.SEARCH_INTERFACE,
          SiteCategory.MULTI_SECTION_FORM,
          SiteCategory.MODAL_DIALOG,
          SiteCategory.DYNAMIC_RENDERED,
        ]).toContain(res.category);
      }
    }
  });

  it('3. Generates the comprehensive Phase 14 Real-Site Results Matrix', async () => {
    const matrixRows: RealSiteMatrixRow[] = [];

    for (const site of REAL_SITE_ALLOWLIST) {
      document.documentElement.innerHTML = getSiteFixtureHtml(site.id);
      const mode =
        site.category === SiteCategory.FORM_NO_SUBMISSION
          ? TestMode.MODE_B_CONTROLLED_INTERACTION
          : TestMode.MODE_A_READ_ONLY;

      const res = await realSiteHarness.validateSite(site, document, mode);
      const row = realSiteHarness.generateMatrixRow(res);
      matrixRows.push(row);
    }

    expect(matrixRows.length).toBe(10);

    // Verify matrix columns
    for (const row of matrixRows) {
      expect(row.site).toBeDefined();
      expect(row.category).toBeDefined();
      expect(row.extraction).toBe('SUCCESS');
      expect(row.aiAnalysis).toBe('SANITIZED_READY');
      expect(row.securityResult).toBe('PASSED_SECURE');
    }

    // Output formatted JSON for review documentation
    const output = JSON.stringify(matrixRows, null, 2);
    expect(output).not.toContain('PASSWORD');
    expect(output).not.toContain('SECRET');
  });

  it('4. Rigorous privacy verification: no personal data, cookies, or raw HTML in results', async () => {
    for (const site of REAL_SITE_ALLOWLIST) {
      document.documentElement.innerHTML = getSiteFixtureHtml(site.id);
      const res = await realSiteHarness.validateSite(site, document);
      const serialized = JSON.stringify(res);

      expect(serialized).not.toContain('cookie');
      expect(serialized).not.toContain('auth_token');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('<!DOCTYPE');
      expect(serialized).not.toContain('<html');
    }
  });

  it('5. Performance benchmark: Page extraction and accessibility audit complete efficiently', async () => {
    let totalExtractMs = 0;
    let totalA11yMs = 0;

    for (const site of REAL_SITE_ALLOWLIST) {
      document.documentElement.innerHTML = getSiteFixtureHtml(site.id);
      const res = await realSiteHarness.validateSite(site, document);
      totalExtractMs += res.extractionMetrics?.extractionDurationMs || 0;
      totalA11yMs += res.accessibilityMetrics?.analysisDurationMs || 0;
    }

    const avgExtractMs = totalExtractMs / REAL_SITE_ALLOWLIST.length;
    const avgA11yMs = totalA11yMs / REAL_SITE_ALLOWLIST.length;

    console.log(
      'REAL_SITE_BENCHMARKS:',
      JSON.stringify({
        totalSites: REAL_SITE_ALLOWLIST.length,
        avgExtractMs: Math.round(avgExtractMs * 100) / 100,
        avgA11yMs: Math.round(avgA11yMs * 100) / 100,
      })
    );

    // Each real site extraction and analysis should easily complete in < 50ms
    expect(avgExtractMs).toBeLessThan(50);
    expect(avgA11yMs).toBeLessThan(50);
  });
});
