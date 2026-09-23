import { spotToPinpoint } from '../PinpointsContext';

jest.mock('../../services/ros', () => ({
  __esModule: true,
  default: {
    getRos: jest.fn(() => ({})),
    onConnection: jest.fn(() => () => {}),
    connected: false,
  },
}));
jest.mock('../../services/MapService', () => ({
  __esModule: true,
  default: { getInstance: jest.fn(() => ({})) },
}));
jest.mock('../../services/SpotsService', () => ({
  __esModule: true,
  default: { getInstance: jest.fn(() => ({})) },
  mapServiceError: jest.fn((e: unknown) => String(e)),
}));

describe('spotToPinpoint', () => {
  it('maps a Spot onto a Pinpoint (pose_y becomes z)', () => {
    expect(
      spotToPinpoint({ title: 'Door', pose_x: 1.5, pose_y: -2.5, pose_z: 0, pose_theta: 0 }),
    ).toEqual({ id: 'Door', name: 'Door', x: 1.5, z: -2.5 });
  });
});
