import * as ROSLIB from 'roslib';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeWsUrl, DEFAULT_ROSBRIDGE_URL_FALLBACK } from './wsUrl';

const RECONNECT_DELAY = 2000;

type ConnectionListener = (ros: ROSLIB.Ros) => void;
type DisconnectListener = () => void;
type ErrorListener = (err: Error) => void;

export const ROS_URL_STORAGE_KEY = 'sanad.rosbridge.url';

const ENV_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ROSBRIDGE_URL) ||
  DEFAULT_ROSBRIDGE_URL_FALLBACK;

class RosConnection {
  private static instance: RosConnection;
  private ros: ROSLIB.Ros | null = null;
  private _connected = false;
  private url: string;
  /** Bumped whenever we drop a socket on purpose — stale handlers no-op. */
  private generation = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionListeners = new Set<ConnectionListener>();
  private disconnectListeners = new Set<DisconnectListener>();
  private errorListeners = new Set<ErrorListener>();

  private constructor() {
    this.url = normalizeWsUrl(ENV_URL) ?? DEFAULT_ROSBRIDGE_URL_FALLBACK;
    this.connect();
    void this.restoreSavedUrl();
  }

  static getInstance(): RosConnection {
    if (!RosConnection.instance) {
      RosConnection.instance = new RosConnection();
    }
    return RosConnection.instance;
  }

  private async restoreSavedUrl() {
    try {
      const saved = await AsyncStorage.getItem(ROS_URL_STORAGE_KEY);
      if (saved && saved !== this.url) {
        const normalized = normalizeWsUrl(saved);
        if (normalized) this.setUrl(normalized, { persist: false });
      }
    } catch {
      /* keep env/default URL */
    }
  }

  private connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const gen = ++this.generation;
    const ros = new ROSLIB.Ros({ url: this.url });
    this.ros = ros;
    this._connected = false;

    ros.on('connection', () => {
      if (gen !== this.generation) return;
      this._connected = true;
      console.log(`[ROS] Connected to ${this.url}`);
      for (const listener of this.connectionListeners) listener(ros);
    });

    ros.on('error', (err: unknown) => {
      if (gen !== this.generation) return;
      this._connected = false;
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[ROS] Error: ${error.message}`);
      for (const listener of this.errorListeners) listener(error);
    });

    ros.on('close', () => {
      if (gen !== this.generation) return;
      if (this._connected) {
        console.warn('[ROS] Connection closed');
      } else {
        console.warn('[ROS] Connection failed');
      }
      this._connected = false;
      for (const listener of this.disconnectListeners) listener();
      console.log(`[ROS] Reconnecting in ${RECONNECT_DELAY}ms...`);
      this.reconnectTimer = setTimeout(() => {
        if (gen === this.generation) this.connect();
      }, RECONNECT_DELAY);
    });
  }

  /**
   * Point the client at a new rosbridge (manual IP or auto-scan hit) and
   * reconnect. Services rebind via onConnection when the new socket opens.
   */
  setUrl(
    input: string,
    opts: { persist?: boolean } = {},
  ): string {
    const normalized = normalizeWsUrl(input);
    if (!normalized) {
      throw new Error('Enter a valid IP or ws:// URL (port 9090 default).');
    }
    const persist = opts.persist !== false;
    if (normalized === this.url && this.ros) {
      if (!this._connected && !this.reconnectTimer) this.connect();
      return this.url;
    }

    const wasConnected = this._connected;
    this.url = normalized;
    if (persist) {
      void AsyncStorage.setItem(ROS_URL_STORAGE_KEY, normalized).catch(() => {});
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Invalidate old socket handlers before close so they do not auto-reconnect.
    this.generation += 1;
    const old = this.ros;
    this.ros = null;
    this._connected = false;
    if (wasConnected) {
      for (const listener of this.disconnectListeners) listener();
    }
    try {
      old?.close();
    } catch {
      /* already dead */
    }
    this.connect();
    return this.url;
  }

  getUrl(): string {
    return this.url;
  }

  get connected(): boolean {
    return this._connected && !!this.ros?.isConnected;
  }

  getRos(): ROSLIB.Ros {
    if (!this.ros) {
      this.connect();
    }
    if (!this.ros) {
      throw new Error('ROS connection not initialized');
    }
    return this.ros;
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  onDisconnect(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => {
      this.disconnectListeners.delete(listener);
    };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }
}

const rosHandler = RosConnection.getInstance();
export default rosHandler;
