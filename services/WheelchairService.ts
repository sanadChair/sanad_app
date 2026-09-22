import * as ROSLIB from 'roslib';
import rosHandler from './ros';

class WheelchairService {
  private static instance: WheelchairService;
  private ros!: ROSLIB.Ros;
  private cmdVelTopic!: ROSLIB.Topic<any>;
  private boundRos: ROSLIB.Ros | null = null;
  private currentVelocity = { linear: 0, angular: 0 };

  private constructor() {
    this.bind(rosHandler.getRos());
    rosHandler.onConnection((ros) => this.bind(ros));
  }

  private bind(ros: ROSLIB.Ros) {
    if (this.boundRos === ros) return;
    if (this.boundRos) {
      try { this.cmdVelTopic?.unadvertise?.(); } catch { /* stale socket */ }
    }
    this.boundRos = ros;
    this.ros = ros;
    this.cmdVelTopic = new ROSLIB.Topic({
      ros,
      name: '/cmd_vel',
      messageType: 'geometry_msgs/Twist',
    });
  }

  static getInstance(): WheelchairService {
    if (!WheelchairService.instance) {
      WheelchairService.instance = new WheelchairService();
    }
    return WheelchairService.instance;
  }

  updateVelocity(linear: number, angular: number): void {
    this.currentVelocity = { linear, angular };
    const twist = {
      linear: { x: linear, y: 0.0, z: 0.0 },
      angular: { x: 0.0, y: 0.0, z: angular },
    };
    this.cmdVelTopic.publish(twist);
  }

  stop(): void {
    this.updateVelocity(0, 0);
  }

  getVelocity(): { linear: number; angular: number } {
    return this.currentVelocity;
  }
}

export default WheelchairService;
