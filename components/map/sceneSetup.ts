import * as THREE from 'three';
import type { ThemeColors } from '../../contexts/ThemeContext';
import { SCREEN_W, SCREEN_H } from './types';

// Renderer backed by the expo-gl context (canvas shim for three's DOM API).
export function createGLRenderer(gl: any): THREE.WebGLRenderer {
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
  if ('outputColorSpace' in renderer && (THREE as any).SRGBColorSpace) {
    (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  }
  return renderer;
}

// Scene chrome: background/fog, lights, infinite ground, grid overlay.
export function createBaseScene(theme: ThemeColors): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.mapBg);
  scene.fog = new THREE.Fog(new THREE.Color(theme.mapBg), 45, 110);

  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const hemi = new THREE.HemisphereLight(0x8fb4ff, new THREE.Color(theme.mapGround), 0.55);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(-6, 12, 4);
  scene.add(dir);

  // Infinite ground so the void reads as intentional studio backdrop.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.mapGround) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.renderOrder = -2;
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(
    60,
    60,
    new THREE.Color(theme.mapGrid),
    new THREE.Color(theme.mapGridMinor)
  );
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as any).opacity = 0.28;
  gridHelper.position.y = -0.04;
  scene.add(gridHelper);

  return scene;
}

export function createOrthoCamera(fh: number): THREE.OrthographicCamera {
  const fw = fh * (SCREEN_W / SCREEN_H);
  const camera = new THREE.OrthographicCamera(-fw / 2, fw / 2, fh / 2, -fh / 2, 0.1, 220);
  camera.up.set(1, 0, 0);
  return camera;
}

export function createPathLine(theme: ThemeColors): THREE.Line {
  const pathGeo = new THREE.BufferGeometry();
  const pathLine = new THREE.Line(
    pathGeo,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(theme.mapPath),
      transparent: true,
      opacity: 0.85,
    })
  );
  pathLine.frustumCulled = false;
  return pathLine;
}

// Apply theme palette to scene chrome (bg, fog, ground, grid, path).
export function applySceneTheme(
  renderer: THREE.WebGLRenderer | null,
  scene: THREE.Scene | null,
  theme: ThemeColors,
  pathLine: THREE.Line | null,
): void {
  if (renderer) renderer.setClearColor(new THREE.Color(theme.mapBg));
  if (!scene) return;
  scene.background = new THREE.Color(theme.mapBg);
  if (scene.fog instanceof THREE.Fog) scene.fog.color.set(theme.mapBg);
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshBasicMaterial | undefined;
      if (mat && mat.color && obj.geometry instanceof THREE.PlaneGeometry && obj.position.y < 0) {
        mat.color.set(theme.mapGround);
      }
    } else if (obj instanceof THREE.GridHelper) {
      const m = obj.material as THREE.Material & { color?: THREE.Color };
      if (m.color) m.color.set(theme.mapGrid);
    } else if (obj === pathLine) {
      const pathMat = pathLine.material as THREE.LineBasicMaterial;
      if (pathMat?.color) pathMat.color.set(theme.mapPath);
    }
  });
}
