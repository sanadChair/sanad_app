import type { OccupancyGrid } from '../types';
import { cellAt, snapToFree, friendlyGoalError } from '../MapService';

jest.mock('../ros', () => ({
  __esModule: true,
  default: {
    getRos: jest.fn(() => ({})),
    onConnection: jest.fn(() => () => {}),
    connected: false,
  },
}));

function makeGrid(
  width: number,
  height: number,
  fill: number | ((c: number, r: number) => number),
  originX = 0,
  originY = 0,
  resolution = 1,
): OccupancyGrid {
  const data: number[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      data.push(typeof fill === 'number' ? fill : fill(c, r));
    }
  }
  return {
    header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } },
    info: {
      resolution,
      width,
      height,
      origin: {
        position: { x: originX, y: originY, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
    },
    data,
  };
}

describe('cellAt', () => {
  it('returns free value for an in-bounds free cell', () => {
    const grid = makeGrid(4, 4, 0);
    expect(cellAt(grid, 1.5, 2.5)).toBe(0);
  });

  it('returns occupied value for an in-bounds occupied cell', () => {
    const grid = makeGrid(4, 4, 100);
    expect(cellAt(grid, 0, 0)).toBe(100);
  });

  it('returns -1 for out-of-bounds points', () => {
    const grid = makeGrid(4, 4, 0, 10, 10);
    expect(cellAt(grid, 9.5, 12)).toBe(-1);
    expect(cellAt(grid, 100, 12)).toBe(-1);
    expect(cellAt(grid, 12, 9.5)).toBe(-1);
    expect(cellAt(grid, -1, 12)).toBe(-1);
  });

  it('respects origin offset and resolution', () => {
    const grid = makeGrid(4, 4, 7, -2, -2, 0.5);
    expect(cellAt(grid, -2, -2)).toBe(7);
    expect(cellAt(grid, -2.6, -2)).toBe(-1);
    expect(cellAt(grid, 0, 0)).toBe(-1);
  });
});

describe('snapToFree', () => {
  it('returns the point unchanged when the cell is free', () => {
    const grid = makeGrid(10, 10, 0);
    expect(snapToFree(grid, 3.2, 4.7, 2)).toEqual({ x: 3.2, y: 4.7, adjusted: false });
  });

  it('returns the point unchanged when no map is available yet', () => {
    expect(snapToFree(null, 1, 2, 2)).toEqual({ x: 1, y: 2, adjusted: false });
  });

  it('snaps an occupied cell to nearby free space', () => {
    // Center cell occupied, everything else free.
    const grid = makeGrid(21, 21, (c, r) => (c === 10 && r === 10 ? 100 : 0));
    const result = snapToFree(grid, 10.5, 10.5, 2);
    expect(result).not.toBeNull();
    expect(result!.adjusted).toBe(true);
    expect(result!.x).not.toBe(10.5);
    expect(cellAt(grid, result!.x, result!.y)).toBe(0);
  });

  it('snaps an unknown cell to nearby free space', () => {
    const grid = makeGrid(21, 21, (c, r) => (c === 10 && r === 10 ? -1 : 0));
    const result = snapToFree(grid, 10.5, 10.5, 2);
    expect(result).not.toBeNull();
    expect(result!.adjusted).toBe(true);
    expect(cellAt(grid, result!.x, result!.y)).toBe(0);
  });

  it('returns null when nothing free is within the radius', () => {
    const grid = makeGrid(21, 21, 100);
    expect(snapToFree(grid, 10.5, 10.5, 2)).toBeNull();
  });

  it('returns null for an out-of-bounds point with no free space in reach', () => {
    const grid = makeGrid(5, 5, 100);
    expect(snapToFree(grid, 50, 50, 2)).toBeNull();
  });

  it('returns null when the grid is entirely unknown within radius', () => {
    const grid = makeGrid(10, 10, -1);
    expect(snapToFree(grid, 5.5, 5.5, 2)).toBeNull();
  });
});

describe('friendlyGoalError', () => {
  it('maps rejected errors', () => {
    expect(friendlyGoalError('Goal rejected')).toContain('Goal rejected');
    expect(friendlyGoalError('REJECTED by server')).toContain('unreachable');
  });

  it('maps abort errors', () => {
    expect(friendlyGoalError('Goal aborted')).toContain('Navigation aborted');
    expect(friendlyGoalError('ABORT')).toContain('path blocked');
  });

  it('maps cancel errors', () => {
    expect(friendlyGoalError('Goal canceled')).toContain('Navigation canceled');
    expect(friendlyGoalError('cancel accepted')).toContain('Navigation canceled');
  });

  it('falls back to a generic message for other errors', () => {
    expect(friendlyGoalError('something exploded')).toBe(
      'Navigation failed. Try a nearby open spot.',
    );
    expect(friendlyGoalError('')).toBe('Navigation failed. Try a nearby open spot.');
  });
});
