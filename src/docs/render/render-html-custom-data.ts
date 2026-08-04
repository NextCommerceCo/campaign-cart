/**
 * Renders VS Code **HTML custom data** from the feature manifests, so an editor can
 * autocomplete and describe every `data-next-*` attribute while someone writes a
 * campaign page.
 *
 * This is the point where the manifests stop being a docs mechanism and become a
 * tool: the same declaration that generates the reference also drives IntelliSense,
 * so an attribute cannot exist in the editor and be missing from the docs, or vice
 * versa.
 *
 * Format: https://github.com/microsoft/vscode-html-languageservice/blob/main/docs/customData.md
 * `data-next-*` attributes are valid on any element, so they are emitted as
 * `globalAttributes` rather than being tied to tags.
 *
 * Build-time only — see the note on {@link FeatureManifest}.
 */

import type { AttributeDoc, FeatureManifest } from '../schema/feature-manifest';
import { SDK_ATTRIBUTES } from '../content/sdk-attributes';

/** VS Code custom-data value entry. */
interface CustomDataValue {
  name: string;
  description?: string;
}

/** VS Code custom-data attribute entry. */
interface CustomDataAttribute {
  name: string;
  description: { kind: 'markdown'; value: string };
  values?: CustomDataValue[];
  references?: Array<{ name: string; url: string }>;
}

/**
 * No `references` are emitted, so a hover shows the description and the valid
 * values but no "docs" link.
 *
 * This used to point every attribute at
 * `developers.nextcommerce.com/docs/campaigns/feature-guides/{category}/{id}/reference/attributes`,
 * and all 217 of those links **404**. The host is fine —
 * `/docs/campaigns` still serves the public documentation — it is the
 * `feature-guides` subtree underneath it that no longer exists, so swapping the
 * host would not have helped. Nor would rewriting the path: the generated docs
 * site addresses the same page as `documents/Features_Cart_Add_To_Cart_Attributes.html`,
 * an entirely different shape, and it has no public host yet.
 *
 * A hover with no link beats one that lands on a 404, so the links stay out until
 * there is somewhere real to send a reader. To restore them, build the URL from
 * the page's nav title (`src/docs/content/nav.ts` — `title` *is* the path) rather
 * than reinventing a scheme, and take the host from `DOCS_BASE_URL`, the variable
 * `scripts/docs-publish.mjs` already reads.
 */

/** The hover card an editor shows: what it does, plus the facts worth knowing. */
function hoverMarkdown(
  attr: AttributeDoc,
  ownerLabel: string,
  ownerNote: string
): string {
  const facts = [
    attr.required ? '**Required**' : undefined,
    attr.default !== undefined ? `Default: \`${attr.default}\`` : undefined,
    attr.type ? `Type: \`${attr.type}\`` : undefined,
  ].filter(Boolean);

  return [
    attr.description?.trim() || `Used by ${ownerLabel}.`,
    facts.length ? facts.join(' · ') : undefined,
    attr.notes ? `⚠️ ${attr.notes}` : undefined,
    ownerNote,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Enumerated values become editor completions for the attribute's value. */
function valuesFor(attr: AttributeDoc): CustomDataValue[] | undefined {
  if (!attr.values || typeof attr.values === 'string') return undefined;
  return attr.values
    // `(empty)` documents "no value"; it is not a literal an editor should offer.
    .filter(v => v.value !== '(empty)')
    .map(v => ({ name: v.value, description: v.description }));
}

export function renderHtmlCustomData(manifests: FeatureManifest[]): string {
  /**
   * One attribute name can mean different things to different features, and not
   * merely in wording: `data-next-quantity` is a **number** for add-to-cart and a
   * **mode** (`increase`/`decrease`/`set`) for quantity-control. Picking one
   * feature's prose would put the wrong meaning in the editor for every other
   * feature, so a shared attribute lists each reading instead.
   */
  const byName = new Map<
    string,
    Array<{ owner: string; label: string; attr: AttributeDoc }>
  >();

  const add = (attr: AttributeDoc, owner: string, label: string): void => {
    const list = byName.get(attr.name) ?? [];
    if (!list.some(e => e.owner === owner)) list.push({ owner, label, attr });
    byName.set(attr.name, list);
  };

  for (const manifest of [...manifests].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const attr of manifest.attributes) add(attr, manifest.id, manifest.id);
    for (const attr of manifest.readsElsewhere ?? []) {
      if (attr.name.includes(' / ')) continue; // multi-name rows are prose, not attributes
      add(
        { name: attr.name, type: 'string', description: attr.description, notes: attr.notes },
        manifest.id,
        manifest.id
      );
    }
  }

  for (const attr of SDK_ATTRIBUTES) {
    add(attr, 'sdk', `SDK (${attr.owner})`);
  }

  const globalAttributes: CustomDataAttribute[] = [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, owners]) => {
      const single = owners.length === 1;

      const value = single
        ? hoverMarkdown(owners[0].attr, owners[0].label, `Feature: \`${owners[0].owner}\`.`)
        : [
            `Used by ${owners.length} features — the meaning differs, so check the one you are in:`,
            owners
              .map(({ owner, attr }) => {
                const facts = [
                  attr.type ? `\`${attr.type}\`` : undefined,
                  attr.required ? 'required' : undefined,
                  attr.default !== undefined ? `default \`${attr.default}\`` : undefined,
                ]
                  .filter(Boolean)
                  .join(', ');
                // Inventory-mode features carry no prose in the manifest; point at
                // their reference rather than rendering an empty bullet.
                const summary =
                  (attr.description ?? '').split(/(?<=\.)\s/)[0].trim() ||
                  'see its reference page.';
                return `- **${owner}**${facts ? ` (${facts})` : ''} — ${summary}`;
              })
              .join('\n'),
          ].join('\n\n');

      // Merge value completions across owners: quantity-control's modes and
      // clear-cart's booleans are both valid completions for their own attribute.
      const values = owners
        .flatMap(({ attr }) => valuesFor(attr) ?? [])
        .filter(
          (v, i, all) => all.findIndex(other => other.name === v.name) === i
        );

      return {
        name,
        description: { kind: 'markdown' as const, value },
        ...(values.length ? { values } : {}),
      };
    });

  return `${JSON.stringify(
    {
      $comment:
        'AUTO-GENERATED from the feature manifests. Do not hand-edit. ' +
        'Regenerate: npm run docs:reference',
      version: 1.1,
      globalAttributes,
    },
    null,
    2
  )}\n`;
}
