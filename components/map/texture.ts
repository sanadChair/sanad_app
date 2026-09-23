import * as THREE from 'three';
import type { ThemeColors } from '../../contexts/ThemeContext';
import type { OccupancyGrid } from '../../services/types';
import type { RGB } from './types';

// ---------------------------------------------------------------------------
// Map texture: theme-driven cartography (light = white free / gray walls;
// dark = navy free / ice walls).
// ---------------------------------------------------------------------------
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function createGridTexture(grid: OccupancyGrid, theme: ThemeColors): THREE.DataTexture {
  const w = grid.info.width;
  const h = grid.info.height;
  const data = new Uint8Array(w * h * 4);

  const unknown = hexToRgb(theme.mapUnknown);
  const free = hexToRgb(theme.mapFree);
  const mid = lerpRgb(free, hexToRgb(theme.mapOccupied), 0.35);
  const occStart = hexToRgb(theme.mapOccupied);
  const occEnd = lerpRgb(occStart, [255, 255, 255], 0.25);

  for (let i = 0; i < w * h; i++) {
    const v = grid.data[i];
    const idx = i * 4;
    let rgb: RGB;
    if (v === -1) {
      rgb = unknown;
    } else if (v <= 5) {
      rgb = free;
    } else if (v < 65) {
      rgb = lerpRgb(free, mid, v / 65);
    } else {
      rgb = lerpRgb(occStart, occEnd, (v - 65) / 35);
    }
    data[idx] = rgb[0];
    data[idx + 1] = rgb[1];
    data[idx + 2] = rgb[2];
    data[idx + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.flipY = false;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
