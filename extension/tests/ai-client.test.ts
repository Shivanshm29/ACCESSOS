/**
 * Unit tests for extension AI client and bundle secret verification.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAIAnalysisRequest,
  requestAIPageAnalysis,
  AIClientError,
  type AIPageAnalysisResponse,
} from '../src/ai/index';
import type { PageMetadata, PageRepresentation } from '../src/core/types/index';
import type { AccessibilityReport } from '../src/accessibility/types';

describe('Phase 5 AI Client & Secret Isolation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Correctly constructs sanitized AI analysis request payload', () => {
    const mockMeta: PageMetadata = {
      title: 'Scholarship Application',
      url: 'http://localhost:3000/apply',
      hostname: 'localhost:3000',
      pathname: '/apply',
      pageType: 'webpage',
      interactiveElementCount: 25,
    };

    const mockRep: Partial<PageRepresentation> = {
      headings: [{ id: 'h1', level: 1, text: 'Title', order: 1 }],
      fields: [{ id: 'f1', tag: 'input', type: 'text', label: 'Name', labelSource: 'explicit-label', required: true, disabled: false, readonly: false, hasValue: false, sensitive: false, order: 1 }],
    };

    const mockReport: Partial<AccessibilityReport> = {
      score: { rawScore: 80, finalScore: 80, band: 'Minor barriers', interpretation: 'Few minor barriers', formula: '100 - sum', penalties: { critical: 0, high: 1, medium: 2, low: 0, info: 0, totalDeduction: 20 } },
      findings: [],
    };

    const payload = buildAIAnalysisRequest(
      mockMeta,
      mockRep as PageRepresentation,
      mockReport as AccessibilityReport,
      'Submit grant'
    );

    expect(payload.page.title).toBe('Scholarship Application');
    expect(payload.userGoal).toBe('Submit grant');
    expect(payload.representation).toBeDefined();
    expect(payload.accessibilityReport).toBeDefined();
  });

  it('2. Successfully receives and parses AIPageAnalysisResponse from backend', async () => {
    const mockResponse: AIPageAnalysisResponse = {
      pageUnderstanding: {
        pageType: 'APPLICATION',
        pagePurpose: 'Scholarship application portal',
        confidence: 0.95,
      },
      processUnderstanding: {
        processName: 'National Scholarship',
        goal: 'Complete application',
        majorStages: ['Stage 1', 'Stage 2'],
        requiredInformationCategories: ['Contact'],
        requiredDocumentCategories: ['Transcripts'],
        likelyNextAction: 'Start Section 1',
      },
      barriers: [
        {
          id: 'ai-01',
          type: 'UNFAMILIAR_TERM',
          severity: 'HIGH',
          title: 'Institutional jargon',
          explanation: 'Statutory citations are dense.',
          evidence: [],
          affectedElementIds: ['accessos-inst-001'],
          suggestedSimplification: 'Provide plain language definitions.',
          confidence: 0.9,
        },
      ],
      nextAction: {
        description: 'Complete Section 1',
        targetElementId: 'accessos-field-001',
      },
      summary: 'Page requires sequential input.',
      provider: 'mock',
      model: 'mock-v1',
      truncated: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await requestAIPageAnalysis({ page: { title: 'Test' } });
    expect(result.pageUnderstanding.pageType).toBe('APPLICATION');
    expect(result.barriers.length).toBe(1);
    expect(result.barriers[0].type).toBe('UNFAMILIAR_TERM');
    expect(result.barriers[0].severity).toBe('HIGH');
  });

  it('3. Handles backend error responses gracefully without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'AI analysis is temporarily unavailable.' }),
    });

    await expect(requestAIPageAnalysis({ page: { title: 'Test' } })).rejects.toThrow(
      AIClientError
    );
  });

  it('4. Handles backend network timeout gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));

    await expect(requestAIPageAnalysis({ page: { title: 'Test' } })).rejects.toThrow(
      /timed out/i
    );
  });

  it('5. CRITICAL: Verifies zero AI API keys exist in extension source or built bundle', () => {
    // Scan extension src and dist
    const distPopupPath = resolve(__dirname, '../dist/assets/popup.js');
    const distContentPath = resolve(__dirname, '../dist/assets/content.js');

    const filesToScan = [
      resolve(__dirname, '../src/popup/popup.ts'),
      resolve(__dirname, '../src/ai/client.ts'),
      resolve(__dirname, '../src/ai/types.ts'),
    ];

    if (existsSync(distPopupPath)) filesToScan.push(distPopupPath);
    if (existsSync(distContentPath)) filesToScan.push(distContentPath);

    const forbiddenPatterns = [
      /sk-[a-zA-Z0-9]{20,}/,          // OpenAI secret key pattern
      /AIza[0-9A-Za-z-_]{35}/,        // Google API key pattern
      /OPENAI_API_KEY\s*=\s*['"][^'"]+['"]/,
      /GEMINI_API_KEY\s*=\s*['"][^'"]+['"]/,
      /OPENROUTER_API_KEY\s*=\s*['"][^'"]+['"]/,
    ];

    for (const filePath of filesToScan) {
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
