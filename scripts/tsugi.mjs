import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'NextCommerceCo/tsugi';
const COMPONENTS = ['badge', 'button', 'card', 'input', 'native-select'];
const OUT = 'vendor/tsugi/tsugi.css';

const current = existsSync(OUT) ? readFileSync(OUT, 'utf8').match(/^\/\*! tsugi ([^\s:]+)/)?.[1] : undefined;
const tag = process.argv[2] ?? current;
if (!tag) {
  console.error('Usage: npm run tsugi -- <tag>, a release tag of github.com/NextCommerceCo/tsugi such as 0.1.6');
  process.exit(1);
}

const source = (path) =>
  Buffer.from(
    execFileSync('gh', ['api', `repos/${REPO}/contents/src/css/${path}?ref=${tag}`, '--jq', '.content'], {
      encoding: 'utf8',
    }),
    'base64',
  ).toString('utf8');

const replace = (text, pattern, value, what) => {
  if (!pattern.test(text)) throw new Error(`tsugi ${tag}: no longer has ${what}; update scripts/tsugi.mjs`);
  return text.replace(pattern, value);
};

let base = source('base/base.css');
base = replace(base, /@font-face\s*\{[^}]*\}\s*/g, '', 'its @font-face rules');
base = replace(base, /@custom-variant dark \([^;]*\);/, '@custom-variant dark (:host(.dark) &);', 'a dark variant');
base = replace(base, /^:root\s*\{/m, ':host {', 'a :root token block');
base = replace(base, /^\.dark\s*\{/m, ':host(.dark) {', 'a .dark token block');
base = replace(base, /\n\s*html\s*\{[^}]*\}/, '', 'an html rule');
base = replace(base, /\n\s*body\s*\{[^}]*\}/, '', 'a body rule');
base = replace(base, /^@theme \{/m, '@theme static {', 'a @theme block for fonts and radii');

const dir = mkdtempSync(join('node_modules', '.tsugi-'));
try {
  writeFileSync(join(dir, 'base.css'), base);
  for (const name of COMPONENTS) writeFileSync(join(dir, `${name}.css`), source(`components/${name}.css`));
  writeFileSync(
    join(dir, 'entry.css'),
    ['@import "tailwindcss/theme.css" layer(theme);', '@import "./base.css";']
      .concat(COMPONENTS.map((name) => `@import "./${name}.css";`))
      .join('\n'),
  );
  execFileSync('npx', ['@tailwindcss/cli', '-i', join(dir, 'entry.css'), '-o', join(dir, 'out.css'), '--minify'], {
    stdio: 'inherit',
  });
  let css = readFileSync(join(dir, 'out.css'), 'utf8').replace(/^\/\*![^*]*\*\/\s*/, '');
  css = replace(
    css,
    /@layer properties\{@supports [^{]*\{(\*,:before,:after,::backdrop\{[^}]*\})\}\}/,
    '@layer properties{$1}',
    "Tailwind's --tw-* defaults, which a shadow root needs since it ignores @property",
  );
  css = replace(css, /@property [^{]+\{[^}]*\}/g, '', '@property rules');
  mkdirSync('vendor/tsugi', { recursive: true });
  writeFileSync(
    OUT,
    `/*! tsugi ${tag}: base and ${COMPONENTS.join(', ')}, made for a shadow root by scripts/tsugi.mjs. Do not edit; run npm run tsugi -- <tag>. */\n${css}\n`,
  );
  console.log(`${OUT}: tsugi ${tag}, ${(css.length / 1024).toFixed(1)} KB`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
