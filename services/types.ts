export interface OccupancyGrid {
  header: {
    frame_id: string;
    stamp: { sec: number; nanosec: number };
  };
  info: {
    resolution: number;
    width: number;
    height: number;
    origin: {
      position: { x: number; y: number; z: number };
      orientation: { x: number; y: number; z: number; w: number };
    };
  };
  data: number[];
}

export interface RobotPose {
  x: number;
  y: number;
  rotation: number;
}

export interface GoalPoint {
  x: number;
  y: number;
  label?: string;
}

export interface PathPoint extends RobotPose {
  timestamp: number;
}

export type NavigationStatus =
  | 'idle'
  | 'goal_sent'
  | 'navigating'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface NavigationFeedback {
  currentPose?: RobotPose | null;
  distanceRemaining?: number;
  estimatedTimeRemainingSec?: number;
  navigationTimeSec?: number;
  numberOfRecoveries?: number;
}

export interface NavigationState {
  status: NavigationStatus;
  activeGoal: GoalPoint | null;
  lastFeedback: NavigationFeedback | null;
  pathHistory: PathPoint[];
  lastError: string | null;
}

export interface Spot {
  title: string;
  pose_x: number;
  pose_y: number;
  pose_z: number;
  pose_theta: number;
}

export type SpotInput = Spot;

