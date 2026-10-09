/**
 * Rule 9: DUPLICATE_ID
 * Detects duplicate HTML id attributes which break label and ARIA programmatic bindings.
 */
import type { PageRepresentation } from '../../core/types/representation';
import type { AccessibilityFinding, AccessibilityRule, AccessibilityRuleContext } from '../types';

export const DuplicateIdRule: AccessibilityRule = {
  id: 'DUPLICATE_ID',
  title: 'Duplicate element ID attribute detected',
  category: 'ROBUSTNESS',
  severity: 'HIGH',
  execute(representation: PageRepresentation, context: AccessibilityRuleContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const idMap = new Map<string, { count: number; elementIds: string[] }>();

    if (context.doc) {
      const elementsWithId = context.doc.querySelectorAll('[id]');
      elementsWithId.forEach((el) => {
        const id = el.getAttribute('id')?.trim();
        if (!id) return;

        const current = idMap.get(id) || { count: 0, elementIds: [] };
        current.count += 1;
        const stableId = el.getAttribute('data-accessos-id');
        if (stableId) current.elementIds.push(stableId);
        idMap.set(id, current);
      });
    } else {
      // Fallback: check elementId on fields
      representation.fields.forEach((f) => {
        if (!f.elementId) return;
        const current = idMap.get(f.elementId) || { count: 0, elementIds: [] };
        current.count += 1;
        current.elementIds.push(f.id);
        idMap.set(f.elementId, current);
      });
    }

    idMap.forEach((info, id) => {
      if (info.count > 1) {
        context.counter.value += 1;
        findings.push({
          id: `finding-${String(context.counter.value).padStart(3, '0')}`,
          ruleId: 'DUPLICATE_ID',
          category: 'ROBUSTNESS',
          severity: 'HIGH',
          title: `Duplicate HTML ID '${id}' detected in DOM`,
          description: `The ID attribute value '${id}' is reused on ${info.count} elements. Duplicate IDs cause ambiguous label and aria-describedby associations.`,
          affectedElementId: info.elementIds[0] || undefined,
          evidence: {
            duplicateId: id,
            occurrencesCount: info.count,
            affectedStableIds: info.elementIds,
          },
          remediation: `Ensure all id attribute values are globally unique across the document. Rename duplicate occurrences of id="${id}".`,
          confidence: 1.0,
          deterministic: true,
        });
      }
    });

    return findings;
  },
};
