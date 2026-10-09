import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPageRepresentation } from '../src/content/semantic-extractor';
import {
  analyzeAccessibility,
  type AccessibilityReport,
} from '../src/accessibility/index';

describe('Phase 4 Accessibility Engine & Demo Site Integration Suite', () => {
  let window: Window;
  let doc: Document;
  let report: AccessibilityReport;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../demo-site/index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    window = new Window({ url: 'http://localhost:3000/' });
    doc = window.document as unknown as Document;
    doc.write(html);

    const representation = extractPageRepresentation(doc, window.location as unknown as Location);
    report = analyzeAccessibility(representation, doc);
  });

  it('1. Executes successfully on the demo portal without errors or exceptions', () => {
    expect(report).toBeDefined();
    expect(report.deterministic).toBe(true);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it('2. Captures all intentional accessibility barriers from Phase 3', () => {
    const ruleIds = report.findings.map((f) => f.ruleId);

    // Intentional Barrier A: Form field lacking accessible label (applicant_alternate_contact)
    expect(ruleIds).toContain('FORM_MISSING_LABEL');
    const labelFinding = report.findings.find((f) => f.ruleId === 'FORM_MISSING_LABEL');
    expect(labelFinding?.evidence.name).toBe('applicant_alternate_contact');

    // Intentional Barrier B: Image missing alt text (portal crest)
    expect(ruleIds).toContain('IMAGE_MISSING_ALT');

    // Intentional Barrier C: Button without accessible name (btn-mystery-help)
    expect(ruleIds).toContain('BUTTON_MISSING_NAME');

    // Intentional Barrier D: Heading hierarchy skip (h1 to h3 in statutory notice)
    expect(ruleIds).toContain('HEADING_HIERARCHY');

    // Structural Usability Barrier: File instructions detached from uploads
    expect(ruleIds).toContain('FILE_INSTRUCTION_ASSOCIATION');
  });

  it('3. Every finding affecting a page element references a valid stable ACCESSOS ID', () => {
    report.findings.forEach((finding) => {
      if (finding.affectedElementId) {
        expect(finding.affectedElementId).toMatch(/^accessos-(field|section|button|link|instruction|inst|heading)-\d{3}$/);
      }
    });
  });

  it('4. Produces a transparent, deterministic score within expected baseline range', () => {
    expect(typeof report.score.finalScore).toBe('number');
    expect(report.score.finalScore).toBeGreaterThanOrEqual(0);
    expect(report.score.finalScore).toBeLessThanOrEqual(100);
    expect(report.score.formula).toContain('finalScore = clamp');
    expect(report.score.band).toBeDefined();
  });

  it('5. Repeated execution produces exactly identical findings and score (100% deterministic)', () => {
    const representation = extractPageRepresentation(doc, window.location as unknown as Location);
    const report2 = analyzeAccessibility(representation, doc);

    expect(report2.score.finalScore).toBe(report.score.finalScore);
    expect(report2.findings.length).toBe(report.findings.length);
    expect(report2.findings.map((f) => f.ruleId)).toEqual(report.findings.map((f) => f.ruleId));
  });

  it('6. Measures execution performance and logs exact demo site findings for Phase 4 review', () => {
    const startTime = performance.now();
    const representation = extractPageRepresentation(doc, window.location as unknown as Location);
    const benchmarkReport = analyzeAccessibility(representation, doc);
    const durationMs = performance.now() - startTime;

    console.log('EXACT_PHASE4_FINDINGS_START');
    console.log(JSON.stringify({
      totalFindings: benchmarkReport.summary.totalFindings,
      bySeverity: benchmarkReport.summary.bySeverity,
      byCategory: benchmarkReport.summary.byCategory,
      finalScore: benchmarkReport.score.finalScore,
      rawScore: benchmarkReport.score.rawScore,
      band: benchmarkReport.score.band,
      executionTimeMs: Math.round(durationMs * 100) / 100,
      detectedRules: Array.from(new Set(benchmarkReport.findings.map((f) => f.ruleId))),
    }, null, 2));
    console.log('EXACT_PHASE4_FINDINGS_END');

    expect(durationMs).toBeLessThan(100); // Super fast local performance
  });
});
