import {
  textChunkName,
  decodetEXt,
  encodetEXt,
  readKeyword,
  readLatin1,
} from '../fast-png-text';

jest.mock('../../node_modules/fast-png/lib/helpers/crc.js', () => ({
  writeCrc: jest.fn(),
  checkCrc: jest.fn(),
}));

type MockBuffer = {
  bytes: number[];
  offset: number;
  mark(): void;
  reset(): void;
  readByte(): number;
  readBytes(n: number): Uint8Array;
  skip(n: number): void;
  writeUint32(n: number): void;
  writeChars(s: string): void;
  writeByte(n: number): void;
  toArray(): Uint8Array;
};

function createBuffer(initial: number[] = []): MockBuffer {
  const state = { bytes: [...initial], offset: 0, markOffset: 0 };
  return {
    bytes: state.bytes,
    get offset() {
      return state.offset;
    },
    mark() {
      state.markOffset = state.offset;
    },
    reset() {
      state.offset = state.markOffset;
    },
    readByte() {
      if (state.offset >= state.bytes.length) throw new Error('EOF');
      return state.bytes[state.offset++];
    },
    readBytes(n: number) {
      const out = state.bytes.slice(state.offset, state.offset + n);
      state.offset += n;
      return new Uint8Array(out);
    },
    skip(n: number) {
      state.offset += n;
    },
    writeUint32(n: number) {
      state.bytes.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    },
    writeChars(s: string) {
      for (let i = 0; i < s.length; i++) state.bytes.push(s.charCodeAt(i) & 0xff);
    },
    writeByte(n: number) {
      state.bytes.push(n & 0xff);
    },
    toArray() {
      return new Uint8Array(state.bytes);
    },
  };
}

describe('fast-png-text shim (latin1 without TextDecoder)', () => {
  test('exports match fast-png helpers/text API', () => {
    expect(textChunkName).toBe('tEXt');
    expect(typeof decodetEXt).toBe('function');
    expect(typeof encodetEXt).toBe('function');
    expect(typeof readKeyword).toBe('function');
    expect(typeof readLatin1).toBe('function');
  });

  test('never constructs TextDecoder with non-UTF8 labels', () => {
    const Original = globalThis.TextDecoder;
    const labels: string[] = [];
    class SpyDecoder extends Original {
      constructor(label?: string, options?: TextDecoderOptions) {
        labels.push(String(label));
        super(label, options);
      }
    }
    globalThis.TextDecoder = SpyDecoder as unknown as typeof TextDecoder;
    try {
      const body = [
        ...'Software'.split('').map((c) => c.charCodeAt(0)),
        0,
        ...'Sanad'.split('').map((c) => c.charCodeAt(0)),
      ];
      const buf = createBuffer(body);
      const text: Record<string, string> = {};
      decodetEXt(text, buf as never, body.length);
      expect(text.Software).toBe('Sanad');
      readKeyword(
        createBuffer([...'Comment'.split('').map((c) => c.charCodeAt(0)), 0]) as never
      );
      readLatin1(createBuffer([72, 105]) as never, 2);
    } finally {
      globalThis.TextDecoder = Original;
    }
    expect(labels).not.toContain('latin1');
    expect(labels).not.toContain('iso-8859-1');
    expect(labels).not.toContain('windows-1252');
  });

  test('decodetEXt reads keyword and value as latin1', () => {
    const keyword = 'Software';
    const value = 'Sanad';
    const body = [
      ...keyword.split('').map((c) => c.charCodeAt(0)),
      0,
      ...value.split('').map((c) => c.charCodeAt(0)),
    ];
    const buf = createBuffer(body);
    const text: Record<string, string> = {};
    decodetEXt(text, buf as never, body.length);
    expect(text.Software).toBe('Sanad');
  });

  test('encodetEXt round-trips through decodetEXt', () => {
    const keyword = 'Comment';
    const value = 'hello map';
    const buf = createBuffer();
    encodetEXt(buf as never, keyword, value);
    const bytes = [...buf.bytes];
    // encodetEXt writes [length:4][tEXt:4][keyword][0][value] (CRC mocked).
    // PNG decoders call decodetEXt with the buffer already past length+type.
    const dataLength = keyword.length + 1 + value.length;
    const reader = createBuffer(bytes.slice(8, 8 + dataLength));
    const text: Record<string, string> = {};
    decodetEXt(text, reader as never, dataLength);
    expect(text.Comment).toBe('hello map');
  });

  test('rejects invalid latin1 text', () => {
    const buf = createBuffer();
    expect(() => encodetEXt(buf as never, 'Key', '日本語')).toThrow('invalid latin1 text');
  });

  test('rejects keyword longer than 79 chars', () => {
    const buf = createBuffer();
    expect(() => encodetEXt(buf as never, 'k'.repeat(80), 'v')).toThrow(
      'keyword length must be between 1 and 79'
    );
  });
});
