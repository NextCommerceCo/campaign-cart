import type { Logger } from '@/core/logger';

/**
 * Extracts a slot template nested inside the card template HTML via a
 * <template> child of [data-next-bundle-slots]. Returns the stripped card
 * template (with the inner <template> removed so the live render target
 * stays empty) and the extracted slot template HTML — empty when no nested
 * template is present.
 */
export function extractNestedSlotTemplate(cardTemplate: string): {
  card: string;
  slot: string;
} {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = cardTemplate;

  const slotTpl = wrapper.querySelector<HTMLTemplateElement>(
    '[data-next-bundle-slots] > template'
  );
  if (!slotTpl) return { card: cardTemplate, slot: '' };

  const slot = slotTpl.innerHTML.trim();
  slotTpl.remove();
  return { card: wrapper.innerHTML, slot };
}

/**
 * Extracts nested <template> elements for variant-selector and variant-option
 * wrappers out of a slot template HTML string, returning the stripped slot
 * template plus the extracted template strings (empty when not present).
 *
 * The variant-option template is read from inside the variant-selector
 * template's content because that is the legal authoring structure —
 * [data-next-variant-options] lives inside the variant-selector wrapper.
 */
export function extractNestedVariantTemplates(slotTemplate: string): {
  slot: string;
  variantSelector: string;
  variantOption: string;
} {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = slotTemplate;

  let variantSelector = '';
  let variantOption = '';

  const vsTemplate = wrapper.querySelector<HTMLTemplateElement>(
    '[data-next-variant-selectors] > template'
  );
  if (vsTemplate) {
    const voTemplate = vsTemplate.content.querySelector<HTMLTemplateElement>(
      '[data-next-variant-options] > template'
    );
    if (voTemplate) {
      variantOption = voTemplate.innerHTML.trim();
      voTemplate.remove();
    }
    variantSelector = vsTemplate.innerHTML.trim();
    vsTemplate.remove();
  }

  return { slot: wrapper.innerHTML, variantSelector, variantOption };
}

/** Card/slot/variant templates resolved from their attribute/child-template sources. */
export interface ResolvedBundleTemplates {
  template: string;
  slotTemplate: string;
  variantOptionTemplate: string;
  variantSelectorTemplate: string;
}

/**
 * Resolves the card template, slot template, and variant templates.
 *
 * Card template resolution order: id attribute → inline HTML attribute →
 * direct `<template>` child of `element`. The child fallback lets authors
 * write native HTML without assigning template ids.
 *
 * Slot template resolution order: id attribute → inline HTML attribute →
 * direct `<template>` child of `externalSlotsEl` → nested `<template>` inside
 * the card template's `[data-next-bundle-slots]` placeholder. The nested
 * fallback lets authors keep card and slot markup co-located without setting
 * any template id or HTML string attribute.
 *
 * Variant templates: an explicit id attribute takes precedence; otherwise
 * they are extracted from `<template>`s nested inside
 * `[data-next-variant-selectors]` / `[data-next-variant-options]` within the
 * slot template.
 */
export function resolveBundleTemplates(
  element: HTMLElement,
  externalSlotsEl: HTMLElement | null,
  logger: Logger
): ResolvedBundleTemplates {
  const templateId = element.getAttribute('data-next-bundle-template-id');
  const templateAttr = element.getAttribute('data-next-bundle-template');
  let template: string;
  if (templateId) {
    template = document.getElementById(templateId)?.innerHTML.trim() ?? '';
  } else if (templateAttr != null) {
    template = templateAttr;
  } else {
    const inline =
      element.querySelector<HTMLTemplateElement>(':scope > template');
    template = inline?.innerHTML.trim() ?? '';
  }

  const slotTemplateId = element.getAttribute(
    'data-next-bundle-slot-template-id'
  );
  const slotTemplateAttr = element.getAttribute(
    'data-next-bundle-slot-template'
  );
  let slotTemplate: string;
  if (slotTemplateId) {
    slotTemplate =
      document.getElementById(slotTemplateId)?.innerHTML.trim() ?? '';
  } else if (slotTemplateAttr != null) {
    slotTemplate = slotTemplateAttr;
  } else if (externalSlotsEl) {
    const inline =
      externalSlotsEl.querySelector<HTMLTemplateElement>(':scope > template');
    slotTemplate = inline?.innerHTML.trim() ?? '';
  } else {
    slotTemplate = '';
  }

  if (!slotTemplate && template) {
    const { card, slot } = extractNestedSlotTemplate(template);
    if (slot) {
      template = card;
      slotTemplate = slot;
      logger.debug(
        'Extracted nested slot template from card template [data-next-bundle-slots]'
      );
    }
  }

  let variantOptionTemplate = '';
  const variantOptionTemplateId = element.getAttribute(
    'data-next-variant-option-template-id'
  );
  if (variantOptionTemplateId) {
    variantOptionTemplate =
      document.getElementById(variantOptionTemplateId)?.innerHTML.trim() ?? '';
  }

  let variantSelectorTemplate = '';
  const variantSelectorTemplateId = element.getAttribute(
    'data-next-variant-selector-template-id'
  );
  if (variantSelectorTemplateId) {
    variantSelectorTemplate =
      document.getElementById(variantSelectorTemplateId)?.innerHTML.trim() ??
      '';
  }

  if (slotTemplate && (!variantSelectorTemplate || !variantOptionTemplate)) {
    const { slot, variantSelector, variantOption } =
      extractNestedVariantTemplates(slotTemplate);
    slotTemplate = slot;
    if (!variantSelectorTemplate && variantSelector) {
      variantSelectorTemplate = variantSelector;
    }
    if (!variantOptionTemplate && variantOption) {
      variantOptionTemplate = variantOption;
    }
  }

  return {
    template,
    slotTemplate,
    variantOptionTemplate,
    variantSelectorTemplate,
  };
}
