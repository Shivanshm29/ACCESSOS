/**
 * ACCESSOS Semantic Page Understanding Extractor
 * Deterministically extracts semantic structures, forms, headings, sections,
 * accessibility signals, and metrics locally without any external data transmission.
 */

import type {
  PageInfo,
  HeadingInfo,
  SectionInfo,
  FieldInfo,
  LabelSource,
  ButtonInfo,
  LinkInfo,
  InstructionInfo,
  ErrorInfo,
  AccessibilitySignals,
  PageMetrics,
  PageRepresentation,
  ValidationAttributes,
} from '../core/types/representation';

/**
 * Checks if an element is visibly rendered.
 * Safe fallback for environments where getComputedStyle or client bounding boxes are mocked.
 */
export function isElementVisible(el: Element): boolean {
  if (el.hasAttribute('hidden')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.classList.contains('hidden') || el.classList.contains('hidden-element')) return false;

  const htmlEl = el as HTMLElement;
  if (htmlEl.style) {
    if (htmlEl.style.display === 'none') return false;
    if (htmlEl.style.visibility === 'hidden') return false;
  }

  if (typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
    } catch {
      // In synthetic/mock DOM tests getComputedStyle might not be fully implemented
    }
  }

  // Hide input[type="hidden"] from interactive field extraction
  if (el.tagName.toLowerCase() === 'input' && (el as HTMLInputElement).type === 'hidden') {
    return false;
  }

  return true;
}

/**
 * Assigns or retrieves a stable, deterministic ACCESSOS identifier for a DOM element.
 */
export function getOrCreateStableId(
  el: Element,
  prefix: string,
  counter: { value: number }
): string {
  const existingId = el.getAttribute('data-accessos-id');
  if (existingId) {
    return existingId;
  }
  counter.value += 1;
  const newId = `${prefix}-${String(counter.value).padStart(3, '0')}`;
  el.setAttribute('data-accessos-id', newId);
  return newId;
}

/**
 * Resolves form field label using standard accessibility precedence.
 */
export function resolveLabel(
  field: HTMLElement,
  doc: Document
): { label: string; source: LabelSource } {
  const fieldId = field.getAttribute('id');

  // 1. Explicit <label for="...">
  if (fieldId) {
    const explicitLabel = doc.querySelector(`label[for="${fieldId}"]`);
    if (explicitLabel && explicitLabel.textContent?.trim()) {
      return {
        label: cleanText(explicitLabel.textContent),
        source: 'explicit-label',
      };
    }
  }

  // 2. Wrapping <label>
  const parentLabel = field.closest('label');
  if (parentLabel && parentLabel.textContent) {
    // Clone and remove field itself to avoid reading current value as label
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const innerInputs = clone.querySelectorAll('input, select, textarea');
    innerInputs.forEach((input) => input.remove());
    const labelText = cleanText(clone.textContent || '');
    if (labelText) {
      return {
        label: labelText,
        source: 'wrapped-label',
      };
    }
  }

  // 3. aria-labelledby
  const labelledBy = field.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const textParts: string[] = [];
    for (const id of ids) {
      const labelEl = doc.getElementById(id);
      if (labelEl && labelEl.textContent?.trim()) {
        textParts.push(cleanText(labelEl.textContent));
      }
    }
    if (textParts.length > 0) {
      return {
        label: textParts.join(' '),
        source: 'aria-labelledby',
      };
    }
  }

  // 4. aria-label
  const ariaLabel = field.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return {
      label: cleanText(ariaLabel),
      source: 'aria-label',
    };
  }

  // 5. Associated <fieldset><legend>
  const fieldset = field.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend && legend.textContent?.trim()) {
      return {
        label: cleanText(legend.textContent),
        source: 'fieldset',
      };
    }
  }

  // 6. Nearby semantic text (e.g. preceding sibling with text)
  let prevEl = field.previousElementSibling;
  while (prevEl) {
    if (
      ['SPAN', 'P', 'LABEL', 'DIV'].includes(prevEl.tagName) &&
      prevEl.textContent?.trim()
    ) {
      const text = cleanText(prevEl.textContent);
      if (text.length > 0 && text.length < 100) {
        return {
          label: text,
          source: 'nearby-text',
        };
      }
    }
    prevEl = prevEl.previousElementSibling;
  }

  // 7. placeholder as last resort
  const placeholder = field.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) {
    return {
      label: cleanText(placeholder),
      source: 'placeholder',
    };
  }

  return { label: '', source: 'none' };
}

/**
 * Normalizes text spacing and removes excess whitespace.
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Determines whether a field is required using HTML/ARIA attributes.
 */
export function resolveRequired(field: Element): {
  required: boolean;
  requiredSource?: 'required-attr' | 'aria-required';
} {
  if (field.hasAttribute('required') || (field as HTMLInputElement).required === true) {
    return { required: true, requiredSource: 'required-attr' };
  }
  if (field.getAttribute('aria-required') === 'true') {
    return { required: true, requiredSource: 'aria-required' };
  }
  return { required: false };
}

/**
 * Checks if a field holds sensitive information (e.g., passwords, PINs, card numbers).
 */
export function isFieldSensitive(
  type: string,
  name: string = '',
  id: string = '',
  autocomplete: string = ''
): boolean {
  if (type === 'password') return true;
  const combined = `${name} ${id} ${autocomplete}`.toLowerCase();
  const sensitivePattern = /(password|pin|secret|cvv|cvc|ssn|card.?number|token|otp|account.?number|bank.?account|aadhaar)/i;
  return sensitivePattern.test(combined);
}

/**
 * Extracts comprehensive semantic page representation from document.
 */
export function extractPageRepresentation(
  doc: Document = document,
  loc: Location = window.location
): PageRepresentation {
  const pageTitle = doc.title || doc.querySelector('title')?.textContent || '';
  const page: PageInfo = {
    title: cleanText(pageTitle),
    url: loc.href || '',
    hostname: loc.hostname || '',
    pathname: loc.pathname || '',
  };

  const idCounters = {
    heading: { value: 0 },
    section: { value: 0 },
    field: { value: 0 },
    button: { value: 0 },
    link: { value: 0 },
    instruction: { value: 0 },
    error: { value: 0 },
  };

  // 1. Extract Headings
  const headings: HeadingInfo[] = [];
  const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let headingOrder = 0;

  headingElements.forEach((el) => {
    if (!isElementVisible(el)) return;
    const text = cleanText(el.textContent || '');
    if (!text) return;

    headingOrder += 1;
    const level = parseInt(el.tagName.substring(1), 10);
    const id = getOrCreateStableId(el, 'accessos-heading', idCounters.heading);

    headings.push({
      id,
      level,
      text,
      order: headingOrder,
    });
  });

  // 2. Extract Sections & Landmark Containers
  const sections: SectionInfo[] = [];
  const sectionElements = doc.querySelectorAll(
    'main, section, article, nav, header, footer, fieldset, [role="main"], [role="region"], [role="form"]'
  );

  sectionElements.forEach((el) => {
    if (!isElementVisible(el)) return;
    const id = getOrCreateStableId(el, 'accessos-section', idCounters.section);
    const role =
      el.getAttribute('role') || el.tagName.toLowerCase();

    // Look for heading inside or referencing section
    const headingEl = el.querySelector('h1, h2, h3, h4, h5, h6');
    const heading = headingEl ? cleanText(headingEl.textContent || '') : undefined;

    // Short summary text (up to 120 chars)
    const textContent = cleanText(el.textContent || '');
    const summary = textContent.slice(0, 120);

    sections.push({
      id,
      role,
      heading,
      summary,
      fieldIds: [],
      buttonIds: [],
      linkIds: [],
    });
  });

  // Section lookup map
  const sectionMap = new Map<string, SectionInfo>();
  sections.forEach((s) => sectionMap.set(s.id, s));

  // Helper to find parent section
  const findParentSectionId = (el: Element): string | undefined => {
    const parentSection = el.closest(
      'main, section, article, nav, header, footer, fieldset, [role="main"], [role="region"], [role="form"]'
    );
    if (parentSection) {
      return parentSection.getAttribute('data-accessos-id') || undefined;
    }
    return undefined;
  };

  // 3. Extract Form Fields
  const fields: FieldInfo[] = [];
  const fieldElements = doc.querySelectorAll('input, textarea, select');
  let fieldOrder = 0;

  fieldElements.forEach((el) => {
    if (!isElementVisible(el)) return;
    const htmlEl = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const tag = el.tagName.toLowerCase() as 'input' | 'textarea' | 'select';
    const type = tag === 'input' ? (htmlEl as HTMLInputElement).type || 'text' : tag;

    fieldOrder += 1;
    const id = getOrCreateStableId(el, 'accessos-field', idCounters.field);
    const name = el.getAttribute('name') || undefined;
    const elementId = el.getAttribute('id') || undefined;
    const placeholder = el.getAttribute('placeholder') || undefined;
    const descriptionAttr = el.getAttribute('aria-describedby');
    let description: string | undefined;

    if (descriptionAttr) {
      const descEl = doc.getElementById(descriptionAttr);
      if (descEl && descEl.textContent) {
        description = cleanText(descEl.textContent);
      }
    }

    const { label, source: labelSource } = resolveLabel(htmlEl, doc);
    const { required, requiredSource } = resolveRequired(el);
    const disabled = htmlEl.disabled || el.hasAttribute('disabled');
    const readonly = (htmlEl as HTMLInputElement).readOnly || el.hasAttribute('readonly');
    const autocomplete = el.getAttribute('autocomplete') || undefined;
    const ariaLabel = el.getAttribute('aria-label') || undefined;
    const ariaDescribedBy = descriptionAttr || undefined;

    // Privacy Safe value check: NEVER store user values!
    const sensitive = isFieldSensitive(type, name, elementId, autocomplete);
    let hasValue = false;
    if (!sensitive) {
      if (type === 'checkbox' || type === 'radio') {
        hasValue = (htmlEl as HTMLInputElement).checked;
      } else if (htmlEl.value) {
        hasValue = htmlEl.value.trim().length > 0;
      }
    }

    // Options for select element
    let options: string[] | undefined;
    if (tag === 'select') {
      const optionNodes = el.querySelectorAll('option');
      options = Array.from(optionNodes)
        .map((opt) => cleanText(opt.textContent || ''))
        .filter(Boolean);
    }

    // Validation attributes
    const validationAttributes: ValidationAttributes = {};
    if (el.hasAttribute('pattern')) validationAttributes.pattern = el.getAttribute('pattern')!;
    if (el.hasAttribute('min')) validationAttributes.min = el.getAttribute('min')!;
    if (el.hasAttribute('max')) validationAttributes.max = el.getAttribute('max')!;
    if (el.hasAttribute('minlength')) {
      validationAttributes.minLength = parseInt(el.getAttribute('minlength')!, 10);
    }
    if (el.hasAttribute('maxlength')) {
      validationAttributes.maxLength = parseInt(el.getAttribute('maxlength')!, 10);
    }

    const sectionId = findParentSectionId(el);
    if (sectionId && sectionMap.has(sectionId)) {
      sectionMap.get(sectionId)!.fieldIds.push(id);
    }

    fields.push({
      id,
      tag,
      type,
      name,
      elementId,
      label,
      labelSource,
      placeholder,
      description,
      required,
      requiredSource,
      disabled,
      readonly,
      hasValue,
      sensitive,
      options,
      autocomplete,
      ariaLabel,
      ariaDescribedBy,
      validationAttributes: Object.keys(validationAttributes).length > 0 ? validationAttributes : undefined,
      order: fieldOrder,
      sectionId,
    });
  });

  // 4. Extract Buttons
  const buttons: ButtonInfo[] = [];
  const buttonElements = doc.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]');
  let buttonOrder = 0;

  buttonElements.forEach((el) => {
    if (!isElementVisible(el)) return;
    buttonOrder += 1;
    const id = getOrCreateStableId(el, 'accessos-button', idCounters.button);

    let text = '';
    let type: 'submit' | 'button' | 'reset' = 'button';

    if (el.tagName.toLowerCase() === 'input') {
      const inputEl = el as HTMLInputElement;
      text = inputEl.value || '';
      if (inputEl.type === 'submit') type = 'submit';
      else if (inputEl.type === 'reset') type = 'reset';
    } else {
      text = el.textContent || '';
      const typeAttr = el.getAttribute('type');
      if (typeAttr === 'submit') type = 'submit';
      else if (typeAttr === 'reset') type = 'reset';
    }

    const ariaLabel = el.getAttribute('aria-label') || undefined;
    const disabled = (el as HTMLButtonElement).disabled || el.hasAttribute('disabled');
    const sectionId = findParentSectionId(el);
    if (sectionId && sectionMap.has(sectionId)) {
      sectionMap.get(sectionId)!.buttonIds.push(id);
    }

    buttons.push({
      id,
      text: cleanText(text),
      type,
      ariaLabel: ariaLabel ? cleanText(ariaLabel) : undefined,
      disabled,
      order: buttonOrder,
      sectionId,
    });
  });

  // 5. Extract Links
  const links: LinkInfo[] = [];
  const linkElements = doc.querySelectorAll('a[href]');
  let linkOrder = 0;

  linkElements.forEach((el) => {
    if (!isElementVisible(el)) return;
    const href = el.getAttribute('href') || '';
    if (!href || href === '#') {
      // Empty anchor without action
      if (!el.textContent?.trim() && !el.getAttribute('aria-label')) return;
    }

    linkOrder += 1;
    const id = getOrCreateStableId(el, 'accessos-link', idCounters.link);
    const text = cleanText(el.textContent || '');
    const ariaLabel = el.getAttribute('aria-label') ? cleanText(el.getAttribute('aria-label')!) : undefined;

    const isExternal =
      href.startsWith('http://') || href.startsWith('https://')
        ? !href.includes(loc.hostname)
        : false;

    const sectionId = findParentSectionId(el);
    if (sectionId && sectionMap.has(sectionId)) {
      sectionMap.get(sectionId)!.linkIds.push(id);
    }

    links.push({
      id,
      text,
      href,
      ariaLabel,
      isExternal,
      order: linkOrder,
      sectionId,
    });
  });

  // 6. Extract Instructions & Help Content
  const instructions: InstructionInfo[] = [];
  const instructionElements = doc.querySelectorAll(
    '.help-text, .description, .hint, .instruction-banner, .form-text, [role="note"]'
  );
  let instructionOrder = 0;

  instructionElements.forEach((el) => {
    if (!isElementVisible(el)) return;
    const rawText = cleanText(el.textContent || '');
    if (!rawText) return;

    instructionOrder += 1;
    const id = getOrCreateStableId(el, 'accessos-inst', idCounters.instruction);
    const source = el.classList.contains('help-text')
      ? 'help-text'
      : el.classList.contains('description')
      ? 'description'
      : 'paragraph';

    instructions.push({
      id,
      text: rawText.slice(0, 200),
      source,
      order: instructionOrder,
      sectionId: findParentSectionId(el),
    });
  });

  // 7. Extract Visible Errors & Alerts
  const errors: ErrorInfo[] = [];
  const errorElements = doc.querySelectorAll(
    '[role="alert"], [aria-live="assertive"], .error-message, .error, .invalid-feedback'
  );

  errorElements.forEach((el) => {
    if (!isElementVisible(el)) return;
    const text = cleanText(el.textContent || '');
    if (!text) return;

    const id = getOrCreateStableId(el, 'accessos-error', idCounters.error);
    const source: ErrorInfo['source'] =
      el.getAttribute('role') === 'alert' ? 'aria-alert' : 'error-class';

    // Check if error is linked to a field via aria-describedby or proximity
    let fieldId: string | undefined;
    const errId = el.getAttribute('id');
    if (errId) {
      const relatedField = doc.querySelector(`[aria-describedby~="${errId}"]`);
      if (relatedField) {
        fieldId = relatedField.getAttribute('data-accessos-id') || undefined;
      }
    }

    errors.push({
      id,
      fieldId,
      text,
      severity: 'error',
      source,
    });
  });

  // 8. Analyze Accessibility Signals
  const missingLabels: AccessibilitySignals['missingLabels'] = [];
  fields.forEach((f) => {
    if (f.labelSource === 'none') {
      missingLabels.push({
        fieldId: f.id,
        description: `Field of type '${f.type}' lacks accessible name/label.`,
      });
    }
  });

  const missingAltImages: AccessibilitySignals['missingAltImages'] = [];
  const imageElements = doc.querySelectorAll('img');
  let imageOrder = 0;
  imageElements.forEach((img) => {
    imageOrder += 1;
    if (!img.hasAttribute('alt')) {
      missingAltImages.push({
        src: img.getAttribute('src') || undefined,
        order: imageOrder,
      });
    }
  });

  const buttonsWithoutAccessibleName: AccessibilitySignals['buttonsWithoutAccessibleName'] = [];
  buttons.forEach((b) => {
    if (!b.text && !b.ariaLabel) {
      buttonsWithoutAccessibleName.push({ buttonId: b.id });
    }
  });

  const linksWithoutAccessibleName: AccessibilitySignals['linksWithoutAccessibleName'] = [];
  links.forEach((l) => {
    if (!l.text && !l.ariaLabel) {
      linksWithoutAccessibleName.push({ linkId: l.id, href: l.href });
    }
  });

  const ariaInvalidFields: AccessibilitySignals['ariaInvalidFields'] = [];
  const invalidElements = doc.querySelectorAll('[aria-invalid="true"]');
  invalidElements.forEach((el) => {
    const fieldId = el.getAttribute('data-accessos-id');
    if (fieldId) {
      ariaInvalidFields.push({ fieldId });
    }
  });

  // Heading hierarchy anomalies
  const headingHierarchyAnomalies: AccessibilitySignals['headingHierarchyAnomalies'] = [];
  let previousLevel = 0;
  let h1Count = 0;

  headings.forEach((h) => {
    if (h.level === 1) h1Count += 1;
    if (previousLevel > 0 && h.level > previousLevel + 1) {
      headingHierarchyAnomalies.push({
        headingId: h.id,
        level: h.level,
        expectedLevel: previousLevel + 1,
        message: `Heading level h${h.level} skips hierarchy from h${previousLevel}.`,
      });
    }
    previousLevel = h.level;
  });

  if (headings.length > 0 && h1Count === 0) {
    headingHierarchyAnomalies.push({
      headingId: headings[0].id,
      level: headings[0].level,
      message: 'Page is missing a top-level h1 heading.',
    });
  }

  const emptyInteractiveElements: AccessibilitySignals['emptyInteractiveElements'] = [];
  buttonsWithoutAccessibleName.forEach((b) => {
    emptyInteractiveElements.push({ elementId: b.buttonId, tag: 'button' });
  });
  linksWithoutAccessibleName.forEach((l) => {
    emptyInteractiveElements.push({ elementId: l.linkId, tag: 'a' });
  });

  const hasMainLandmark = doc.querySelector('main, [role="main"]') !== null;

  const keyboardFocusabilityIssues: AccessibilitySignals['keyboardFocusabilityIssues'] = [];
  const negativeTabIndexInteractive = doc.querySelectorAll('button[tabindex="-1"], a[href][tabindex="-1"], input[tabindex="-1"]');
  negativeTabIndexInteractive.forEach((el) => {
    const accId = el.getAttribute('data-accessos-id') || el.tagName.toLowerCase();
    keyboardFocusabilityIssues.push({
      elementId: accId,
      reason: 'Interactive element removed from keyboard focus order via tabindex="-1".',
    });
  });

  const totalSignalsCount =
    missingLabels.length +
    missingAltImages.length +
    buttonsWithoutAccessibleName.length +
    linksWithoutAccessibleName.length +
    ariaInvalidFields.length +
    headingHierarchyAnomalies.length +
    (!hasMainLandmark ? 1 : 0) +
    keyboardFocusabilityIssues.length;

  const accessibilitySignals: AccessibilitySignals = {
    missingLabels,
    missingAltImages,
    buttonsWithoutAccessibleName,
    linksWithoutAccessibleName,
    ariaInvalidFields,
    headingHierarchyAnomalies,
    emptyInteractiveElements,
    hasMainLandmark,
    keyboardFocusabilityIssues,
    totalSignalsCount,
  };

  // 9. Metrics & Complexity Calculations
  const requiredFieldCount = fields.filter((f) => f.required).length;
  const conditionalSectionsCount = sections.filter(
    (s) => s.role === 'region' || s.summary.includes('conditional')
  ).length;
  const fileUploadCount = fields.filter((f) => f.type === 'file').length;

  const metrics: PageMetrics = {
    headingCount: headings.length,
    sectionCount: sections.length,
    fieldCount: fields.length,
    requiredFieldCount,
    buttonCount: buttons.length,
    linkCount: links.length,
    instructionCount: instructions.length,
    errorCount: errors.length,
    imageCount: imageElements.length,
    missingLabelCount: missingLabels.length,
    missingAccessibleNameCount:
      buttonsWithoutAccessibleName.length + linksWithoutAccessibleName.length,
    formComplexity: {
      fieldCount: fields.length,
      requiredFieldCount,
      sectionCount: sections.length,
      conditionalSectionsCount,
      fileUploadCount,
    },
  };

  return {
    page,
    headings,
    sections,
    fields,
    buttons,
    links,
    instructions,
    errors,
    accessibilitySignals,
    metrics,
    extractedAt: Date.now(),
  };
}
