import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { elevation, fonts } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';
import { useJoystick } from '../contexts/JoystickContext';
import type { RobotPose, GoalPoint } from '../services/types';

const JOYSTICK_SIZE = 140;
const KNOB_SIZE = 52;
const MAX_RADIUS = (JOYSTICK_SIZE - KNOB_SIZE) / 2 - 4;

const MAX_LINEAR = 0.3;
const MAX_ANGULAR = 1.0;

interface JoystickProps {
  isNavigating?: boolean;
  robotPose?: RobotPose | null;
  navGoal?: GoalPoint | null;
  distanceRemaining?: number | null;
  onCancelNavigation?: () => void;
}

export default function Joystick({
  isNavigating = false,
  robotPose,
  navGoal,
  distanceRemaining,
  onCancelNavigation,
}: JoystickProps) {
  const { colors } = useTheme();
  const { updateVelocity, stop } = useJoystick();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const active = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: colors.border,
    transform: [{ scale: interpolate(active.value, [0, 1], [1, 1.04]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(active.value, [0, 1], [0.6, 1.2]) }],
  }));

  const directionStyle = useAnimatedStyle(() => {
    const angle = Math.atan2(translateY.value, translateX.value);
    const dist = Math.sqrt(translateX.value ** 2 + translateY.value ** 2);
    const opacity = interpolate(dist, [0, MAX_RADIUS * 0.3, MAX_RADIUS], [0, 0.3, 0.6], 'clamp');
    return {
      opacity,
      transform: [
        { rotate: `${angle}rad` },
        { scaleX: interpolate(dist, [0, MAX_RADIUS], [0.3, 1], 'clamp') },
      ],
    };
  });

  const onMoveJS = useCallback(
    (x: number, y: number) => {
      updateVelocity(-y * MAX_LINEAR, -x * MAX_ANGULAR);
    },
    [updateVelocity]
  );

  const onReleaseJS = useCallback(() => {
    stop();
  }, [stop]);

  const [pan, setPan] = useState<ReturnType<typeof Gesture.Pan> | null>(null);

  useEffect(() => {
    const gesture = Gesture.Pan()
      .onBegin(() => {
        active.value = withSpring(1, { damping: 15, stiffness: 200 });
        glowOpacity.value = withSpring(0.6, { damping: 20 });
      })
      .onUpdate((e) => {
        const dx = e.translationX;
        const dy = e.translationY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(distance, MAX_RADIUS);
        const angle = Math.atan2(dy, dx);

        translateX.value = Math.cos(angle) * clampedDist;
        translateY.value = Math.sin(angle) * clampedDist;

        runOnJS(onMoveJS)(translateX.value / MAX_RADIUS, translateY.value / MAX_RADIUS);
      })
      .onEnd(() => {
        translateX.value = withSpring(0, { damping: 15, stiffness: 180 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 180 });
        active.value = withSpring(0, { damping: 20 });
        glowOpacity.value = withSpring(0, { damping: 20 });
        runOnJS(onReleaseJS)();
      });
    queueMicrotask(() => setPan(gesture));
  }, [active, glowOpacity, translateX, translateY, onMoveJS, onReleaseJS]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onCancelNavigation?.();
  }, [onCancelNavigation]);

  const navDirection = useMemo(() => {
    if (!robotPose || !navGoal) return null;
    const dx = navGoal.x - robotPose.x;
    const dy = navGoal.y - robotPose.y;
    return Math.atan2(dy, dx);
  }, [robotPose, navGoal]);

  if (isNavigating) {
    return (
      <View style={styles.container}>
        <View style={[styles.navRing, { backgroundColor: colors.cloud + '26', borderColor: colors.signal + '40' }]}>
          {navDirection != null && (
            <View style={styles.navArrowWrap}>
              <View
                style={[
                  styles.navArrow,
                  {
                    backgroundColor: colors.signal,
                    transform: [{ rotate: `${navDirection}rad` }],
                  },
                ]}
              />
            </View>
          )}
          <Pressable
            style={[styles.cancelKnob, { backgroundColor: colors.signal }]}
            onPress={handleCancel}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={[styles.navLabel, { color: colors.textSecondary }]}>
          {distanceRemaining != null
            ? `${distanceRemaining.toFixed(1)}m`
            : 'Navigating'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glowRing, { backgroundColor: colors.horizonBlue }, glowStyle]} />
      <Animated.View style={[styles.outerRing, { backgroundColor: colors.cloud + '26', borderWidth: 1.5, borderColor: colors.border + '33' }, ringStyle]}>
        <Animated.View style={[styles.directionLine, { backgroundColor: colors.horizonBlue }, directionStyle]} />
        <View style={[styles.cardinalMark, { top: 4, backgroundColor: colors.border + '40' }]} />
        <View style={[styles.cardinalMark, { bottom: 4, backgroundColor: colors.border + '40' }]} />
        <View style={[styles.cardinalMarkH, { left: 4, backgroundColor: colors.border + '40' }]} />
        <View style={[styles.cardinalMarkH, { right: 4, backgroundColor: colors.border + '40' }]} />
        {pan && (
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.knob, { backgroundColor: colors.surface, borderColor: colors.border }, knobStyle]}>
              <View style={[styles.knobInner, { backgroundColor: colors.horizonBlue }]} />
            </Animated.View>
          </GestureDetector>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: JOYSTICK_SIZE + 24,
    height: JOYSTICK_SIZE + 24,
    borderRadius: (JOYSTICK_SIZE + 24) / 2,
    opacity: 0,
  },
  outerRing: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionLine: {
    position: 'absolute',
    width: '70%',
    height: 2,
    borderRadius: 1,
  },
  cardinalMark: {
    position: 'absolute',
    width: 1,
    height: 8,
    borderRadius: 0.5,
  },
  cardinalMarkH: {
    position: 'absolute',
    width: 8,
    height: 1,
    borderRadius: 0.5,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation[1],
  },
  knobInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  navRing: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowWrap: {
    position: 'absolute',
    width: '60%',
    height: 3,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  navArrow: {
    width: 16,
    height: 16,
    borderRadius: 8,
    opacity: 0.7,
  },
  cancelKnob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation[2],
  },
  navLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.monoMedium,
    letterSpacing: 0.3,
  },
});
