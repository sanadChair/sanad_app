import * as ROSLIB from 'roslib';
import rosHandler from './ros';

class VoiceService {
  private static instance: VoiceService;
  private ros!: ROSLIB.Ros;
  private voiceCommandTopic!: ROSLIB.Topic<any>;
  private boundRos: ROSLIB.Ros | null = null;

  private constructor() {
    this.bind(rosHandler.getRos());
    rosHandler.onConnection((ros) => this.bind(ros));
  }

  private bind(ros: ROSLIB.Ros) {
    if (this.boundRos === ros) return;
    this.boundRos = ros;
    this.ros = ros;
    this.voiceCommandTopic = new ROSLIB.Topic({
      ros,
      name: '/robot/voice_command',
      messageType: 'std_msgs/String',
    });
  }

  static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  publishCommand(command: string): void {
    this.voiceCommandTopic.publish({ data: command });
  }
}

export default VoiceService;
