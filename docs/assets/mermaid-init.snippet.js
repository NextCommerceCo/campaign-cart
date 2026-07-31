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
