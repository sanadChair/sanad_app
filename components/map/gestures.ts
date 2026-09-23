import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type PanResponderInstance,
} from 'react-native';
import { MIN_ZOOM, MAX_ZOOM, TAP_THRESHOLD, SCREEN_W, SCREEN_H } from './types';
import type { Ref } from './types';

export function touchDistance(touches: { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

export interface GestureDeps {
  desired: Ref<{ x: number; z: number }>;
  dragStart: Ref<{ x: number; z: number }>;
  didDrag: Ref<boolean>;
  pinchStart: Ref<number>;
  pinchZoomStart: Ref<number>;
  zoomRef: Ref<number>;
  followRef: Ref<boolean>;
  fullViewRef: Ref<boolean | undefined>;
  onManualPanRef: Ref<(() => void) | undefined>;
  onZoomRef: Ref<((z: number) => void) | undefined>;
  onTapRef: Ref<((x: number, y: number) => void) | undefined>;
  screenToWorldRef: Ref<(sx: number, sy: number) => { x: number; y: number } | null>;
  frustumH: () => number;
  clampTarget: (x: number, z: number, fw: number, fh: number) => { x: number; z: number };
  applyCamera: () => void;
}

export function createMapPanResponder(deps: GestureDeps): PanResponderInstance {
  const {
    desired, dragStart, didDrag, pinchStart, pinchZoomStart,
    zoomRef, followRef, fullViewRef, onManualPanRef, onZoomRef, onTapRef,
    screenToWorldRef, frustumH, clampTarget, applyCamera,
  } = deps;

  return PanResponder.create({
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
}
