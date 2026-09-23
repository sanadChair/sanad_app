import * as THREE from 'three';
import type { ThemeColors } from '../../contexts/ThemeContext';
import type { OccupancyGrid } from '../../services/types';
import { createGridTexture } from './texture';
import { MAX_WALL_INSTANCES } from './types';
import type { PathProp } from './types';

export function createFloorMesh(grid: OccupancyGrid, theme: ThemeColors): THREE.Mesh {
  const res = grid.info.resolution;
  const meshW = grid.info.width * res;
  const meshH = grid.info.height * res;
  const originX = grid.info.origin.position.x;
  const originY = grid.info.origin.position.y;

  const texture = createGridTexture(grid, theme);
  const geometry = new THREE.PlaneGeometry(meshW, meshH);
  const material = new THREE.MeshBasicMaterial({ map: texture, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(originX + meshW / 2, 0, -(originY + meshH / 2));
  mesh.renderOrder = 0;
  return mesh;
}

// Extruded walls from occupied cells -> the "real 3D" look.
export function createWallsMesh(grid: OccupancyGrid, theme: ThemeColors): THREE.InstancedMesh | null {
  const res = grid.info.resolution;
  const W = grid.info.width;
  const H = grid.info.height;
  const originX = grid.info.origin.position.x;
  const originY = grid.info.origin.position.y;

  const positions: number[] = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const v = grid.data[r * W + c];
      if (v >= 65) {
        positions.push(c, r);
      }
    }
  }
  if (positions.length === 0) return null;

  const total = Math.min(positions.length / 2, MAX_WALL_INSTANCES);
  // Even subsample when over budget so walls don't vanish in one corner.
  const step = Math.max(1, Math.floor(positions.length / 2 / MAX_WALL_INSTANCES));

  const geo = new THREE.BoxGeometry(res * 0.96, 0.7, res * 0.96);
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(theme.mapWall),
    emissive: new THREE.Color(theme.mapWallEmissive),
    emissiveIntensity: 0.45,
  });
  const inst = new THREE.InstancedMesh(geo, mat, Math.ceil(total));
  const m = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < positions.length / 2 && n < inst.count; i += step) {
    const c = positions[i * 2];
    const r = positions[i * 2 + 1];
    const rosX = originX + (c + 0.5) * res;
    const rosY = originY + (r + 0.5) * res;
    m.makeTranslation(rosX, 0.35, -rosY);
    inst.setMatrixAt(n, m);
    n++;
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

export function createFrameLine(grid: OccupancyGrid, theme: ThemeColors): THREE.LineLoop {
  const res = grid.info.resolution;
  const meshW = grid.info.width * res;
  const meshH = grid.info.height * res;
  const x0 = grid.info.origin.position.x;
  const x1 = x0 + meshW;
  const z0 = -(grid.info.origin.position.y + meshH);
  const z1 = -grid.info.origin.position.y;
  const y = 0.03;
  const pts = [
    new THREE.Vector3(x0, y, z0),
    new THREE.Vector3(x1, y, z0),
    new THREE.Vector3(x1, y, z1),
    new THREE.Vector3(x0, y, z1),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(theme.mapFrame),
    transparent: true,
    opacity: 0.65,
  });
  return new THREE.LineLoop(geo, mat);
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineLoop) {
      obj.geometry?.dispose?.();
      const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((mm) => { (mm as any).map?.dispose?.(); mm.dispose(); });
      else if (mat) { (mat as any).map?.dispose?.(); mat.dispose(); }
    } else if (obj instanceof THREE.InstancedMesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}

// Path trail: rebuild the line geometry from the last N history points.
export function updatePathLine(line: THREE.Line | null, pathHistory: PathProp[] | null | undefined): void {
  if (!line) return;
  const pts = (pathHistory ?? []).slice(-200);
  if (pts.length < 2) {
    line.visible = false;
    return;
  }
  line.visible = true;
  const arr = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => {
    arr[i * 3] = p.x;
    arr[i * 3 + 1] = 0.06;
    arr[i * 3 + 2] = -p.y;
  });
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry();
  line.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
}
