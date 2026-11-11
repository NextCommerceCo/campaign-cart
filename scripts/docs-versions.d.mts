export interface DocsVersion {
  version: string;
  tag: string;
  path: string;
  current: boolean;
}
export function buildVersionIndex(options?: {
  floor?: string;
  root?: string;
  all?: boolean;
  local?: boolean;
  cwd?: string;
}): { versions: DocsVersion[] };
