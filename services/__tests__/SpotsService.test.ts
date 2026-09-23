import {
  normalizeSpot,
  mapGetAllResult,
  mapServiceResult,
  mapServiceError,
} from '../SpotsService';

jest.mock('../ros', () => ({
  __esModule: true,
  default: {
    getRos: jest.fn(() => ({})),
    onConnection: jest.fn(() => () => {}),
    connected: false,
  },
}));

describe('normalizeSpot', () => {
  it('maps a full valid spot', () => {
    expect(
      normalizeSpot({ title: 'Door', pose_x: 1.5, pose_y: -2, pose_z: 0.1, pose_theta: 1.57 }),
    ).toEqual({ title: 'Door', pose_x: 1.5, pose_y: -2, pose_z: 0.1, pose_theta: 1.57 });
  });

  it('falls back to name when title is missing', () => {
    expect(normalizeSpot({ name: 'Hall', pose_x: 3, pose_y: 4 })).toEqual({
      title: 'Hall',
      pose_x: 3,
      pose_y: 4,
      pose_z: 0,
      pose_theta: 0,
    });
  });

  it('rejects entries without a usable title', () => {
    expect(normalizeSpot({ pose_x: 1 })).toBeNull();
    expect(normalizeSpot({ title: '' })).toBeNull();
    expect(normalizeSpot({ title: 42 })).toBeNull();
  });

  it('rejects non-object entries', () => {
    expect(normalizeSpot(null)).toBeNull();
    expect(normalizeSpot(undefined)).toBeNull();
    expect(normalizeSpot('Door')).toBeNull();
    expect(normalizeSpot(42)).toBeNull();
    expect(normalizeSpot(['Door'])).toBeNull();
  });

  it('coerces non-numeric pose fields to 0', () => {
    expect(normalizeSpot({ title: 'A', pose_x: 'x', pose_y: NaN, pose_z: Infinity, pose_theta: null })).toEqual({
      title: 'A',
      pose_x: 0,
      pose_y: 0,
      pose_z: 0,
      pose_theta: 0,
    });
  });
});

describe('mapGetAllResult', () => {
  const spot = { title: 'Door', pose_x: 1, pose_y: 2, pose_z: 0, pose_theta: 0 };

  it('accepts a bare array', () => {
    expect(mapGetAllResult([spot])).toEqual([spot]);
  });

  it('accepts arrays under spots/values/data keys', () => {
    expect(mapGetAllResult({ spots: [spot] })).toEqual([spot]);
    expect(mapGetAllResult({ values: [spot] })).toEqual([spot]);
    expect(mapGetAllResult({ data: [spot] })).toEqual([spot]);
  });

  it('prefers earlier keys when several are present', () => {
    const other = { title: 'Other', pose_x: 0, pose_y: 0, pose_z: 0, pose_theta: 0 };
    expect(mapGetAllResult({ spots: [spot], values: [other] })).toEqual([spot]);
  });

  it('returns [] for non-list shapes', () => {
    expect(mapGetAllResult(null)).toEqual([]);
    expect(mapGetAllResult(undefined)).toEqual([]);
    expect(mapGetAllResult('nope')).toEqual([]);
    expect(mapGetAllResult({ spots: 'not-an-array' })).toEqual([]);
    expect(mapGetAllResult({})).toEqual([]);
  });

  it('drops malformed entries and keeps valid ones', () => {
    const result = mapGetAllResult([spot, null, 7, { pose_x: 1 }, { title: '', pose_x: 0 }, 'x']);
    expect(result).toEqual([spot]);
  });

  it('normalizes name-based entries', () => {
    expect(mapGetAllResult({ spots: [{ name: 'Gate', pose_x: 9, pose_y: 8 }] })).toEqual([
      { title: 'Gate', pose_x: 9, pose_y: 8, pose_z: 0, pose_theta: 0 },
    ]);
  });
});

describe('mapServiceResult', () => {
  const action = "Add spot 'Door'";

  it('throws the provided message on success:false', () => {
    expect(() => mapServiceResult({ success: false, message: 'duplicate title' }, action)).toThrow(
      'duplicate title',
    );
  });

  it('throws an action-prefixed fallback when message is missing or empty', () => {
    expect(() => mapServiceResult({ success: false }, action)).toThrow(`${action} failed`);
    expect(() => mapServiceResult({ success: false, message: '' }, action)).toThrow(
      `${action} failed`,
    );
  });

  it('does not throw on success:true or missing success', () => {
    expect(() => mapServiceResult({ success: true }, action)).not.toThrow();
    expect(() => mapServiceResult({ message: 'ignored' }, action)).not.toThrow();
    expect(() => mapServiceResult({}, action)).not.toThrow();
    expect(() => mapServiceResult(null, action)).not.toThrow();
    expect(() => mapServiceResult(undefined, action)).not.toThrow();
    expect(() => mapServiceResult('ok', action)).not.toThrow();
  });

  it('does not throw when success is truthy non-boolean', () => {
    expect(() => mapServiceResult({ success: 1 }, action)).not.toThrow();
    expect(() => mapServiceResult({ success: 'yes' }, action)).not.toThrow();
  });
});

describe('mapServiceError', () => {
  it('returns non-empty strings as-is', () => {
    expect(mapServiceError('boom')).toBe('boom');
  });

  it('returns Error.message', () => {
    expect(mapServiceError(new Error('from Error'))).toBe('from Error');
  });

  it('prefers message, then data, on plain objects', () => {
    expect(mapServiceError({ message: 'rosbridge says no' })).toBe('rosbridge says no');
    expect(mapServiceError({ data: 'payload string' })).toBe('payload string');
    expect(mapServiceError({ message: '', data: 'fallback' })).toBe('fallback');
  });

  it('falls back to a default for unusable values', () => {
    expect(mapServiceError('')).toBe('Spot service request failed.');
    expect(mapServiceError(null)).toBe('Spot service request failed.');
    expect(mapServiceError(undefined)).toBe('Spot service request failed.');
    expect(mapServiceError(42)).toBe('Spot service request failed.');
    expect(mapServiceError({})).toBe('Spot service request failed.');
    expect(mapServiceError(new Error(''))).toBe('Spot service request failed.');
  });
});
