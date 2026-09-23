import { normalizeWsUrl } from '../wsUrl';
import { prefixFromMask, buildScanTargets } from '../discovery';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

describe('normalizeWsUrl', () => {
  it('accepts bare IPv4 and assumes port 9090', () => {
    expect(normalizeWsUrl('192.168.1.20')).toBe('ws://192.168.1.20:9090');
  });

  it('accepts host:port', () => {
    expect(normalizeWsUrl('192.168.1.20:9091')).toBe('ws://192.168.1.20:9091');
  });

  it('accepts full ws URL', () => {
    expect(normalizeWsUrl('ws://10.0.0.5:9090')).toBe('ws://10.0.0.5:9090');
  });

  it('rejects garbage and non-ws schemes', () => {
    expect(normalizeWsUrl('')).toBeNull();
    expect(normalizeWsUrl('not a url')).toBeNull();
    expect(normalizeWsUrl('http://example.com')).toBeNull();
  });
});

describe('prefixFromMask', () => {
  it('parses common LAN masks', () => {
    expect(prefixFromMask('255.255.255.0')).toBe(24);
    expect(prefixFromMask('255.255.0.0')).toBe(16);
    expect(prefixFromMask('255.255.255.255')).toBe(32);
  });

  it('rejects non-contiguous masks', () => {
    expect(prefixFromMask('255.0.255.0')).toBeNull();
    expect(prefixFromMask('nope')).toBeNull();
  });
});

describe('buildScanTargets', () => {
  it('scans a /24 excluding self', () => {
    const { hosts, cidr } = buildScanTargets('192.168.1.10', '255.255.255.0');
    expect(cidr).toBe(24);
    expect(hosts).toHaveLength(253);
    expect(hosts).not.toContain('192.168.1.10');
    expect(hosts).toContain('192.168.1.1');
    expect(hosts).toContain('192.168.1.254');
    expect(hosts).not.toContain('192.168.1.0');
  });

  it('caps oversized masks at /24', () => {
    const { cidr, hosts } = buildScanTargets('10.0.0.5', '255.255.0.0');
    expect(cidr).toBe(24);
    expect(hosts.length).toBeLessThanOrEqual(253);
    expect(hosts).toContain('10.0.0.1');
  });

  it('uses a smaller subnet when provided', () => {
    const { cidr, hosts } = buildScanTargets('192.168.1.10', '255.255.255.240');
    expect(cidr).toBe(28);
    expect(hosts).toHaveLength(13);
    expect(hosts).not.toContain('192.168.1.10');
  });

  it('builds ws URLs on the requested port', () => {
    const { urls } = buildScanTargets('192.168.1.10', null, 9090);
    expect(urls[0]).toMatch(/^ws:\/\/192\.168\.1\.\d+:9090$/);
  });

  it('throws on invalid local IP', () => {
    expect(() => buildScanTargets('999.1.1.1')).toThrow();
  });
});
