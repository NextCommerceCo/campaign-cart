# Starlight Documentation Framework - Complete LLM Reference

## FRAMEWORK OVERVIEW
Starlight is a documentation framework built on Astro. Use this guide to build professional documentation sites with zero setup.

## INSTALLATION & SETUP

### Quick Start
```bash
npm create astro@latest project-name -- --template starlight
cd project-name
npm run dev
```

### Manual Setup
```bash
npx astro add starlight
```

## CONFIGURATION PATTERNS

### Basic astro.config.mjs
```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Docs Site',
      description: 'Site description',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/user/repo' },
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/invite' },
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Getting Started', slug: 'guides/start' },
            { label: 'Advanced', slug: 'guides/advanced' },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
```

### Advanced Configuration
```js
starlight({
  title: {
    en: 'English Title',
    es: 'Título Español',
  },
  defaultLocale: 'en',
  locales: {
    en: { label: 'English' },
    es: { label: 'Español', lang: 'es' },
    fr: { label: 'Français', lang: 'fr' },
    ar: { label: 'العربية', dir: 'rtl' },
  },
  editLink: {
    baseUrl: 'https://github.com/user/repo/edit/main/docs/',
  },
  lastUpdated: true,
  pagination: true,
  tableOfContents: {
    minHeadingLevel: 2,
    maxHeadingLevel: 4,
  },
  expressiveCode: {
    themes: ['starlight-dark', 'starlight-light'],
  },
  components: {
    Header: './src/components/CustomHeader.astro',
    Footer: './src/components/CustomFooter.astro',
  },
  head: [
    { tag: 'meta', attrs: { name: 'theme-color', content: '#8B5CF6' } },
  ],
})
```

### Content Collection Setup (content.config.ts)
```ts
import { defineCollection, z } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        author: z.string().optional(),
      })
    })
  }),
  i18n: defineCollection({
    loader: i18nLoader(),
    schema: i18nSchema()
  })
};
```

## COMPONENT USAGE PATTERNS

### Import Components
```mdx
import { 
  Card, 
  CardGrid, 
  Tabs, 
  TabItem, 
  Steps,
  Aside,
  Badge,
  FileTree,
  LinkButton,
  Icon,
  Code 
} from '@astrojs/starlight/components';
```

### Asides/Callouts
```markdown
:::note
Blue note callout
:::

:::tip[Custom Title]
Purple tip with custom title
:::

:::caution
Orange warning callout
:::

:::danger
Red danger callout
:::
```

### Cards & Grids
```mdx
<Card title="Single Card" icon="star">
Content with **markdown** support
</Card>

<CardGrid>
  <Card title="First Card" icon="rocket">
    Grid layout automatically responsive
  </Card>
  <Card title="Second Card" icon="moon">
    1-2 columns based on screen size
  </Card>
  <Card title="Third Card" icon="puzzle">
    Perfect for feature highlights
  </Card>
</CardGrid>
```

### Interactive Tabs
```mdx
<Tabs>
  <TabItem label="npm" icon="seti:npm">
    ```bash
    npm install package
    ```
  </TabItem>
  <TabItem label="yarn" icon="seti:yarn">
    ```bash
    yarn add package
    ```
  </TabItem>
  <TabItem label="pnpm" icon="pnpm">
    ```bash
    pnpm add package
    ```
  </TabItem>
</Tabs>

<!-- Synchronized tabs across pages -->
<Tabs syncKey="package-manager">
  <TabItem label="npm">npm content</TabItem>
  <TabItem label="yarn">yarn content</TabItem>
</Tabs>
```

### Step-by-Step Instructions
```mdx
<Steps>
1. **Install dependencies**
   ```bash
   npm install
   ```
   
2. **Configure the project**
   Edit your `astro.config.mjs` file
   
3. **Start development server**
   ```bash
   npm run dev
   ```
</Steps>
```

### File Tree Structure
```mdx
<FileTree>
- src/
  - components/
    - **Header.astro** important file
    - Footer.astro
  - content/
    - docs/
      - index.mdx
      - guides/
        - getting-started.md
  - styles/
    - custom.css
- astro.config.mjs
- package.json
</FileTree>
```

### Badges & Buttons
```mdx
<Badge text="New" variant="tip" />
<Badge text="Deprecated" variant="caution" />

<LinkButton href="/getting-started/">
  Get Started
</LinkButton>

<LinkButton href="https://github.com" variant="secondary">
  View on GitHub
</LinkButton>
```

### Enhanced Code Blocks
```mdx
<Code 
  code={`console.log('Hello World');`} 
  lang="js" 
  title="example.js"
  mark={["Hello"]}
  ins={[1]} 
  del={[2]}
/>
```

### Icons
```mdx
<Icon name="star" />
<Icon name="github" size="2rem" color="goldenrod" />
```

## SIDEBAR CONFIGURATION PATTERNS

### Manual Sidebar
```js
sidebar: [
  { label: 'Home', link: '/' },
  { slug: 'introduction' },
  { label: 'External', link: 'https://example.com' },
  {
    label: 'Guides',
    items: [
      'guides/setup',
      { label: 'Advanced Topics', slug: 'guides/advanced' }
    ]
  },
  {
    label: 'API Reference',
    autogenerate: { directory: 'api' },
    collapsed: true
  },
  {
    label: 'New Section',
    badge: { text: 'Beta', variant: 'caution' },
    items: [
      { slug: 'new-feature', badge: 'New' }
    ]
  }
]
```

## FRONTMATTER PATTERNS

### Basic Page
```yaml
---
title: Page Title
description: SEO description
---
```

### Advanced Page
```yaml
---
title: Advanced Guide
description: Complete guide with examples
slug: custom-url-slug
sidebar:
  label: Custom Label
  order: 5
  badge: New
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 4
editUrl: https://github.com/user/repo/edit/main/docs/file.md
lastUpdated: true
prev:
  link: /previous-page/
  label: Previous Topic
next:
  link: /next-page/
  label: Next Topic
---
```

### Splash Page (Landing)
```yaml
---
title: Welcome
template: splash
hero:
  title: 'Documentation Site'
  tagline: 'Build amazing docs with Starlight'
  image:
    file: ~/assets/hero.png
    alt: Hero image
  actions:
    - text: Get Started
      link: /getting-started/
      icon: right-arrow
      variant: primary
    - text: View Examples
      link: /examples/
      icon: external
      variant: minimal
banner:
  content: |
    🎉 New version available! 
    <a href="/changelog/">See what's new</a>
---
```

## STYLING & THEMING

### Custom CSS Variables
```css
/* src/styles/custom.css */
:root {
  /* Colors */
  --sl-color-accent: #4f46e5;
  --sl-color-accent-high: #1e1b4b;
  --sl-color-accent-low: #f0f3ff;
  
  /* Typography */
  --sl-font: 'Inter', system-ui, sans-serif;
  --sl-font-mono: 'JetBrains Mono', monospace;
  --sl-text-base: 1rem;
  
  /* Layout */
  --sl-content-width: 50rem;
  --sl-sidebar-width: 20rem;
  
  /* Borders & Shadows */
  --sl-border-radius: 0.5rem;
  --sl-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Dark mode */
:root[data-theme='dark'] {
  --sl-color-accent: #8b5cf6;
  --sl-color-accent-high: #f0f3ff;
  --sl-color-accent-low: #1e1b4b;
}

/* Component customization */
.starlight-aside {
  --sl-color-asides-border: var(--sl-color-accent);
}
```

### Tailwind Integration
```css
@import '@astrojs/starlight-tailwind';
```

## INTERNATIONALIZATION

### Setup
```js
// astro.config.mjs
starlight({
  defaultLocale: 'en',
  locales: {
    root: { label: 'English', lang: 'en' },
    es: { label: 'Español', lang: 'es' },
    'zh-cn': { label: '简体中文', lang: 'zh-CN' },
  }
})
```

### Translation Files
```json
// src/content/i18n/es.json
{
  "skipLink.label": "Saltar al contenido",
  "search.label": "Buscar",
  "themeSelect.dark": "Oscuro",
  "page.editLink": "Editar página",
  "404.text": "Página no encontrada"
}
```

### Content Structure
```
src/content/docs/
├── index.mdx          # Default locale
├── introduction.md    # Default locale
├── es/
│   ├── index.mdx      # Spanish
│   └── introduction.md
└── zh-cn/
    ├── index.mdx      # Chinese
    └── introduction.md
```

## COMPONENT OVERRIDE PATTERNS

### Custom Header
```astro
---
// src/components/CustomHeader.astro
import type { Props } from '@astrojs/starlight/props';
import Default from '@astrojs/starlight/components/Header.astro';
---

<Default {...Astro.props}>
  <div slot="before-social">
    Custom content before social links
  </div>
</Default>
```

### Custom 404 Page
```astro
---
// src/pages/404.astro
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';
---

<StarlightPage frontmatter={{ title: '404 - Page Not Found' }}>
  <div class="not-found">
    <h1>Oops! Page not found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">Go back home</a>
  </div>
</StarlightPage>
```

## PLUGIN DEVELOPMENT

### Custom Plugin
```ts
// src/plugins/custom-plugin.ts
import type { StarlightPlugin } from '@astrojs/starlight/types';

export function customPlugin(): StarlightPlugin {
  return {
    name: 'custom-plugin',
    hooks: {
      'config:setup'({ config, updateConfig }) {
        updateConfig({
          sidebar: [
            ...config.sidebar,
            { label: 'Plugin Page', slug: 'plugin-page' }
          ]
        });
      }
    }
  };
}
```

## CONTENT ORGANIZATION BEST PRACTICES

### Directory Structure
```
src/content/docs/
├── index.mdx              # Homepage
├── getting-started/
│   ├── installation.md
│   ├── configuration.md
│   └── first-steps.md
├── guides/
│   ├── beginner/
│   ├── intermediate/
│   └── advanced/
├── components/
│   ├── overview.md
│   ├── cards.md
│   └── tabs.md
├── api/
│   ├── authentication.md
│   ├── endpoints.md
│   └── errors.md
└── reference/
    ├── configuration.md
    ├── cli.md
    └── troubleshooting.md
```

## DEPLOYMENT

### Build Commands
```bash
npm run build        # Build for production
npm run preview      # Preview production build
```

### Static Hosting (Netlify, Vercel, etc.)
- Build command: `npm run build`
- Publish directory: `dist`

### GitHub Pages
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v2
        id: deployment
```

## PERFORMANCE OPTIMIZATION

### Image Optimization
```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.png';
---

<Image src={heroImage} alt="Hero" width={800} height={600} />
```

### Code Splitting
```js
// Dynamic imports for heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent.astro'));
```

## COMMON PATTERNS

### Landing Page
```mdx
---
title: Welcome
template: splash
hero:
  title: 'My Documentation'
  tagline: 'Everything you need to know'
  actions:
    - text: Get Started
      link: /getting-started/
      icon: right-arrow
---

import { Card, CardGrid } from '@astrojs/starlight/components';

<CardGrid>
  <Card title="Quick Start" icon="rocket">
    Get up and running in minutes
  </Card>
  <Card title="Guides" icon="document">
    Step-by-step tutorials
  </Card>
  <Card title="API Reference" icon="setting">
    Complete API documentation
  </Card>
</CardGrid>
```

### Guide Page
```mdx
---
title: Getting Started Guide
description: Learn the basics
---

import { Steps, Tabs, TabItem, Aside } from '@astrojs/starlight/components';

<Aside type="tip">
This guide will take about 15 minutes to complete.
</Aside>

<Steps>
1. **Install the package**
   
   <Tabs>
     <TabItem label="npm">
       ```bash
       npm install package-name
       ```
     </TabItem>
     <TabItem label="yarn">
       ```bash
       yarn add package-name
       ```
     </TabItem>
   </Tabs>

2. **Configure your project**
   
   Edit your configuration file...

3. **Start using the features**
   
   You're all set!
</Steps>
```

This reference covers all major Starlight patterns. Use it to build any documentation site efficiently.