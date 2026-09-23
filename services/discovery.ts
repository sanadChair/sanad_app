import NetInfo from '@react-native-community/netinfo';
import { DEFAULT_ROSBRIDGE_PORT } from './wsUrl';

export { DEFAULT_ROSBRIDGE_PORT, DEFAULT_ROSBRIDGE_URL_FALLBACK, normalizeWsUrl } from './wsUrl';

const PROBE_TIMEOUT_MS = 600;
const SCAN_CONCURRENCY = 24;
/** Never scan wider than a /24 (254 hosts) even if the netmask is larger. */
const MAX_SCAN_PREFIX = 24;
const MIN_SCAN_PREFIX = 29;

export type ScanProgress = {
  done: number;
  total: number;
  found: string[];
};

export function parseIPv4(ip: string): number[] | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

/** "255.255.255.0" → 24. Null if not a valid contiguous mask. */
export function prefixFromMask(mask: string): number | null {
  const parts = parseIPv4(mask);
  if (!parts) return null;
  const bits = parts.map((n) => n.toString(2).padStart(8, '0')).join('');
  if (!/^1*0*$/.test(bits)) return null;
  const zeroAt = bits.indexOf('0');
  return zeroAt === -1 ? 32 : zeroAt;
}

/**
 * Hosts to probe on the LAN around `localIp`, excluding self / network / broadcast.
 * Uses subnetMask when it yields a small LAN (/25–/29); otherwise defaults to /24
 * (capped so a /16 office network does not turn into a 65k scan).
 */
export function buildScanTargets(
  localIp: string,
  subnetMask?: string | null,
  port = DEFAULT_ROSBRIDGE_PORT,
): { hosts: string[]; urls: string[]; cidr: number } {
  const ip = parseIPv4(localIp);
  if (!ip) throw new Error(`Invalid local IP: ${localIp}`);

  let cidr = MAX_SCAN_PREFIX;
  if (subnetMask) {
    const p = prefixFromMask(subnetMask);
    if (p !== null && p > MAX_SCAN_PREFIX && p <= MIN_SCAN_PREFIX) {
      cidr = p;
    }
  }

  const hosts: string[] = [];
  if (cidr < 32) {
    const count = 2 ** (32 - cidr);
    const octet24 = (ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3];
    const net = (octet24 >>> (32 - cidr)) << (32 - cidr);
    const start = net + 1;
    const end = net + count - 2;
    const self = ip.join('.');
    for (let a = start; a <= end; a++) {
      const host = [(a >>> 24) & 255, (a >>> 16) & 255, (a >>> 8) & 255, a & 255].join('.');
      if (host === self) continue;
      hosts.push(host);
    }
  }

  const urls = hosts.map((h) => `ws://${h}:${port}`);
  return { hosts, urls, cidr };
}

/**
 * True when `url` accepts a WebSocket and looks like rosbridge (stays open
 * after a standard subscribe op, or replies with JSON).
 */
export function probeRosbridge(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      ws = new WebSocket(url);
    } catch {
      finish(false);
      return;
    }
    ws.onopen = () => {
      try {
        ws?.send(JSON.stringify({ op: 'subscribe', topic: '/clock', id: 'sanad_probe' }));
      } catch {
        finish(false);
        return;
      }
      // Rosbridge keeps the socket open; a wrong service often errors/closes quickly.
      setTimeout(() => finish(true), 120);
    };
    ws.onmessage = () => finish(true);
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });
}

export async function getLocalNetworkInfo(): Promise<{
  ip: string;
  subnet: string | null;
}> {
  const state = await NetInfo.fetch();
  const details = state.details as
    | { ipAddress?: string; subnet?: string }
    | undefined;
  const ip = details?.ipAddress ?? null;
  if (!ip || ip === '0.0.0.0') {
    throw new Error('No LAN IP — join the same Wi‑Fi as the chair.');
  }
  return { ip, subnet: details?.subnet ?? null };
}

/**
 * Probe the phone's subnet for rosbridge on `port`. Resolves with every
 * verified `ws://host:port` (usually one chair).
 */
export async function scanForRosbridge(
  port = DEFAULT_ROSBRIDGE_PORT,
  onProgress?: (p: ScanProgress) => void,
  signal?: { aborted: boolean },
): Promise<string[]> {
  const { ip, subnet } = await getLocalNetworkInfo();
  const { urls } = buildScanTargets(ip, subnet, port);
  const total = urls.length;
  const found: string[] = [];
  let done = 0;

  const report = () => onProgress?.({ done, total, found: [...found] });

  let next = 0;
  const worker = async () => {
    while (!signal?.aborted) {
      const i = next++;
      if (i >= urls.length) return;
      const url = urls[i];
      const ok = await probeRosbridge(url);
      done += 1;
      if (ok) found.push(url);
      report();
      if (ok) return;
    }
  };

  report();
  const workers = Array.from({ length: Math.min(SCAN_CONCURRENCY, total) }, () => worker());
  await Promise.all(workers);
  return found;
}
