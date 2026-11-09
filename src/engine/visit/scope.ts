export function funnelFromPath(pathname: string): string {
  return /^\/([^/]+)\//.exec(pathname)?.[1]?.toLowerCase() ?? '';
}

export function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function storageScope(apiKey: string, funnel: string): string {
  return hash(`${apiKey}\n${funnel}`);
}
