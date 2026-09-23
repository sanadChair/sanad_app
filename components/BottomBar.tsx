import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../constants/tokens';
import Joystick from './Joystick';
import ModeIndicator, { DriveMode } from './ModeIndicator';
import VoiceButton from './VoiceButton';
import type { RobotPose, GoalPoint } from '../services/types';

interface BottomBarProps {
  mode: DriveMode;
  isNavigating: boolean;
  robotPose: RobotPose | null;
  activeGoal: GoalPoint | null;
  distanceRemaining?: number | null;
  onCancelNavigation: () => void;
  onRecordingChange: (isRecording: boolean) => void;
}

export default function BottomBar({
  mode,
  isNavigating,
  robotPose,
  activeGoal,
  distanceRemaining,
  onCancelNavigation,
  onRecordingChange,
}: BottomBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing[3] }]}>
      <View style={styles.joystickWrap}>
        <Joystick
          isNavigating={isNavigating}
          robotPose={robotPose}
          navGoal={activeGoal}
          distanceRemaining={distanceRemaining}
          onCancelNavigation={onCancelNavigation}
        />
      </View>

      <View style={styles.centerControls}>
        <ModeIndicator mode={mode} onCancelNavigation={onCancelNavigation} />
      </View>

      <View style={styles.voiceWrap}>
        <VoiceButton onRecordingChange={onRecordingChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    zIndex: 20,
  },
  joystickWrap: { flex: 1, alignItems: 'flex-start' },
  centerControls: { alignItems: 'center', paddingBottom: spacing[2] },
  voiceWrap: { flex: 1, alignItems: 'flex-end' },
});
