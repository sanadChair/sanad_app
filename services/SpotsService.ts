import * as ROSLIB from 'roslib';
import rosHandler from './ros';
import type { Spot, SpotInput } from './types';

const CALL_TIMEOUT_SEC = 5;

type AnyRecord = Record<string, unknown>;

interface AddSpotRequest {
  spot: Spot;
}

interface DeleteSpotRequest {
  title: string;
}

interface SpotServiceResult {
  success?: boolean;
  message?: string;
}

interface GetAllSpotsResult {
  spots?: unknown;
}

function asRecord(value: unknown): AnyRecord | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as AnyRecord;
  }
  return null;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Coerce one ROS/unknown entry into a Spot, or null if unusable. */
export function normalizeSpot(entry: unknown): Spot | null {
  const rec = asRecord(entry);
  if (!rec) return null;
  const title =
    typeof rec.title === 'string'
      ? rec.title
      : typeof rec.name === 'string'
        ? rec.name
        : '';
  if (!title) return null;
  return {
    title,
    pose_x: toNumber(rec.pose_x),
    pose_y: toNumber(rec.pose_y),
    pose_z: toNumber(rec.pose_z),
    pose_theta: toNumber(rec.pose_theta),
  };
}

function pickSpotList(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const rec = asRecord(result);
  if (!rec) return [];
  for (const key of ['spots', 'values', 'data'] as const) {
    const value = rec[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

/** Map a /spots/get_all response (shape varies by bridge) to Spot[]. */
export function mapGetAllResult(result: unknown): Spot[] {
  const spots: Spot[] = [];
  for (const entry of pickSpotList(result)) {
    const spot = normalizeSpot(entry);
    if (spot) spots.push(spot);
  }
  return spots;
}

/** Throw when a { success, message } response reports failure. */
export function mapServiceResult(result: unknown, action: string): void {
  const rec = asRecord(result);
  if (rec && rec.success === false) {
    const message =
      typeof rec.message === 'string' && rec.message.length > 0
        ? rec.message
        : `${action} failed`;
    throw new Error(message);
  }
}

/** Normalize a rosbridge/timeout/Error failure into a user-facing string. */
export function mapServiceError(err: unknown): string {
  if (typeof err === 'string' && err.length > 0) return err;
  if (err instanceof Error && err.message) return err.message;
  const rec = asRecord(err);
  if (rec) {
    if (typeof rec.message === 'string' && rec.message) return rec.message;
    if (typeof rec.data === 'string' && rec.data) return rec.data;
  }
  return 'Spot service request failed.';
}

class SpotsService {
  private static instance: SpotsService;
  private getAllService!: ROSLIB.Service<object, GetAllSpotsResult>;
  private addService!: ROSLIB.Service<object, SpotServiceResult>;
  private deleteService!: ROSLIB.Service<object, SpotServiceResult>;
  private boundRos: ROSLIB.Ros | null = null;

  private constructor() {
    this.bind(rosHandler.getRos());
    rosHandler.onConnection((ros) => this.bind(ros));
  }

  private bind(ros: ROSLIB.Ros) {
    if (this.boundRos === ros) return;
    this.boundRos = ros;
    this.getAllService = new ROSLIB.Service<object, GetAllSpotsResult>({
      ros,
      name: '/spots/get_all',
      serviceType: 'sanad_interfaces/srv/GetAllSpots',
    });
    this.addService = new ROSLIB.Service<object, SpotServiceResult>({
      ros,
      name: '/spots/add',
      serviceType: 'sanad_interfaces/srv/AddSpot',
    });
    this.deleteService = new ROSLIB.Service<object, SpotServiceResult>({
      ros,
      name: '/spots/delete',
      serviceType: 'sanad_interfaces/srv/DeleteSpot',
    });
  }

  /**
   * Reconnect may have replaced Ros after this service's onConnection
   * listener was registered later than a caller (e.g. Pinpoints refresh).
   * Always rebind to the live socket before a call.
   */
  private ensureBound(): void {
    this.bind(rosHandler.getRos());
  }

  static getInstance(): SpotsService {
    if (!SpotsService.instance) {
      SpotsService.instance = new SpotsService();
    }
    return SpotsService.instance;
  }

  getAll(): Promise<Spot[]> {
    this.ensureBound();
    return this.call<GetAllSpotsResult>(this.getAllService, {}).then((result) =>
      mapGetAllResult(result),
    );
  }

  add(spot: SpotInput): Promise<void> {
    this.ensureBound();
    // AddSpot.srv nests the pose under a `spot` field (sanad_interfaces/Spot).
    const request: AddSpotRequest = {
      spot: {
        title: spot.title,
        pose_x: spot.pose_x,
        pose_y: spot.pose_y,
        pose_z: spot.pose_z,
        pose_theta: spot.pose_theta,
      },
    };
    return this.call<SpotServiceResult>(this.addService, request).then((result) => {
      mapServiceResult(result, `Add spot '${spot.title}'`);
    });
  }

  remove(title: string): Promise<void> {
    this.ensureBound();
    const request: DeleteSpotRequest = { title };
    return this.call<SpotServiceResult>(this.deleteService, request).then((result) => {
      mapServiceResult(result, `Delete spot '${title}'`);
    });
  }

  private call<TResponse>(
    service: ROSLIB.Service<object, TResponse>,
    request: object,
  ): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Spot service request timed out.'));
      }, CALL_TIMEOUT_SEC * 1000);

      service.callService(
        request,
        (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(response);
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new Error(mapServiceError(error)));
        },
        CALL_TIMEOUT_SEC,
      );
    });
  }
}

export default SpotsService;
