import * as ROSLIB from 'roslib';

const ROSBRIDGE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ROSBRIDGE_URL) ||
  'ws://localhost:9090';
const RECONNECT_DELAY = 2000;

type ConnectionListener = (ros: ROSLIB.Ros) => void;
type DisconnectListener = () => void;
type ErrorListener = (err: Error) => void;

class RosConnection {
  private static instance: RosConnection;
  private ros: ROSLIB.Ros | null = null;
  private _connected = false;
  private url: string;
  private connectionListeners = new Set<ConnectionListener>();
  private disconnectListeners = new Set<DisconnectListener>();
  private errorListeners = new Set<ErrorListener>();

  private constructor() {
    this.url = ROSBRIDGE_URL;
    this.connect();
  }

  static getInstance(): RosConnection {
    if (!RosConnection.instance) {
      RosConnection.instance = new RosConnection();
    }
    return RosConnection.instance;
  }

  private connect() {
    this.ros = new ROSLIB.Ros({ url: this.url });

    this.ros.on('connection', () => {
      this._connected = true;
      console.log(`[ROS] Connected to ${this.url}`);
      for (const listener of this.connectionListeners) listener(this.ros!);
    });

    this.ros.on('error', (err: any) => {
      this._connected = false;
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[ROS] Error: ${error.message}`);
      for (const listener of this.errorListeners) listener(error);
    });

    this.ros.on('close', () => {
      if (this._connected) {
        console.warn('[ROS] Connection closed');
      } else {
        console.warn('[ROS] Connection failed');
      }
      this._connected = false;
      for (const listener of this.disconnectListeners) listener();
      console.log(`[ROS] Reconnecting in ${RECONNECT_DELAY}ms...`);
      setTimeout(() => this.connect(), RECONNECT_DELAY);
    });
  }

  get connected(): boolean {
    return this._connected && !!this.ros?.isConnected;
  }

  getRos(): ROSLIB.Ros {
    if (!this.ros) {
      throw new Error('ROS connection not initialized');
    }
    return this.ros;
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => { this.connectionListeners.delete(listener); };
  }

  onDisconnect(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => { this.disconnectListeners.delete(listener); };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => { this.errorListeners.delete(listener); };
  }
}

const rosHandler = RosConnection.getInstance();
export default rosHandler;
