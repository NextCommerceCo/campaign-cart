/**
 * Sidebar placement for the guide markdown the docs site publishes.
 *
 * Generated pages under `src/core/guide/` and `docs/` carry frontmatter for the
 * TypeDoc site. TypeDoc decides where a page sits in the sidebar from three YAML
 * frontmatter keys, and this module is the one place that writes them:
 *
 * | Key | What TypeDoc does with it |
 * |---|---|
 * | `title` | Becomes the page's **name**, which drives both the sidebar tree and the URL. A `/` in it is a tree level, so `Core/Reference/URL Parameters` reads **Core › Reference › URL Parameters** and lands at `documents/Core_Reference_URL_Parameters.html`. |
 * | `group` | The top-level area the page belongs to — `Core`, `Reference`. |
 * | `category` | The subsystem or area that owns the page. Sections on the site's index page come from this. |
 *
 * Two things to know before changing anything here:
 *
 * - **`title` is the URL.** Renaming one moves a published page, so treat a change to
 *   {@link coreNavTitle} or {@link referenceNavTitle} as a breaking change to
 *   customer links, not as a cosmetic edit.
 * - **Values are double-quoted on purpose.** The drift tests ban the dismissive words
 *   from `.claude/rules/documentation.md` §2 and strip quoted copy before searching,
 *   so a title may quote a name that contains one.
 *
 * Frontmatter on a **generated** page is written by the `render-*.ts` module that owns
 * it, so the drift tests keep it current. Frontmatter on a **hand-written** page is
 * committed in the file.
 */

/** The frontmatter block, including the blank line that separates it from the body. */
function frontmatter(title: string, group: string, category: string): string {
  return [
    '---',
    `title: "${title}"`,
    `group: "${group}"`,
    `category: "${category}"`,
    '---',
    '',
    '',
  ].join('\n');
}

/**
 * Which folder of `src/core/guide/` a page belongs to. `null` is the guide root —
 * `overview.md` alone.
 */
export type CoreSection = 'Reference' | null;

/**
 * Where a core guide page sits: `Core/Reference/<Page>` for the generated
 * reference, or `Core/<Page>` for everything else.
 *
 * There is no `Subsystems` level. The twelve subsystem overviews sit **flat**
 * under `Core`, because a reader looking for "how does the cart boot" should not
 * have to open a folder named after an engineering word first. They live in
 * `src/core/guide/subsystems/` and carry a `Core Subsystems` category — the folder
 * and the category still group them, the sidebar no longer makes you click
 * through. Their frontmatter is hand-written, so this helper is not involved.
 *
 * @example
 * coreNavTitle('Reference', 'URL Parameters'); // → 'Core/Reference/URL Parameters'
 * coreNavTitle(null, 'Overview');              // → 'Core/Overview'
 */
export function coreNavTitle(section: CoreSection, leaf: string): string {
  return ['Core', ...(section ? [section] : []), leaf].join('/');
}

/** Frontmatter for one page of `src/core/guide/`. */
export function coreNav(section: CoreSection, leaf: string): string {
  return frontmatter(
    coreNavTitle(section, leaf),
    'Core',
    section ? `Core ${section}` : 'Core'
  );
}

/**
 * Where a cross-cutting index page sits: `Reference/<Page>`.
 *
 * For pages that belong to no subsystem, such as the SDK-level attribute page
 * generated into `docs/`, so they get their own top-level area beside Core.
 *
 * @example
 * referenceNavTitle('SDK-level Attributes'); // → 'Reference/SDK-level Attributes'
 */
export function referenceNavTitle(leaf: string): string {
  return `Reference/${leaf}`;
}

/** Frontmatter for a cross-cutting index page. */
export function referenceNav(leaf: string, category = 'Attributes'): string {
  return frontmatter(referenceNavTitle(leaf), 'Reference', category);
}
