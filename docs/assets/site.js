/**
 * Campaign Cart SDK docs site — client script.
 *
 * TypeDoc's `customJs` takes exactly one path, so this file is the single entry point
 * for everything the site runs in the browser. It ships as-is: plain DOM JavaScript, no
 * framework, no bundler, no CDN. The site must work from a local folder with no network.
 *
 * What it does:
 *   1. Renders a version `<select>` in the page toolbar, from `versions.json` at the
 *      site root, and jumps to the *same page* in the version the reader picks.
 *   2. Shows a banner when the reader is on an older version than the current release,
 *      or on one of the unreleased folders (`main/`, `dev/`).
 *   3. Splits the sidebar into sections (Guides, Attributes, Events, Analytics, JavaScript API) with
 *      a switcher above it, so the sidebar shows only the section the page is in.
 *
 * That is all it does.
 *
 * 1 and 2 do nothing when `versions.json` is absent — that is the normal state of an
 * unversioned local `npm run docs` build, and a warning-free no-op is the correct
 * behaviour there. 3 does nothing without clean-jsdoc-theme's sidebar nav, so the
 * default theme (old version folders) keeps its full sidebar.
 */

(() => {
  'use strict';

  /*
   * clean-jsdoc-theme adapter. This file was written against TypeDoc's default theme
   * and reaches for three things that theme provides: `data-base` on `<html>`, the
   * `#tsd-toolbar-links` toolbar host, and `.container-main`. clean-jsdoc-theme has
   * none of them, so equivalents are derived here first — its Header renders the brand
   * link as `<a href={basePath}>` (the same value `data-base` carries), and the
   * right-hand control cluster is the header's `ml-auto` div. Every step is guarded on
   * the original being absent, so on the default theme (which old version folders are
   * still built with) this whole block is a no-op.
   */
  if (!document.documentElement.dataset.base) {
    const brand = document.querySelector('header a[href]');
    if (brand) {
      document.documentElement.dataset.base = brand.getAttribute('href') || '/';
    }
  }
  if (!document.getElementById('tsd-toolbar-links')) {
    const controls = document.querySelector('header div.ml-auto');
    if (controls) {
      const host = document.createElement('span');
      host.id = 'tsd-toolbar-links';
      host.className = 'flex items-center';
      controls.prepend(host);
    }
  }
  if (!document.querySelector('.container-main')) {
    document.querySelector('main')?.classList.add('container-main');
  }

  /**
   * The version folder's root URL.
   *
   * TypeDoc stamps `data-base` on `<html>` with the relative path from the current page
   * back to the build root — `./` on the index, `../` inside `documents/`. That is the
   * only reliable way to find the root from a page at unknown depth.
   */
  const versionRoot = new URL(document.documentElement.dataset.base || './', window.location.href);

  /** The site root — one level above the version folder, where `versions.json` lives. */
  const siteRoot = new URL('../', versionRoot);

  /**
   * Folder name the reader is in: `v0.4.30`, `latest`, `main`, `dev`, or a plain build's
   * folder.
   */
  const currentFolder = decodeURIComponent(versionRoot.pathname.replace(/\/+$/, '').split('/').pop() || '');

  /**
   * Folders that hold docs for something that was never released.
   *
   * They cannot be entries in `versions.json` — that file is generated from release tags
   * and `src/tests/docs/docsVersions.test.ts` holds it to tag-shaped entries — so the
   * switcher offers them by name instead.
   *
   * `main` is the branch tip, published by `docs-publish.mjs`, and is `probe`d for because
   * a reader on a released version should be able to reach it. `dev` is a local
   * working-tree build that is never published, so it is offered only to a reader already
   * in it — probing for it on the published site would cost a request that always 404s.
   */
  const UNRELEASED = [
    {
      folder: 'main',
      label: 'main (unreleased)',
      source: 'the main branch',
      probe: true,
    },
    {
      folder: 'dev',
      label: 'dev (working tree)',
      source: 'a local working tree',
      probe: false,
    },
  ];

  /**
   * Path of the current page inside its version folder, e.g.
   * `documents/features_cart_add-to-cart_guide_overview.html`.
   */
  const pagePath = decodeURIComponent(window.location.pathname).slice(decodeURIComponent(versionRoot.pathname).length);

  /** Resolves a page path inside another version folder. */
  const pageIn = (folder, path) => new URL(`${encodeURIComponent(folder)}/${path}`, siteRoot).href;

  /**
   * True when `url` exists.
   *
   * A `HEAD` is enough for a static server and avoids downloading the page twice. Some
   * static servers answer `HEAD` with 405 — treated as "exists" rather than sending the
   * reader to the index, because a wrong fallback is more confusing than a rare 404.
   */
  async function exists(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok || response.status === 405;
    } catch {
      return false;
    }
  }

  /** Loads the version index, or `null` when the build is unversioned. */
  async function loadVersions() {
    try {
      const response = await fetch(new URL('versions.json', siteRoot).href, {
        cache: 'no-cache',
      });
      if (!response.ok) return null;
      const versions = await response.json();
      return Array.isArray(versions) && versions.length > 0 ? versions : null;
    } catch {
      // No network, `file://`, or no such file. All mean "not a versioned build".
      return null;
    }
  }

  /**
   * The entry the reader is currently on.
   *
   * `latest/` is an alias for the current release, so a reader there is on whichever
   * entry carries `current: true`. Returns `null` for the unreleased folders and for any
   * folder not in the index — those are not a release, so there is nothing truthful to
   * say about how far behind they are.
   */
  function findCurrent(versions) {
    if (currentFolder === 'latest') return versions.find((v) => v.current) ?? null;
    return versions.find((v) => v.path === currentFolder || v.tag === currentFolder) ?? null;
  }

  /** The {@link UNRELEASED} entry for the folder the reader is in, or `null`. */
  const unreleasedHere = () => UNRELEASED.find((entry) => entry.folder === currentFolder) ?? null;

  /**
   * Unreleased folders to list: the one the reader is in, plus any `probe` folder that
   * exists on this site. The probe is one `HEAD` per page load and its result is what
   * makes a local build (no `main/`) and the published site behave correctly without
   * either being configured.
   */
  async function unreleasedOptions() {
    const found = [];
    for (const entry of UNRELEASED) {
      if (entry.folder === currentFolder) found.push(entry);
      else if (entry.probe && (await exists(pageIn(entry.folder, 'index.html')))) found.push(entry);
    }
    return found;
  }

  async function renderSwitcher(versions, active) {
    const host = document.getElementById('tsd-toolbar-links');
    if (!host) return;

    const label = document.createElement('label');
    label.className = 'cc-version-switcher';

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Documentation version');

    // `latest`, `main` and `dev` are real folders but not index entries, so they are
    // offered explicitly — otherwise a reader in `dev/` could never get back out.
    const options = [];
    if (currentFolder === 'latest' && !versions.some((v) => v.path === 'latest'))
      options.push({ value: 'latest', text: 'latest' });
    for (const entry of await unreleasedOptions()) options.push({ value: entry.folder, text: entry.label });
    for (const version of versions) {
      // A local single-folder build indexes the current release with `path: "latest"`,
      // already offered above — a second option with the same value would win the
      // `selected` race and misreport where the reader is.
      if (options.some((option) => option.value === version.path)) continue;
      options.push({
        value: version.path,
        text: version.current ? `v${version.version} (current)` : `v${version.version}`,
      });
    }

    const selected = currentFolder === 'latest' || unreleasedHere() ? currentFolder : (active?.path ?? null);

    for (const option of options) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.text;
      if (option.value === selected) element.selected = true;
      select.append(element);
    }
    // A folder outside the index, `latest` and the unreleased list: show it so the
    // control is not silently lying about where the reader is.
    if (selected === null) {
      const element = document.createElement('option');
      element.value = currentFolder;
      element.textContent = currentFolder || 'unversioned';
      element.selected = true;
      select.prepend(element);
    }

    select.addEventListener('change', async () => {
      const folder = select.value;
      select.disabled = true;
      const target = pageIn(folder, pagePath);
      // Pages get renamed across versions — `enhancers_…` became `features_…` in 0.4.31.
      // A missing page lands on that version's index rather than a 404.
      const href = (await exists(target)) ? target + window.location.hash : pageIn(folder, 'index.html');
      window.location.assign(href);
    });

    label.append(select);
    host.append(label);
  }

  /**
   * Element the banner is inserted before.
   *
   * The banner has to be a *sibling* of the container that lays the page out in
   * columns, never a child of it. On the default theme `.container-main` is that
   * container itself (`display: grid`, sidebar / content / TOC) and sits directly in
   * `<body>`, so the answer is `.container-main`. On clean-jsdoc-theme the class is an
   * alias this file puts on `<main>`, which is one cell of the theme's
   * `grid-cols-[16rem_minmax(0,1fr)_14rem]` row: inserting there made the banner a
   * fourth grid child, which pushed the page content into the 14rem TOC track and
   * stretched the banner down the full height of the page. So climb out of every
   * side-by-side parent first and insert above the whole row.
   */
  function bannerAnchor(start) {
    let node = start;
    for (let depth = 0; depth < 3; depth += 1) {
      const parent = node.parentElement;
      if (!parent || parent === document.body) return node;
      const style = getComputedStyle(parent);
      const sideBySide =
        style.display.includes('grid') || (style.display.includes('flex') && style.flexDirection.startsWith('row'));
      if (!sideBySide) return node;
      node = parent;
    }
    return node;
  }

  /**
   * Banner above the page, for the two ways a reader can be off the current release:
   * reading an older version, or reading an unreleased folder. Both point at the current
   * release, because that is the docs for the SDK a page actually loads.
   */
  function renderBanner(versions, active) {
    const current = versions.find((v) => v.current);
    if (!current) return;

    const unreleased = unreleasedHere();
    if (!unreleased && (!active || active.current)) return;

    const message = unreleased
      ? `You are reading unreleased docs, built from ${unreleased.source}. The current release is v${current.version}.`
      : `You are reading v${active.version}. Latest is v${current.version}.`;

    const main = document.querySelector('.container-main');
    if (!main) return;
    const anchor = bannerAnchor(main);

    const banner = document.createElement('aside');
    banner.className = 'cc-stale-banner';
    banner.setAttribute('role', 'note');

    const text = document.createElement('span');
    text.textContent = message;

    const link = document.createElement('a');
    link.textContent = `Go to v${current.version}`;
    link.href = pageIn(current.path, 'index.html');
    // Same page in the current release when it still exists there.
    void exists(pageIn(current.path, pagePath)).then((ok) => {
      if (ok) link.href = pageIn(current.path, pagePath);
    });

    // Inner row so the text lines up with the header and the page content, which are
    // both centred at the theme's max width, while the amber bar itself is full-bleed.
    const inner = document.createElement('div');
    inner.className = 'cc-stale-banner-inner';
    inner.append(text, link);
    banner.append(inner);
    anchor.parentNode?.insertBefore(banner, anchor);
  }

  /**
   * Sidebar sections. `path` is the page the switcher opens, inside the version folder;
   * `groups` the sidebar groups that belong to it whole (`docGroups` in typedoc.json);
   * `icon` is the inner markup of a 24×24 Lucide icon.
   */
  const SECTIONS = [
    {
      id: 'guides',
      name: 'Guides',
      blurb: 'Start and build pages',
      path: '',
      groups: ['Start Here', 'Building Pages', 'Recipes'],
      icon: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    },
    {
      id: 'attributes',
      name: 'Attributes',
      blurb: 'What a page can use',
      path: 'attributes',
      groups: ['Attribute Reference'],
      icon: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
    },
    {
      id: 'events',
      name: 'Events',
      blurb: 'What next.on receives',
      path: 'events',
      groups: ['Event Reference'],
      icon: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
    },
    {
      id: 'analytics',
      name: 'Analytics',
      blurb: 'Tracking events and destinations',
      path: 'analytics',
      groups: ['Analytics Reference'],
      icon: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    },
    {
      id: 'api',
      name: 'JavaScript API',
      blurb: 'window.next and types',
      path: 'javascript-api',
      groups: ['JavaScript API'],
      icon: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
    },
  ];

  /** The sidebar's nav: in the desktop island, and in the mobile drawer once it is opened. */
  const SIDEBAR = 'nav[aria-label="Documentation navigation"]';

  /** {@link versionRoot} as a folder: clean-jsdoc-theme's `basePath` has no trailing slash. */
  const sectionRoot = new URL(versionRoot.pathname.replace(/\/*$/, '/'), versionRoot);

  /** A sidebar link's page inside the version folder: `event-reference/carts/cart-added`. */
  const pageOf = (href) =>
    decodeURIComponent(new URL(href, window.location.href).pathname)
      .slice(decodeURIComponent(sectionRoot.pathname).length)
      .replace(/(\/index)?\.html$|\/+$/, '');

  /** The section of a page from its path, for a page whose sidebar link is not shown. */
  function sectionOfPage(page) {
    if (page === 'attributes' || page.startsWith('attribute-reference/')) return 'attributes';
    if (page === 'events' || page.startsWith('event-reference/')) return 'events';
    if (page === 'analytics' || page.startsWith('analytics-reference/')) return 'analytics';
    if (page === 'javascript-api') return 'api';
    return 'guides';
  }

  /**
   * Tags each top-level group of a sidebar with its section, by its heading rather than
   * its links: a collapsed group renders no links, and the theme remembers which groups
   * the reader collapsed. The two groups without a heading are Home and the pages TypeDoc
   * generates from the source (`NextApi`, `SdkEvent`, …). A heading no section names
   * stays untagged, so it shows in every section rather than in none.
   */
  function tagSidebar(nav) {
    for (const group of nav.children) {
      const heading = group.querySelector(':scope > button')?.textContent.trim();
      const section =
        heading === undefined
          ? [...group.querySelectorAll('a[href]')].some((link) => pageOf(link.href) !== '')
            ? 'api'
            : 'guides'
          : SECTIONS.find((candidate) => candidate.groups.includes(heading))?.id;
      if (section) group.dataset.ccSection = section;
      else delete group.dataset.ccSection;
    }
  }

  /** The current page's section: the group holding its sidebar link, else its path. */
  function currentSection(nav) {
    const here = pageOf(window.location.href);
    const link = [...nav.querySelectorAll('a[href]')].find((candidate) => pageOf(candidate.href) === here);
    return link?.closest(`${SIDEBAR} > div`)?.dataset.ccSection ?? sectionOfPage(here);
  }

  const icon = (section, className) =>
    `<span class="${className}" data-cc-section="${section.id}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${section.icon}</svg></span>`;

  const labels = (section) =>
    `<span class="cc-section-text"><span class="cc-section-name">${section.name}</span><span class="cc-section-blurb">${section.blurb}</span></span>`;

  function renderSectionSwitcher(nav, active) {
    const current = SECTIONS.find((section) => section.id === active);
    const root = document.createElement('div');
    root.className = 'cc-sections';
    root.innerHTML = `<button type="button" class="cc-section-current" aria-haspopup="true" aria-expanded="false">
  ${icon(current, 'cc-section-icon')}${labels(current)}
  <svg class="cc-section-chevrons" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
</button>
<ul class="cc-section-menu" hidden>${SECTIONS.map(
      (
        section,
      ) => `<li><a href="${new URL(section.path, sectionRoot).href}"${section.id === active ? ' aria-current="page"' : ''}>
  ${icon(section, 'cc-section-icon')}${labels(section)}
  ${section.id === active ? '<svg class="cc-section-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' : ''}
</a></li>`,
    ).join('')}</ul>`;

    const button = root.querySelector('button');
    const menu = root.querySelector('ul');
    // Fixed, under the button: the sidebar scrolls, and clips whatever overflows it.
    const open = (show) => {
      if (show) {
        const { bottom, left, width } = button.getBoundingClientRect();
        Object.assign(menu.style, { top: `${bottom + 4}px`, left: `${left}px`, width: `${width}px` });
      }
      menu.hidden = !show;
      button.setAttribute('aria-expanded', String(show));
    };
    const close = () => !menu.hidden && open(false);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    button.addEventListener('click', () => open(menu.hidden));
    document.addEventListener('click', (event) => {
      if (!root.contains(event.target)) open(false);
    });
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || menu.hidden) return;
      open(false);
      button.focus();
    });
    // The desktop island re-renders its own children, so the switcher goes beside it.
    (nav.closest('[data-island="sidebar"]') ?? nav).before(root);
  }

  /**
   * Tags every sidebar nav and gives it a switcher, again whenever the page changes: the
   * island re-renders, a group opens, or the mobile drawer adds its own nav.
   */
  function startSections() {
    const first = document.querySelector(SIDEBAR);
    if (!first) return;
    tagSidebar(first);
    const active = currentSection(first);
    document.documentElement.dataset.ccSection = active;
    const withSwitcher = new WeakSet();
    let queued = false;
    const scan = () => {
      queued = false;
      for (const nav of document.querySelectorAll(SIDEBAR)) {
        tagSidebar(nav);
        if (withSwitcher.has(nav)) continue;
        withSwitcher.add(nav);
        renderSectionSwitcher(nav, active);
      }
    };
    scan();
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(scan);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Styles for the elements above.
   *
   * They live here rather than in `docs/assets/typedoc.css` so the switchers stay one
   * self-contained unit: nothing to keep in sync, and no dead CSS in the stylesheet of an
   * unversioned build. TypeDoc's own custom properties are reused, so both themes work.
   */
  const STYLES = `
.cc-version-switcher select {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  padding: 2px 4px;
  font: inherit;
  font-size: 0.875em;
}
.cc-stale-banner {
  margin: 0;
  padding: 0.75rem 1rem;
  /* Fixed amber, not a theme variable. TypeDoc's --color-warning-text is a *text*
     colour and reads near-black in the light theme, which made the banner
     dark-on-dark. A warning is the same amber in both themes on purpose. */
  background: #f6c344;
  color: #1c1c1c;
}
.cc-stale-banner-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75em;
  align-items: baseline;
  /* Tailwind's screen-2xl, the width clean-jsdoc-theme centres its header and page
     grid at. Wider than the default theme's container, which centres inside it. */
  max-width: 96rem;
  margin-inline: auto;
}
.cc-stale-banner a { color: inherit; font-weight: 700; }
${SECTIONS.map(
  ({ id }) =>
    `html[data-cc-section='${id}'] ${SIDEBAR} > div[data-cc-section]:not([data-cc-section='${id}']) { display: none; }`,
).join('\n')}
.cc-sections { position: relative; margin: 0 0 1rem; }
.cc-section-current, .cc-section-menu a {
  display: flex; align-items: center; gap: 0.75rem; width: 100%;
  padding: 0.5rem 0.625rem; border-radius: 0.75rem; text-align: left;
  color: var(--clean-fg); text-decoration: none; font: inherit;
}
.cc-section-current {
  border: 1px solid var(--clean-border); background: var(--clean-bg-muted); cursor: pointer;
}
.cc-section-current:hover, .cc-section-menu a:hover { background: var(--clean-bg-muted); }
.cc-section-current:focus-visible, .cc-section-menu a:focus-visible { outline: 2px solid var(--clean-accent); outline-offset: 1px; }
.cc-section-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.cc-section-name { font-size: 0.875rem; font-weight: 600; }
.cc-section-blurb { font-size: 0.75rem; color: var(--clean-fg-muted); }
.cc-section-name, .cc-section-blurb { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-section-chevrons, .cc-section-check { margin-left: auto; flex-shrink: 0; color: var(--clean-fg-muted); }
.cc-section-check { color: var(--clean-accent); }
.cc-section-icon {
  display: grid; place-items: center; flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 0.5rem;
  color: var(--cc-hue); background: color-mix(in srgb, var(--cc-hue) 14%, transparent);
}
.cc-section-icon[data-cc-section='guides'] { --cc-hue: #2563eb; }
.cc-section-icon[data-cc-section='attributes'] { --cc-hue: #ea580c; }
.cc-section-icon[data-cc-section='events'] { --cc-hue: #db2777; }
.cc-section-icon[data-cc-section='analytics'] { --cc-hue: #7c3aed; }
.cc-section-icon[data-cc-section='api'] { --cc-hue: #059669; }
.cc-section-menu {
  position: fixed; z-index: 60;
  margin: 0; padding: 0.25rem; list-style: none;
  background: var(--clean-bg); border: 1px solid var(--clean-border); border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
}
.cc-section-menu[hidden] { display: none; }
`;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.append(style);
  }

  async function start() {
    injectStyles();
    startSections();
    const versions = await loadVersions();
    if (!versions) return;
    const active = findCurrent(versions);
    await renderSwitcher(versions, active);
    renderBanner(versions, active);
  }

  void start();
})();
