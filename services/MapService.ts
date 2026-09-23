import * as ROSLIB from 'roslib';
import rosHandler from './ros';
import type { OccupancyGrid, RobotPose, NavigationState, NavigationFeedback, PathPoint } from './types';

const MAX_PATH_POINTS = 240;
const GOAL_REACHED_THRESHOLD = 0.2;

type MapListener = (map: OccupancyGrid) => void;
type PoseListener = (pose: RobotPose) => void;
type NavigationListener = (state: NavigationState) => void;

/** Occupancy value at a world point (-1 unknown/out of bounds, else 0..100). */
export function cellAt(map: OccupancyGrid, x: number, y: number): number {
  const { resolution, width, height, origin } = map.info;
  const c = Math.floor((x - origin.position.x) / resolution);
  const r = Math.floor((y - origin.position.y) / resolution);
  if (c < 0 || r < 0 || c >= width || r >= height) return -1;
  return map.data[r * width + c];
}

/**
 * Nudge a goal onto the nearest known-free cell (ring search). Returns
 * null when nothing traversable is nearby — better to fail locally with
 * a clear message than have Nav2 reject the goal. Pass null for "no map
 * yet" (treated as "assume free").
 */
export function snapToFree(
  map: OccupancyGrid | null,
  x: number,
  y: number,
  maxRadius: number,
): { x: number; y: number; adjusted: boolean } | null {
  if (!map) return { x, y, adjusted: false };
  const FREE_MAX = 50;
  if (cellAt(map, x, y) >= 0 && cellAt(map, x, y) <= FREE_MAX) {
    return { x, y, adjusted: false };
  }
  const res = map.info.resolution;
  for (let radius = res; radius <= maxRadius; radius += res) {
    const steps = Math.max(8, Math.floor((2 * Math.PI * radius) / res));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const cx = x + Math.cos(a) * radius;
      const cy = y + Math.sin(a) * radius;
      const v = cellAt(map, cx, cy);
      if (v >= 0 && v <= FREE_MAX) return { x: cx, y: cy, adjusted: true };
    }
  }
  return null;
}

/** Translate rosbridge/action errors into something a user can act on. */
export function friendlyGoalError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('rejected')) {
    return 'Goal rejected — that spot may be unreachable or the planner is busy. Try nearby open floor.';
  }
  if (lower.includes('abort')) {
    return 'Navigation aborted — path blocked or goal unreachable.';
  }
  if (lower.includes('cancel')) {
    return 'Navigation canceled.';
  }
  return 'Navigation failed. Try a nearby open spot.';
}

class MapService {
  private static instance: MapService;
  private ros!: ROSLIB.Ros;
  private mapTopic!: ROSLIB.Topic<any>;
  private poseTopic!: ROSLIB.Topic<any>;
  private clockTopic!: ROSLIB.Topic<any>;
  private navigationActionClient: any;
  private boundRos: ROSLIB.Ros | null = null;
  private lastStamp: { sec: number; nanosec: number } | null = null;
  private poseReceiptMs = 0;
  private clockStamp: { sec: number; nanosec: number } | null = null;
  private clockReceiptMs = 0;
  private latestPose: RobotPose | null = null;
  private latestMap: OccupancyGrid | null = null;
  private activeGoalId: string | null = null;
  private mapListeners = new Set<MapListener>();
  private poseListeners = new Set<PoseListener>();
  private navigationListeners = new Set<NavigationListener>();

  private navigationState: NavigationState = {
    status: 'idle',
    activeGoal: null,
    lastFeedback: null,
    pathHistory: [],
    lastError: null,
  };

  private constructor() {
    this.bind(rosHandler.getRos());
    // Reconnect creates a fresh Ros instance — topics/action must follow it.
    rosHandler.onConnection((ros) => this.bind(ros));
  }

  private bind(ros: ROSLIB.Ros) {
    if (this.boundRos === ros) return;

    if (this.boundRos) {
      try { this.mapTopic?.unsubscribe(); } catch { /* stale socket */ }
      try { this.poseTopic?.unsubscribe(); } catch { /* stale socket */ }
      try { this.clockTopic?.unsubscribe(); } catch { /* stale socket */ }
    }

    this.boundRos = ros;
    this.ros = ros;
    this.activeGoalId = null;

    this.mapTopic = new ROSLIB.Topic({
      ros,
      name: '/map',
      messageType: 'nav_msgs/OccupancyGrid',
      compression: 'png',
    });

    this.poseTopic = new ROSLIB.Topic({
      ros,
      name: '/amcl_pose',
      messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped',
    });

    // ROS clock (present when use_sim_time is enabled). Goal stamps must be
    // valid ROS time or Nav2 rejects the goal outright.
    this.clockTopic = new ROSLIB.Topic({
      ros,
      name: '/clock',
      messageType: 'rosgraph_msgs/msg/Clock',
    });

    const RoslibWithAction = ROSLIB as unknown as {
      Action: new (options: {
        ros: ROSLIB.Ros;
        name: string;
        actionType: string;
      }) => {
        sendGoal: (
          goal: unknown,
          resultCallback: (result: any) => void,
          feedbackCallback?: (feedback: any) => void,
          failedCallback?: (error: string) => void,
        ) => string;
        cancelGoal?: (id: string) => void;
      };
    };

    this.navigationActionClient = new RoslibWithAction.Action({
      ros,
      name: '/navigate_to_pose',
      actionType: 'nav2_msgs/action/NavigateToPose',
    });

    this.mapTopic.subscribe((message: any) => {
      const map: OccupancyGrid = {
        header: message.header,
        info: message.info,
        data: message.data,
      };
      this.latestMap = map;
      for (const listener of this.mapListeners) listener(map);
    });

    this.poseTopic.subscribe((message: any) => {
      if (message.header?.stamp) {
        this.lastStamp = message.header.stamp;
        this.poseReceiptMs = Date.now();
      }
      try {
        const pose = this.toRobotPose(message);
        this.latestPose = pose;
        for (const listener of this.poseListeners) listener(pose);
        this.updatePathHistory(pose);
      } catch (error) {
        console.error('[MapService] Failed to parse pose:', error);
      }
    });

    this.clockTopic.subscribe((message: any) => {
      const stamp = message.clock ?? message.header?.stamp;
      if (stamp && typeof stamp.sec === 'number') {
        this.clockStamp = { sec: stamp.sec, nanosec: stamp.nanosec ?? 0 };
        this.clockReceiptMs = Date.now();
      }
    });
  }

  static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }

  onMapUpdate(callback: MapListener): () => void {
    this.mapListeners.add(callback);
    return () => { this.mapListeners.delete(callback); };
  }

  onPoseUpdate(callback: PoseListener): () => void {
    this.poseListeners.add(callback);
    return () => { this.poseListeners.delete(callback); };
  }

  onNavigationUpdate(callback: NavigationListener): () => void {
    this.navigationListeners.add(callback);
    callback(this.navigationState);
    return () => { this.navigationListeners.delete(callback); };
  }

  setGoal(x: number, y: number, label?: string): void {
    // Preempt any in-flight goal first: Nav2 only tracks one goal and may
    // reject a new one while the old handle is still active.
    if (this.activeGoalId && (this.navigationState.status === 'goal_sent' || this.navigationState.status === 'navigating')) {
      try {
        this.navigationActionClient.cancelGoal?.(this.activeGoalId);
      } catch (error) {
        console.warn('[MapService] Error preempting previous goal:', error);
      }
      this.activeGoalId = null;
    }

    // Snap the tapped point onto known free space. Goals inside walls or in
    // unscanned (unknown) cells are rejected or unplannable by Nav2.
    const target = snapToFree(this.latestMap, x, y, 2.0);
    if (!target) {
      console.warn(`[MapService] Goal (${x.toFixed(2)}, ${y.toFixed(2)}) has no free space within 2m — not sending`);
      this.navigationState = {
        status: 'failed',
        activeGoal: null,
        lastFeedback: null,
        pathHistory: this.navigationState.pathHistory,
        lastError: 'No reachable open space near that point. Try tapping open floor.',
      };
      this.emitNavigation();
      return;
    }
    if (target.adjusted) {
      console.log(`[MapService] Snapped goal (${x.toFixed(2)}, ${y.toFixed(2)}) -> (${target.x.toFixed(2)}, ${target.y.toFixed(2)}) onto free space`);
    }

    const gx = target.x;
    const gy = target.y;
    const stamp = this.goalStamp();

    console.log(`[MapService] Setting goal: x=${gx.toFixed(3)}, y=${gy.toFixed(3)}, label=${label || 'none'}`);
    if (this.latestPose) {
      const dist = Math.hypot(gx - this.latestPose.x, gy - this.latestPose.y);
      console.log(`[MapService] Robot at: x=${this.latestPose.x.toFixed(3)}, y=${this.latestPose.y.toFixed(3)}, distance=${dist.toFixed(2)}m`);
    }

    this.navigationState = {
      status: 'goal_sent',
      activeGoal: { x: gx, y: gy, label },
      lastFeedback: null,
      pathHistory: this.latestPose ? [this.toPathPoint(this.latestPose)] : [],
      lastError: null,
    };
    this.emitNavigation();

    this.activeGoalId = this.navigationActionClient.sendGoal(
      {
        pose: {
          header: { frame_id: 'map', stamp },
          pose: {
            position: { x: gx, y: gy, z: 0.0 },
            orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
          },
        },
        behavior_tree: '',
      },
      (result: any) => {
        const ok = result?.error_code === 0 || result?.error_code == null;
        const msg = result?.error_msg;
        if (!ok) console.warn('[MapService] Navigation result failed:', msg ?? result);
        this.activeGoalId = null;
        this.navigationState = {
          ...this.navigationState,
          status: ok ? 'succeeded' : 'failed',
          activeGoal: null,
          lastError: ok ? null : (typeof msg === 'string' && msg.length > 0 ? msg : 'Planner failed to reach the goal.'),
        };
        this.emitNavigation();
      },
      (feedback: any) => {
        this.navigationState = {
          ...this.navigationState,
          status: 'navigating',
          lastFeedback: this.toNavigationFeedback(feedback),
        };
        this.emitNavigation();
      },
      (error: string) => {
        const friendly = friendlyGoalError(error);
        console.warn('[MapService] Navigation failed:', friendly, `(${error})`);
        this.activeGoalId = null;
        this.navigationState = {
          ...this.navigationState,
          status: 'failed',
          activeGoal: null,
          lastError: friendly,
        };
        this.emitNavigation();
      },
    );
  }

  cancelGoal(): void {
    if (this.activeGoalId && this.navigationActionClient.cancelGoal) {
      try {
        this.navigationActionClient.cancelGoal(this.activeGoalId);
      } catch (error) {
        console.error('[MapService] Error canceling goal:', error);
      }
      this.activeGoalId = null;
    }
    this.navigationState = {
      ...this.navigationState,
      status: 'canceled',
      activeGoal: null,
    };
    this.emitNavigation();
  }

  getLatestPose(): RobotPose | null {
    return this.latestPose;
  }

  getNavigationState(): NavigationState {
    return this.navigationState;
  }

  /**
   * Best-effort current ROS timestamp for goal headers. Nav2 rejects goals
   * with zero/stale stamps, so prefer /clock, then the fresh AMCL stamp,
   * then wall-clock time as a last resort.
   */
  private goalStamp(): { sec: number; nanosec: number } {
    const now = Date.now();
    if (this.clockStamp && now - this.clockReceiptMs < 1500) {
      return this.clockStamp;
    }
    if (this.lastStamp && this.lastStamp.sec !== 0 && now - this.poseReceiptMs < 2000) {
      return this.lastStamp;
    }
    const ms = now;
    return { sec: Math.floor(ms / 1000), nanosec: (ms % 1000) * 1e6 };
  }

  private emitNavigation() {
    for (const listener of this.navigationListeners) listener(this.navigationState);
  }

  private updatePathHistory(pose: RobotPose) {
    const pathPoint = this.toPathPoint(pose);
    const trimmedPath = [...this.navigationState.pathHistory, pathPoint].slice(-MAX_PATH_POINTS);
    let status = this.navigationState.status;
    let activeGoal = this.navigationState.activeGoal;

    if (activeGoal) {
      const distance = Math.hypot(activeGoal.x - pose.x, activeGoal.y - pose.y);
      if (distance <= GOAL_REACHED_THRESHOLD) {
        status = 'succeeded';
        activeGoal = null;
      } else if (status === 'goal_sent') {
        status = 'navigating';
      }
    }

    this.navigationState = {
      ...this.navigationState,
      status,
      activeGoal,
      pathHistory: trimmedPath,
    };
    this.emitNavigation();
  }

  private toPathPoint(pose: RobotPose): PathPoint {
    return { ...pose, timestamp: Date.now() };
  }

  private toRobotPose(message: any): RobotPose {
    const x = message.pose.pose.position.x;
    const y = message.pose.pose.position.y;
    const q = message.pose.pose.orientation;
    const sinyCosp = 2 * (q.w * q.z + q.x * q.y);
    const cosyCosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    return { x, y, rotation: Math.atan2(sinyCosp, cosyCosp) };
  }

  private toNavigationFeedback(feedback: any): NavigationFeedback {
    return {
      currentPose: feedback?.current_pose
        ? this.toRobotPose({ pose: { pose: feedback.current_pose.pose } })
        : null,
      distanceRemaining: feedback?.distance_remaining,
      estimatedTimeRemainingSec: feedback?.estimated_time_remaining
        ? feedback.estimated_time_remaining.sec
        : undefined,
      navigationTimeSec: feedback?.navigation_time?.sec,
      numberOfRecoveries: feedback?.number_of_recoveries,
    };
  }
}

export default MapService;
