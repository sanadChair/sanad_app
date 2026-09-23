export const DEFAULT_ROSBRIDGE_PORT = 9090;
export const DEFAULT_ROSBRIDGE_URL_FALLBACK = 'ws://localhost:9090';

/** Accept "1.2.3.4", "1.2.3.4:9090", "ws://host:9090" → canonical ws://host:port. */
export function normalizeWsUrl(input: string, defaultPort = DEFAULT_ROSBRIDGE_PORT): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (hasScheme && !/^wss?:\/\//i.test(raw)) return null;
  const withScheme = /^wss?:\/\//i.test(raw) ? raw : `ws://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return null;
    if (!u.hostname) return null;
    const port = u.port || String(defaultPort);
    return `${u.protocol}//${u.hostname}:${port}`;
  } catch {
    return null;
  }
}
