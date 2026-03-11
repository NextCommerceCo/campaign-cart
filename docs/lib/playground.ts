import fs from "node:fs";
import path from "node:path";

export interface PlaygroundExample {
  id: string;
  title: string;
  description: string;
  category: string;
  order: number;
  layout: string;
  code: string;
}

const PLAYGROUND_DIR = path.join(process.cwd(), "content/playground");

/**
 * Parse the leading HTML comment block as key: value frontmatter.
 * Supports: title, description, order
 *
 * Example comment:
 *   <!--
 *   title: Package Selector
 *   description: Select a package and add it to the cart.
 *   order: 1
 *   -->
 */
function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  code: string;
} {
  const match = raw.match(/^<!--\s*([\s\S]*?)-->/);
  if (!match) return { meta: {}, code: raw.trim() };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key) meta[key] = value;
  }

  const code = raw.slice(match[0].length).trim();
  return { meta, code };
}

/** Load all .html files under content/playground/<category>/ */
export function loadPlaygroundExamples(): PlaygroundExample[] {
  const examples: PlaygroundExample[] = [];

  const categories = fs
    .readdirSync(PLAYGROUND_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const catDir = path.join(PLAYGROUND_DIR, category);
    const files = fs
      .readdirSync(catDir)
      .filter((f) => f.endsWith(".html"))
      .sort();

    for (const file of files) {
      const raw = fs.readFileSync(path.join(catDir, file), "utf-8");
      const { meta, code } = parseFrontmatter(raw);

      // Derive a stable id from the folder + filename
      const id = `${category}/${file.replace(".html", "")}`;

      examples.push({
        id,
        title: meta.title ?? file.replace(".html", "").replace(/-/g, " "),
        description: meta.description ?? "",
        category: capitalize(category),
        order: meta.order ? Number(meta.order) : 99,
        layout: meta.layout ?? "",
        code,
      });
    }
  }

  // Sort by category alphabetically, then by order within each category
  examples.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.order - b.order;
  });

  return examples;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
