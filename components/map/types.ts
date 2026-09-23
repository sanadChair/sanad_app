import { Dimensions } from 'react-native';
import type { RobotPose, OccupancyGrid } from '../../services/types';

// ---------------------------------------------------------------------------
// Shared constants (visual framing + gesture thresholds).
// ---------------------------------------------------------------------------
export const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
export const TAP_THRESHOLD = 10;

// Tight follow view (~chair scale) and zoom limits.
export const BASE_FOLLOW_H = 8.5;
export const MIN_FRUSTUM_H = 2.5;
export const MAX_FRUSTUM_H = 26;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.0;
// Tilted 3/4 view: eye height + pullback define the viewing angle (~65deg).
export const EYE_H = 30;
export const EYE_BACK = 14;
export const CLAMP_MARGIN = 1.0;
export const MAX_WALL_INSTANCES = 16000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
/** Structural ref shape so pure modules don't need React types. */
export interface Ref<T> {
  current: T;
}

export type RGB = [number, number, number];

export interface GoalProp {
  x: number;
  y: number;
}

export interface PathProp {
  x: number;
  y: number;
}

export interface MapSceneProps {
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

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  w: number;
  h: number;
}
