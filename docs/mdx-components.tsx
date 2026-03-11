import defaultComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import {
  createGenerator,
  createFileSystemGeneratorCache,
} from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";
import * as Twoslash from "fumadocs-twoslash/ui";

const generator = createGenerator({
  // set a cache, necessary for serverless platform like Vercel
  cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
});

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...Twoslash,
    AutoTypeTable: (props) => (
      <AutoTypeTable {...props} generator={generator} />
    ),
    ...components,
  };
}
