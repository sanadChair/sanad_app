import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, PanResponder } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { usePinpoints } from '../contexts/PinpointsContext';
import { useTheme } from '../contexts/ThemeContext';
import ErrorBoundary, { isWebGLAvailable } from './ErrorBoundary';
import type { Bounds, GoalProp, MapSceneProps, PathProp } from './map/types';
import { createFloorMesh, createWallsMesh, createFrameLine, disposeObject, updatePathLine } from './map/meshes';
import { createRobotMarker, createGoalMarker, createPendingMarker, animateMarkers, rebuildPins } from './map/markers';
import {
  frustumH as calcFrustumH,
  clampTarget as clampCameraTarget,
  applyCamera as applyCameraTo,
  screenToWorld as screenToWorldPlane,
} from './map/camera';
import { createMapPanResponder } from './map/gestures';
import {
  createGLRenderer,
  createBaseScene,
  createOrthoCamera,
  createPathLine,
  applySceneTheme as applySceneChromeTheme,
} from './map/sceneSetup';

export type { GoalProp, PathProp, MapSceneProps };

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

  const cameraRefs = useMemo(() => ({
    camera: cameraRef,
    desired,
    camTarget,
    initialized: initializedRef,
    fullView: fullViewRef,
    follow: followRef,
    robotPose: robotPoseRef,
    bounds: boundsRef,
  }), []);

  const frustumH = useCallback((): number => calcFrustumH(fullViewRef, zoomRef, boundsRef), []);

  const clampTarget = useCallback(
    (x: number, z: number, fw: number, fh: number) => clampCameraTarget(x, z, fw, fh, boundsRef), [],
  );

  const applyCamera = useCallback(
    () => applyCameraTo(cameraRefs, frustumH, clampTarget),
    [cameraRefs, clampTarget, frustumH],
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number) => screenToWorldPlane(sx, sy, cameraRef.current, boundsRef.current, grid.originY, meshH),
    [grid.originY, meshH],
  );

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

  const applySceneTheme = useCallback(() => {
    applySceneChromeTheme(rendererRef.current, sceneRef.current, themeRef.current, pathRef.current);
  }, []);

  const onContextCreate = useCallback((gl: any) => {
    const renderer = createGLRenderer(gl);
    const t0 = themeRef.current;
    renderer.setClearColor(new THREE.Color(t0.mapBg));
    rendererRef.current = renderer;

    const scene = createBaseScene(t0);
    sceneRef.current = scene;

    const fh = frustumH();
    const camera = createOrthoCamera(fh);
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

    const pathLine = createPathLine(t0);
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

      animateMarkers(t, robotRef.current, goalRef.current, pendingRef.current, pinsRef.current);

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
    rebuildPins(group, pinpoints);
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
    updatePathLine(pathRef.current, pathHistory);
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
    const responder = createMapPanResponder({
      desired, dragStart, didDrag, pinchStart, pinchZoomStart,
      zoomRef, followRef, fullViewRef, onManualPanRef, onZoomRef, onTapRef,
      screenToWorldRef, frustumH, clampTarget, applyCamera,
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
