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
 *   2. Shows a banner when the reader is on an older version than the current release.
 *
 * It does nothing at all when `versions.json` is absent — that is the normal state of an
 * unversioned local `npm run docs` build, and a warning-free no-op is the correct
 * behaviour there.
 */

(() => {
  'use strict';

  /**
   * The version folder's root URL.
   *
   * TypeDoc stamps `data-base` on `<html>` with the relative path from the current page
   * back to the build root — `./` on the index, `../` inside `documents/`. That is the
   * only reliable way to find the root from a page at unknown depth.
   */
  const versionRoot = new URL(
    document.documentElement.dataset.base || './',
    window.location.href
  );

  /** The site root — one level above the version folder, where `versions.json` lives. */
  const siteRoot = new URL('../', versionRoot);

  /** Folder name the reader is in: `v0.4.30`, `latest`, `dev`, or a plain build's folder. */
  const currentFolder = decodeURIComponent(
    versionRoot.pathname.replace(/\/+$/, '').split('/').pop() || ''
  );

  /**
   * Path of the current page inside its version folder, e.g.
   * `documents/features_cart_add-to-cart_guide_overview.html`.
   */
  const pagePath = decodeURIComponent(window.location.pathname).slice(
    decodeURIComponent(versionRoot.pathname).length
  );

  /** Resolves a page path inside another version folder. */
  const pageIn = (folder, path) =>
    new URL(`${encodeURIComponent(folder)}/${path}`, siteRoot).href;

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
   * entry carries `current: true`. Returns `null` for `dev/` and for any folder not in
   * the index — those get the switcher but no stale banner, because there is nothing
   * truthful to say about how far behind they are.
   */
  function findCurrent(versions) {
    if (currentFolder === 'latest')
      return versions.find(v => v.current) ?? null;
    return (
      versions.find(v => v.path === currentFolder || v.tag === currentFolder) ??
      null
    );
  }

  function renderSwitcher(versions, active) {
    const host = document.getElementById('tsd-toolbar-links');
    if (!host) return;

    const label = document.createElement('label');
    label.className = 'cc-version-switcher';

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Documentation version');

    // `latest` and `dev` are real folders but not index entries, so they are offered
    // explicitly — otherwise a reader in `dev/` could never get back out.
    const options = [];
    if (currentFolder === 'latest')
      options.push({ value: 'latest', text: 'latest' });
    if (currentFolder === 'dev')
      options.push({ value: 'dev', text: 'dev (unreleased)' });
    for (const version of versions) {
      options.push({
        value: version.path,
        text: version.current
          ? `v${version.version} (current)`
          : `v${version.version}`,
      });
    }

    const selected =
      currentFolder === 'latest' || currentFolder === 'dev'
        ? currentFolder
        : (active?.path ?? null);

    for (const option of options) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.text;
      if (option.value === selected) element.selected = true;
      select.append(element);
    }
    // A folder outside the index and outside latest/dev: show it so the control is not
    // silently lying about where the reader is.
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
      const href = (await exists(target))
        ? target + window.location.hash
        : pageIn(folder, 'index.html');
      window.location.assign(href);
    });

    label.append(select);
    host.append(label);
  }

  function renderStaleBanner(versions, active) {
    if (!active || active.current) return;
    const latest = versions.find(v => v.current);
    if (!latest) return;

    const main = document.querySelector('.container-main');
    if (!main) return;

    const banner = document.createElement('aside');
    banner.className = 'cc-stale-banner';
    banner.setAttribute('role', 'note');

    const text = document.createElement('span');
    text.textContent = `You are reading v${active.version}. Latest is v${latest.version}.`;

    const link = document.createElement('a');
    link.textContent = `Go to v${latest.version}`;
    link.href = pageIn(latest.path, 'index.html');
    // Same page in the latest version when it still exists there.
    void exists(pageIn(latest.path, pagePath)).then(ok => {
      if (ok) link.href = pageIn(latest.path, pagePath);
    });

    banner.append(text, link);
    main.parentNode?.insertBefore(banner, main);
  }

  /**
   * Styles for the two elements above.
   *
   * They live here rather than in `docs/assets/typedoc.css` so the switcher stays one
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
  display: flex;
  flex-wrap: wrap;
  gap: 0.75em;
  align-items: baseline;
  margin: 0;
  padding: 0.75em 1.25em;
  /* Fixed amber, not a theme variable. TypeDoc's --color-warning-text is a *text*
     colour and reads near-black in the light theme, which made the banner
     dark-on-dark. A warning is the same amber in both themes on purpose. */
  background: #f6c344;
  color: #1c1c1c;
}
.cc-stale-banner a { color: inherit; font-weight: 700; }
`;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.append(style);
  }

  async function start() {
    const versions = await loadVersions();
    if (!versions) return;
    const active = findCurrent(versions);
    injectStyles();
    renderSwitcher(versions, active);
    renderStaleBanner(versions, active);
  }

  void start();

  // --- mermaid init (Phase 11) — spliced from docs/assets/mermaid-init.snippet.js.
  // customJs takes exactly one path, so both site features live in this file.
  /*
   * Renders TypeDoc's fenced ```mermaid blocks as diagrams.
   *
   * TypeDoc (0.28, verified against a real build of this repo) emits a fenced
   * mermaid block as:
   *   <pre><code class="mermaid">RAW_SOURCE</code><button type="button">Copy</button></pre>
   * and logs "Code block with language mermaid will not be highlighted" — it
   * never renders it. This snippet is the fix.
   *
   * Needs the UMD bundle at docs/assets/vendor/mermaid.min.js (offline-vendored
   * from the `mermaid` npm package — no CDN, the site must work offline). This
   * file loads that bundle itself, lazily, only on pages that actually contain
   * a mermaid block — most of the 882-page site has none, so the other pages
   * never pay for the 3.5 MB download. If the vendor file is missing (script
   * load fails) or `window.mermaid` never appears, every fenced block is left
   * exactly as TypeDoc rendered it: visible source, no diagram, no thrown error.
   *
   * This file is NOT loaded directly — `customJs` accepts exactly one path,
   * already spoken for by docs/assets/site.js (version switcher). The lead
   * splices this IIFE verbatim into that file at build/integration time. No
   * typedoc.json change is needed for this file itself: it derives the site's
   * root-relative asset path the same way TypeDoc's own main.js does — reading
   * `document.documentElement.dataset.base` (`"./"` at the site root, `"../"`
   * one level down under documents/ or classes/, etc.) — so it resolves
   * correctly regardless of page depth or which version folder it is served
   * from.
   *
   * Theme: TypeDoc's own theme toggle (assets/main.js) sets
   * `document.documentElement.dataset.theme` to 'light' | 'dark' | 'os'; 'os'
   * defers to `prefers-color-scheme`. Because a reader can flip that toggle
   * without a reload, a MutationObserver on the `data-theme` attribute
   * re-renders every diagram in the new theme.
   */
  (function () {
    if (typeof document === 'undefined') return;

    // Raw mermaid source per diagram, keyed by array index — mermaid.run()
    // overwrites the host element's textContent with rendered SVG, so the
    // source must be kept elsewhere to re-render on a theme change.
    var sources = [];
    var hosts = [];

    function prefersDark() {
      return (
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }

    function resolveMermaidTheme() {
      var pref = document.documentElement.dataset.theme;
      if (pref === 'dark') return 'dark';
      if (pref === 'light') return 'default';
      return prefersDark() ? 'dark' : 'default'; // pref === 'os' or unset
    }

    function collectHosts() {
      // First run: replace each <pre><code class="mermaid"> with a bare
      // <div class="mermaid"> holding the same source. A <pre> forces
      // monospace/pre-formatted layout that fights the rendered SVG, and
      // mermaid's own CSS targets a plain container.
      var blocks = document.querySelectorAll('pre > code.mermaid');
      blocks.forEach(function (code) {
        var pre = code.parentElement;
        var source = code.textContent || '';
        var host = document.createElement('div');
        host.className = 'mermaid';
        host.textContent = source;
        pre.replaceWith(host);
        hosts.push(host);
        sources.push(source);
      });
    }

    function resetForRerender() {
      // mermaid.run() skips nodes carrying data-processed="true"; clear it and
      // restore the raw source so the next run actually re-renders instead of
      // silently no-op'ing on the already-converted SVG.
      hosts.forEach(function (host, i) {
        host.removeAttribute('data-processed');
        host.textContent = sources[i];
      });
    }

    function render() {
      if (!window.mermaid) return; // vendor bundle absent — degrade to source

      if (hosts.length === 0) {
        collectHosts();
      } else {
        resetForRerender();
      }
      if (hosts.length === 0) return; // no mermaid blocks on this page

      window.mermaid.initialize({
        startOnLoad: false,
        theme: resolveMermaidTheme(),
        securityLevel: 'strict',
      });
      window.mermaid.run({ nodes: hosts, suppressErrors: true });
    }

    function watchThemeToggle() {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].attributeName === 'data-theme') {
            render();
            break;
          }
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }

    function assetsBase() {
      var base = document.documentElement.dataset.base || './';
      if (base.slice(-1) !== '/') base += '/';
      return base + 'assets/';
    }

    function loadVendorBundle(done) {
      if (window.mermaid) {
        done();
        return;
      }
      var script = document.createElement('script');
      script.src = assetsBase() + 'vendor/mermaid.min.js';
      script.onload = done;
      script.onerror = done; // render() no-ops safely without window.mermaid
      document.head.appendChild(script);
    }

    function init() {
      // Skip the 3.5 MB vendor download entirely on the ~878 pages that carry
      // no diagram.
      if (!document.querySelector('pre > code.mermaid')) return;

      loadVendorBundle(function () {
        render();
        watchThemeToggle();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
})();
