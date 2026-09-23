import * as THREE from 'three';
import type { RobotPose } from '../../services/types';
import {
  SCREEN_W,
  SCREEN_H,
  BASE_FOLLOW_H,
  MIN_FRUSTUM_H,
  MAX_FRUSTUM_H,
  MIN_ZOOM,
  MAX_ZOOM,
  EYE_H,
  EYE_BACK,
  CLAMP_MARGIN,
} from './types';
import type { Bounds, Ref } from './types';

export interface CameraRefs {
  camera: Ref<THREE.OrthographicCamera | null>;
  desired: Ref<{ x: number; z: number }>;
  camTarget: Ref<{ x: number; z: number }>;
  initialized: Ref<boolean>;
  fullView: Ref<boolean | undefined>;
  follow: Ref<boolean>;
  robotPose: Ref<RobotPose | null | undefined>;
  bounds: Ref<Bounds>;
}

export function frustumH(
  fullViewRef: Ref<boolean | undefined>,
  zoomRef: Ref<number>,
  boundsRef: Ref<Bounds>,
): number {
  const aspect = SCREEN_W / SCREEN_H;
  if (fullViewRef.current) {
    const fitH = boundsRef.current.h + 3;
    const fitW = (boundsRef.current.w + 3) / aspect;
    return Math.max(fitH, fitW, 12);
  }
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current));
  const h = BASE_FOLLOW_H / z;
  return Math.min(MAX_FRUSTUM_H, Math.max(MIN_FRUSTUM_H, h));
}

// Clamp the camera target so the viewport can never drift into the void.
export function clampTarget(
  x: number,
  z: number,
  fw: number,
  fh: number,
  boundsRef: Ref<Bounds>,
): { x: number; z: number } {
  const b = boundsRef.current;
  const m = CLAMP_MARGIN;
  const hw = fw / 2;
  const hh = (fh / 2) * 1.05; // tilted view covers a bit more ground vertically
  let cx = x;
  let cz = z;
  if (fw >= b.w + m * 2) cx = b.cx;
  else cx = Math.max(b.minX + hw - m, Math.min(b.maxX - hw + m, cx));
  if (fh >= b.h + m * 2) cz = b.cz;
  else cz = Math.max(b.minZ + hh - m, Math.min(b.maxZ - hh + m, cz));
  return { x: cx, z: cz };
}

export function applyCamera(
  refs: CameraRefs,
  frustum: () => number,
  clamp: (x: number, z: number, fw: number, fh: number) => { x: number; z: number },
): void {
  const camera = refs.camera.current;
  if (!camera) return;
  const fh = frustum();
  const fw = fh * (SCREEN_W / SCREEN_H);
  camera.left = -fw / 2;
  camera.right = fw / 2;
  camera.top = fh / 2;
  camera.bottom = -fh / 2;
  camera.updateProjectionMatrix();

  let dx = refs.desired.current.x;
  let dz = refs.desired.current.z;
  if (refs.fullView.current) {
    dx = refs.bounds.current.cx;
    dz = refs.bounds.current.cz;
  } else if (refs.follow.current && refs.robotPose.current) {
    dx = refs.robotPose.current.x;
    dz = -refs.robotPose.current.y;
  }
  const clamped = clamp(dx, dz, fw, fh);
  refs.desired.current = clamped;

  // Smooth critically-damped-ish follow; snap on first frame.
  if (!refs.initialized.current) {
    refs.camTarget.current = { ...clamped };
    refs.initialized.current = true;
  } else {
    const t = 0.16;
    refs.camTarget.current = {
      x: refs.camTarget.current.x + (clamped.x - refs.camTarget.current.x) * t,
      z: refs.camTarget.current.z + (clamped.z - refs.camTarget.current.z) * t,
    };
  }

  const tx = refs.camTarget.current.x;
  const tz = refs.camTarget.current.z;
  if (refs.fullView.current) {
    camera.up.set(1, 0, 0);
    camera.position.set(tx, 40, tz);
    camera.lookAt(tx, 0, tz);
  } else {
    camera.up.set(1, 0, 0);
    camera.position.set(tx - EYE_BACK, EYE_H, tz);
    camera.lookAt(tx, 0, tz);
  }
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: THREE.OrthographicCamera | null,
  bounds: Bounds,
  originY: number,
  meshH: number,
): { x: number; y: number } | null {
  if (!camera) return null;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2((sx / SCREEN_W) * 2 - 1, -(sy / SCREEN_H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  const b = bounds;
  const m = 0.5;
  if (hit.x < b.minX - m || hit.x > b.maxX + m) return null;
  const rosY = -hit.z;
  if (rosY < originY - m || rosY > originY + meshH + m) return null;
  return { x: hit.x, y: rosY };
}
