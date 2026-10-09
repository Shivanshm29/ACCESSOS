/**
 * Rule 2: IMAGE_MISSING_ALT
 * Detects images that lack an alt attribute (distinguishing from decorative alt="").
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const ImageMissingAltRule: AccessibilityRule = {
  id: 'IMAGE_MISSING_ALT',
  title: 'Image is missing alternative text',
  category: 'PERCEIVABILITY',
  severity: 'MEDIUM',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    if (context.doc) {
      const images = context.doc.querySelectorAll('img');
      images.forEach((img, index) => {
        // Decorative images with alt="" are valid and intentionally excluded
        if (!img.hasAttribute('alt')) {
          context.counter.value += 1;
          const elementId = img.getAttribute('data-accessos-id') || undefined;
          findings.push({
            id: `finding-${String(context.counter.value).padStart(3, '0')}`,
            ruleId: 'IMAGE_MISSING_ALT',
            category: 'PERCEIVABILITY',
            severity: 'MEDIUM',
            title: 'Image is missing alternative text',
            description: 'This image does not have an alt attribute, preventing screen readers from conveying its meaning.',
            affectedElementId: elementId,
            evidence: {
              src: img.getAttribute('src') || undefined,
              hasAltAttribute: false,
              imageIndex: index + 1,
            },
            remediation: 'Provide an alt attribute containing descriptive alternative text, or alt="" if the image is purely decorative.',
            confidence: 1.0,
            deterministic: true,
          });
        }
      });
    } else {
      // Fallback using PageRepresentation accessibility signals
      representation.accessibilitySignals.missingAltImages.forEach((img) => {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'IMAGE_MISSING_ALT',
          category: 'PERCEIVABILITY',
          severity: 'MEDIUM',
          title: 'Image is missing alternative text',
          description: 'This image does not have an alt attribute, preventing screen readers from conveying its meaning.',
          affectedElementId: undefined,
          evidence: {
            src: img.src,
            hasAltAttribute: false,
            order: img.order,
          },
          remediation: 'Provide an alt attribute containing descriptive alternative text, or alt="" if the image is purely decorative.',
          confidence: 1.0,
          deterministic: true,
        });
      });
    }

    return findings;
  },
};
