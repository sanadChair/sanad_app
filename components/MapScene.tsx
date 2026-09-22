import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Dimensions, View, Text, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { usePinpoints } from '../contexts/PinpointsContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import type { RobotPose, OccupancyGrid } from '../services/types';
import ErrorBoundary, { isWebGLAvailable } from './ErrorBoundary';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TAP_THRESHOLD = 10;

function touchDistance(touches: { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

// Tight follow view (~chair scale) and zoom limits.
const BASE_FOLLOW_H = 8.5;
const MIN_FRUSTUM_H = 2.5;
const MAX_FRUSTUM_H = 26;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
// Tilted 3/4 view: eye height + pullback define the viewing angle (~65deg).
const EYE_H = 30;
const EYE_BACK = 14;
const CLAMP_MARGIN = 1.0;
const MAX_WALL_INSTANCES = 16000;

export interface GoalProp {
  x: number;
  y: number;
}

export interface PathProp {
  x: number;
  y: number;
}

interface MapSceneProps {
  robotPose?: RobotPose | null;
  mapData?: OccupancyGrid | null;
  onTapMap?: (worldX: number, worldY: number) => void;
  resetTrigger?: number;
  pendingPin?: { x: number; y: number } | null;
  fullView?: boolean;
  followMode?: boolean;
  onManualPan?: () => void;
  zoom?: number;
  onZoomChange?: (z: number) => void;
  activeGoal?: GoalProp | null;
  pathHistory?: PathProp[];
}

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Map texture: theme-driven cartography (light = white free / gray walls;
// dark = navy free / ice walls).
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function createGridTexture(grid: OccupancyGrid, theme: ThemeColors): THREE.DataTexture {
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

function createFloorMesh(grid: OccupancyGrid, theme: ThemeColors): THREE.Mesh {
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
function createWallsMesh(grid: OccupancyGrid, theme: ThemeColors): THREE.InstancedMesh | null {
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

function createFrameLine(grid: OccupancyGrid, theme: ThemeColors): THREE.LineLoop {
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

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------
function createRobotMarker(): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  g.add(shadow);

  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 40),
    new THREE.MeshBasicMaterial({ color: 0x4d7aff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.02;
  pulse.name = 'pulse';
  g.add(pulse);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.36, 0.24, 32),
    new THREE.MeshLambertMaterial({ color: 0x2f63f6, emissive: 0x1d3fe0, emissiveIntensity: 0.7 })
  );
  base.position.y = 0.16;
  g.add(base);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9db8ff, emissiveIntensity: 0.35 })
  );
  dome.position.y = 0.28;
  g.add(dome);

  // Forward wedge pointing +X (ROS yaw 0 = +X).
  const wedge = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.34, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  wedge.rotation.z = -Math.PI / 2;
  wedge.position.set(0.48, 0.1, 0);
  g.add(wedge);

  const wedgeGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 20),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.9 })
  );
  wedgeGlow.rotation.x = -Math.PI / 2;
  wedgeGlow.position.set(0.48, 0.03, 0);
  g.add(wedgeGlow);

  return g;
}

function createPinMarker(): THREE.Group {
  const g = new THREE.Group();
  const red = 0xe05545;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.28, 28),
    new THREE.MeshBasicMaterial({ color: red, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.85, 10),
    new THREE.MeshBasicMaterial({ color: red })
  );
  stem.position.y = 0.45;
  g.add(stem);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 20, 14),
    new THREE.MeshLambertMaterial({ color: red, emissive: 0x7a1f14, emissiveIntensity: 0.6 })
  );
  head.position.y = 1.0;
  head.name = 'head';
  g.add(head);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  dot.position.y = 1.0;
  dot.name = 'dot';
  g.add(dot);

  return g;
}

function createGoalMarker(): THREE.Group {
  const g = new THREE.Group();

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.16, 3.0, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 1.5;
  g.add(beam);

  const ring1 = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.42, 36),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  );
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.03;
  ring1.name = 'ring1';
  g.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.24, 32),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.03;
  ring2.name = 'ring2';
  g.add(ring2);

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22),
    new THREE.MeshLambertMaterial({ color: 0x00e0ff, emissive: 0x0090a8, emissiveIntensity: 0.9 })
  );
  gem.position.y = 1.15;
  gem.name = 'gem';
  g.add(gem);

  return g;
}

function createPendingMarker(): THREE.Group {
  const g = new THREE.Group();
  const cyan = 0x00e0ff;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.32, 32),
    new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.name = 'ring';
  g.add(ring);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 10),
    new THREE.MeshBasicMaterial({ color: cyan })
  );
  dot.position.y = 0.5;
  dot.name = 'dot';
  g.add(dot);

  const stemMat = new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: 0.7 });
  const stem = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.5, 0)]),
    stemMat
  );
  g.add(stem);
  return g;
}

function disposeObject(root: THREE.Object3D) {
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

// ---------------------------------------------------------------------------
export default function MapScene({
  robotPose, mapData, onTapMap, resetTrigger, pendingPin, fullView,
  followMode = true, onManualPan, zoom = 1, onZoomChange, activeGoal, pathHistory,
}: MapSceneProps) {
  const { pinpoints } = usePinpoints();
  const { colors: theme, mode: themeMode } = useTheme();

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const floorRef = useRef<THREE.Mesh | null>(null);
  const wallsRef = useRef<THREE.InstancedMesh | null>(null);
  const frameRef = useRef<THREE.LineLoop | null>(null);
  const robotRef = useRef<THREE.Group | null>(null);
  const pinsRef = useRef<THREE.Group | null>(null);
  const pendingRef = useRef<THREE.Group | null>(null);
  const goalRef = useRef<THREE.Group | null>(null);
  const pathRef = useRef<THREE.Line | null>(null);
  const animRef = useRef(0);
  const readyRef = useRef(false);

  // Camera state (refs to avoid re-creating GL context).
  const camTarget = useRef({ x: 0, z: 0 });
  const desired = useRef({ x: 0, z: 0 });
  const initializedRef = useRef(false);
  const dragStart = useRef({ x: 0, z: 0 });
  const didDrag = useRef(false);
  const pinchStart = useRef(0);
  const pinchZoomStart = useRef(1);
  const lastFrame = useRef(0);

  const fullViewRef = useRef(fullView);
  const followRef = useRef(followMode);
  const zoomRef = useRef(zoom);
  const robotPoseRef = useRef(robotPose);
  const onManualPanRef = useRef(onManualPan);
  const onZoomRef = useRef(onZoomChange);
  const onTapRef = useRef(onTapMap);
  const themeRef = useRef(theme);

  const grid = useMemo(() => ({
    originX: mapData?.info.origin.position.x ?? 0,
    originY: mapData?.info.origin.position.y ?? 0,
    gridW: mapData?.info.width ?? 375,
    gridH: mapData?.info.height ?? 225,
    res: mapData?.info.resolution ?? 0.05,
  }), [mapData]);

  const meshW = grid.gridW * grid.res;
  const meshH = grid.gridH * grid.res;

  const bounds: Bounds = useMemo(() => {
    const minX = grid.originX;
    const maxX = grid.originX + meshW;
    const minZ = -(grid.originY + meshH);
    const maxZ = -grid.originY;
    return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: meshW, h: meshH };
  }, [grid.originX, grid.originY, meshW, meshH]);
  const boundsRef = useRef(bounds);

  const frustumH = useCallback((): number => {
    const aspect = SCREEN_W / SCREEN_H;
    if (fullViewRef.current) {
      const fitH = boundsRef.current.h + 3;
      const fitW = (boundsRef.current.w + 3) / aspect;
      return Math.max(fitH, fitW, 12);
    }
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current));
    const h = BASE_FOLLOW_H / z;
    return Math.min(MAX_FRUSTUM_H, Math.max(MIN_FRUSTUM_H, h));
  }, []);

  // Clamp the camera target so the viewport can never drift into the void.
  const clampTarget = useCallback((x: number, z: number, fw: number, fh: number) => {
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
  }, []);

  const applyCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const fh = frustumH();
    const fw = fh * (SCREEN_W / SCREEN_H);
    camera.left = -fw / 2;
    camera.right = fw / 2;
    camera.top = fh / 2;
    camera.bottom = -fh / 2;
    camera.updateProjectionMatrix();

    let dx = desired.current.x;
    let dz = desired.current.z;
    if (fullViewRef.current) {
      dx = boundsRef.current.cx;
      dz = boundsRef.current.cz;
    } else if (followRef.current && robotPoseRef.current) {
      dx = robotPoseRef.current.x;
      dz = -robotPoseRef.current.y;
    }
    const clamped = clampTarget(dx, dz, fw, fh);
    desired.current = clamped;

    // Smooth critically-damped-ish follow; snap on first frame.
    if (!initializedRef.current) {
      camTarget.current = { ...clamped };
      initializedRef.current = true;
    } else {
      const t = 0.16;
      camTarget.current = {
        x: camTarget.current.x + (clamped.x - camTarget.current.x) * t,
        z: camTarget.current.z + (clamped.z - camTarget.current.z) * t,
      };
    }

    const tx = camTarget.current.x;
    const tz = camTarget.current.z;
    if (fullViewRef.current) {
      camera.up.set(1, 0, 0);
      camera.position.set(tx, 40, tz);
      camera.lookAt(tx, 0, tz);
    } else {
      camera.up.set(1, 0, 0);
      camera.position.set(tx - EYE_BACK, EYE_H, tz);
      camera.lookAt(tx, 0, tz);
    }
  }, [clampTarget, frustumH]);

  const screenToWorld = useCallback((sx: number, sy: number): { x: number; y: number } | null => {
    const camera = cameraRef.current;
    if (!camera) return null;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2((sx / SCREEN_W) * 2 - 1, -(sy / SCREEN_H) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    const b = boundsRef.current;
    const m = 0.5;
    if (hit.x < b.minX - m || hit.x > b.maxX + m) return null;
    const rosY = -hit.z;
    if (rosY < grid.originY - m || rosY > grid.originY + meshH + m) return null;
    return { x: hit.x, y: rosY };
  }, [grid.originY, meshH]);

  const screenToWorldRef = useRef(screenToWorld);

  // Keep prop-derived refs fresh for the gesture handlers / GL animate loop.
  useEffect(() => {
    fullViewRef.current = fullView;
    followRef.current = followMode;
    zoomRef.current = zoom;
    robotPoseRef.current = robotPose;
    onManualPanRef.current = onManualPan;
    onZoomRef.current = onZoomChange;
    onTapRef.current = onTapMap;
    themeRef.current = theme;
    boundsRef.current = bounds;
    screenToWorldRef.current = screenToWorld;
  });

  const rebuildMap = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !mapData) return;
    if (floorRef.current) { scene.remove(floorRef.current); disposeObject(floorRef.current); floorRef.current = null; }
    if (wallsRef.current) { scene.remove(wallsRef.current); disposeObject(wallsRef.current); wallsRef.current = null; }
    if (frameRef.current) { scene.remove(frameRef.current); disposeObject(frameRef.current); frameRef.current = null; }

    const floor = createFloorMesh(mapData, themeRef.current);
    scene.add(floor);
    floorRef.current = floor;

    const walls = createWallsMesh(mapData, themeRef.current);
    if (walls) { scene.add(walls); wallsRef.current = walls; }

    const frame = createFrameLine(mapData, themeRef.current);
    scene.add(frame);
    frameRef.current = frame;
  }, [mapData]);

  // Apply theme palette to scene chrome (bg, fog, ground, grid, path).
  const applySceneTheme = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const t = themeRef.current;
    if (renderer) renderer.setClearColor(new THREE.Color(t.mapBg));
    if (!scene) return;
    scene.background = new THREE.Color(t.mapBg);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.set(t.mapBg);
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material as THREE.MeshBasicMaterial | undefined;
        if (mat && mat.color && obj.geometry instanceof THREE.PlaneGeometry && obj.position.y < 0) {
          mat.color.set(t.mapGround);
        }
      } else if (obj instanceof THREE.GridHelper) {
        const m = obj.material as THREE.Material & { color?: THREE.Color };
        if (m.color) m.color.set(t.mapGrid);
      } else if (obj === pathRef.current) {
        const pathLine = pathRef.current;
        if (pathLine) {
          const mat = pathLine.material as THREE.LineBasicMaterial;
          if (mat?.color) mat.color.set(t.mapPath);
        }
      }
    });
  }, []);

  const onContextCreate = useCallback((gl: any) => {
    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getAttribute: () => null,
        getContext: () => gl,
        getBoundingClientRect: () => ({
          left: 0, top: 0, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight,
        }),
        ownerDocument: { body: { appendChild: () => {}, removeChild: () => {} } },
      } as any,
      context: gl,
      antialias: true,
    });
    const t0 = themeRef.current;
    renderer.setClearColor(new THREE.Color(t0.mapBg));
    if ('outputColorSpace' in renderer && (THREE as any).SRGBColorSpace) {
      (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
    }
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(t0.mapBg);
    scene.fog = new THREE.Fog(new THREE.Color(t0.mapBg), 45, 110);
    sceneRef.current = scene;

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const hemi = new THREE.HemisphereLight(0x8fb4ff, new THREE.Color(t0.mapGround), 0.55);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(-6, 12, 4);
    scene.add(dir);

    // Infinite ground so the void reads as intentional studio backdrop.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(t0.mapGround) })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.renderOrder = -2;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(
      60,
      60,
      new THREE.Color(t0.mapGrid),
      new THREE.Color(t0.mapGridMinor)
    );
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as any).opacity = 0.28;
    gridHelper.position.y = -0.04;
    scene.add(gridHelper);

    const fh = frustumH();
    const fw = fh * (SCREEN_W / SCREEN_H);
    const camera = new THREE.OrthographicCamera(-fw / 2, fw / 2, fh / 2, -fh / 2, 0.1, 220);
    camera.up.set(1, 0, 0);
    cameraRef.current = camera;

    rebuildMap();

    const robot = createRobotMarker();
    robot.visible = false;
    scene.add(robot);
    robotRef.current = robot;

    const pins = new THREE.Group();
    scene.add(pins);
    pinsRef.current = pins;

    const pending = createPendingMarker();
    pending.visible = false;
    scene.add(pending);
    pendingRef.current = pending;

    const goal = createGoalMarker();
    goal.visible = false;
    scene.add(goal);
    goalRef.current = goal;

    const pathGeo = new THREE.BufferGeometry();
    const pathLine = new THREE.Line(
      pathGeo,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(t0.mapPath),
        transparent: true,
        opacity: 0.85,
      })
    );
    pathLine.frustumCulled = false;
    scene.add(pathLine);
    pathRef.current = pathLine;

    // Seed camera on robot if we already have a pose, else map center.
    if (robotPoseRef.current) {
      desired.current = { x: robotPoseRef.current.x, z: -robotPoseRef.current.y };
    } else {
      desired.current = { x: boundsRef.current.cx, z: boundsRef.current.cz };
    }
    readyRef.current = true;
    initializedRef.current = false;
    applyCamera();

    lastFrame.current = performance.now();
    const animate = () => {
      const now = performance.now();
      const t = now / 1000;
      applyCamera();

      const rg = robotRef.current;
      if (rg?.visible) {
        const pulse = rg.getObjectByName('pulse');
        if (pulse) {
          const s = 1 + 0.28 * Math.abs(Math.sin(t * 2.4));
          pulse.scale.set(s, s, 1);
          ((pulse as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 - 0.3 * Math.abs(Math.sin(t * 2.4));
        }
      }
      const gg = goalRef.current;
      if (gg?.visible) {
        const gem = gg.getObjectByName('gem');
        if (gem) { gem.rotation.y = t * 2.2; gem.position.y = 1.15 + Math.sin(t * 2.5) * 0.08; }
        const r1 = gg.getObjectByName('ring1');
        if (r1) { const s = 1 + 0.25 * Math.abs(Math.sin(t * 2)); r1.scale.set(s, s, 1); }
      }
      const pp = pendingRef.current;
      if (pp?.visible) {
        const dot = pp.getObjectByName('dot');
        if (dot) dot.position.y = 0.5 + Math.sin(t * 3) * 0.07;
      }
      const pins = pinsRef.current;
      if (pins) {
        pins.children.forEach((pin, i) => {
          const head = pin.getObjectByName('head');
          const dot = pin.getObjectByName('dot');
          const bob = Math.sin(t * 2 + i * 1.3) * 0.05;
          if (head) head.position.y = 1.0 + bob;
          if (dot) dot.position.y = 1.0 + bob;
        });
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      (gl as any).endFrameEXP?.();
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild floor/walls when a (new) map arrives.
  useEffect(() => {
    if (!readyRef.current) return;
    rebuildMap();
  }, [rebuildMap]);

  // Re-theme scene when theme mode changes (mapData may be unchanged).
  useEffect(() => {
    if (!readyRef.current) return;
    applySceneTheme();
    rebuildMap();
  }, [themeMode, applySceneTheme, rebuildMap]);

  // Robot pose -> marker.
  useEffect(() => {
    const rg = robotRef.current;
    if (!rg) return;
    if (robotPose) {
      rg.visible = true;
      rg.position.set(robotPose.x, 0.02, -robotPose.y);
      rg.rotation.y = robotPose.rotation;
    } else {
      rg.visible = false;
    }
  }, [robotPose]);

  // Follow / zoom / full-view changes retarget the camera.
  useEffect(() => {
    if (fullView) {
      desired.current = { x: bounds.cx, z: bounds.cz };
    } else if (followMode && robotPose) {
      desired.current = { x: robotPose.x, z: -robotPose.y };
    }
    applyCamera();
  }, [fullView, followMode, zoom, robotPose, bounds.cx, bounds.cz, applyCamera]);

  // Hard recenter (locate button).
  useEffect(() => {
    if (resetTrigger == null || resetTrigger === 0) return;
    if (robotPose) desired.current = { x: robotPose.x, z: -robotPose.y };
    else desired.current = { x: bounds.cx, z: bounds.cz };
    camTarget.current = { ...desired.current };
    initializedRef.current = true;
    applyCamera();
  }, [resetTrigger, robotPose, bounds.cx, bounds.cz, applyCamera]);

  // Pins.
  useEffect(() => {
    const group = pinsRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeObject(child);
    }
    for (const pin of pinpoints) {
      const marker = createPinMarker();
      marker.position.set(pin.x, 0.02, -pin.z);
      group.add(marker);
    }
  }, [pinpoints]);

  // Pending pin.
  useEffect(() => {
    const g = pendingRef.current;
    if (!g) return;
    if (pendingPin) {
      g.visible = true;
      g.position.set(pendingPin.x, 0, -pendingPin.y);
    } else {
      g.visible = false;
    }
  }, [pendingPin]);

  // Goal beacon.
  useEffect(() => {
    const g = goalRef.current;
    if (!g) return;
    if (activeGoal) {
      g.visible = true;
      g.position.set(activeGoal.x, 0, -activeGoal.y);
    } else {
      g.visible = false;
    }
  }, [activeGoal]);

  // Path trail.
  useEffect(() => {
    const line = pathRef.current;
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
  }, [pathHistory]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      if (sceneRef.current) {
        sceneRef.current.traverse((o) => {
          if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh || o instanceof THREE.Line || o instanceof THREE.LineLoop) {
            try { disposeObject(o); } catch { /* noop */ }
          }
        });
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;
      readyRef.current = false;
    };
  }, []);

  const [panHandlers, setPanHandlers] = useState<
    ReturnType<typeof PanResponder.create>['panHandlers'] | null
  >(null);

  useEffect(() => {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,
      onPanResponderGrant: (e) => {
        didDrag.current = false;
        const touches = (e.nativeEvent as any).touches ?? [];
        if (touches.length >= 2) {
          pinchStart.current = touchDistance(touches);
          pinchZoomStart.current = zoomRef.current;
        } else {
          dragStart.current = { ...desired.current };
        }
      },
      onPanResponderMove: (e: GestureResponderEvent, gs: PanResponderGestureState) => {
        const touches = (e.nativeEvent as any).touches ?? [];
        // Pinch zoom.
        if (touches.length >= 2) {
          const d = touchDistance(touches);
          if (pinchStart.current > 0 && d > 0) {
            const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchZoomStart.current * (d / pinchStart.current)));
            if (Math.abs(next - zoomRef.current) > 0.01) onZoomRef.current?.(next);
            didDrag.current = true;
          }
          return;
        }
        if (Math.abs(gs.dx) > TAP_THRESHOLD || Math.abs(gs.dy) > TAP_THRESHOLD) {
          if (!didDrag.current) {
            didDrag.current = true;
            // Leaving follow as soon as the user grabs the map.
            if (followRef.current && !fullViewRef.current) onManualPanRef.current?.();
          }
        }
        if (!didDrag.current) return;
        if (fullViewRef.current) return; // full map stays locked

        const fh = frustumH();
        const fw = fh * (SCREEN_W / SCREEN_H);
        // Grab-style: content follows the finger.
        const dxWorld = gs.dy * (fh / SCREEN_H);
        const dzWorld = -gs.dx * (fw / SCREEN_W);
        const raw = { x: dragStart.current.x + dxWorld, z: dragStart.current.z + dzWorld };
        desired.current = clampTarget(raw.x, raw.z, fw, fh);
        applyCamera();
      },
      onPanResponderRelease: (_, gs) => {
        if (!didDrag.current && onTapRef.current) {
          const w = screenToWorldRef.current(gs.x0, gs.y0 - 0);
          if (w) onTapRef.current(w.x, w.y);
        }
        pinchStart.current = 0;
      },
      onPanResponderTerminate: () => {
        pinchStart.current = 0;
      },
    });
    queueMicrotask(() => setPanHandlers(responder.panHandlers));
  }, [applyCamera, clampTarget, frustumH]);

  const webglOk = useMemo(() => isWebGLAvailable(), []);

  return (
    <View
      style={{ flex: 1, backgroundColor: theme.mapBg, overflow: 'hidden' }}
      {...(panHandlers ?? {})}
    >
      {webglOk ? (
        <ErrorBoundary>
          <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
        </ErrorBoundary>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>WebGL is not available in this browser</Text>
        </View>
      )}
    </View>
  );
}
