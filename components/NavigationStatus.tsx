import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, radius, typography, fonts, elevation } from '../constants/tokens';

const AUTO_DISMISS_MS = 2500;

export default function NavigationStatus() {
  const { status, activeGoal, lastFeedback, lastError, cancelNavigation } = useNavigation();
  const { colors } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const visible = useSharedValue(0);
  const dismissedRef = useRef(false);
  const statusRef = useRef(status);

  useEffect(() => {
    if (statusRef.current !== status) {
      statusRef.current = status;
      dismissedRef.current = false;
      setDismissed(false);
    }
    if (status !== 'succeeded' && status !== 'failed') return;
    const t = setTimeout(() => {
      dismissedRef.current = true;
      setDismissed(true);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [status]);

  const show =
    status !== 'idle' && status !== 'canceled' && !dismissed;

  useEffect(() => {
    visible.value = withSpring(show ? 1 : 0, { damping: 16 });
  }, [show, visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: interpolate(visible.value, [0, 1], [12, 0]) }],
    pointerEvents: visible.value > 0.5 ? 'auto' : 'none',
  }));

  if (!show) return null;

  const statusText = {
    goal_sent: 'Destination set',
    navigating: 'Navigating',
    succeeded: 'Arrived',
    failed: 'Navigation failed',
  }[status];

  const statusColor = {
    goal_sent: colors.amber,
    navigating: colors.horizonBlue,
    succeeded: colors.meadow,
    failed: colors.signal,
  }[status];

  const isRunning = status === 'goal_sent' || status === 'navigating';
  const distanceText =
    lastFeedback?.distanceRemaining != null
      ? `${lastFeedback.distanceRemaining.toFixed(1)}m`
      : null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isRunning) cancelNavigation();
    else setDismissed(true);
  };

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents={show ? 'auto' : 'none'}>
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={[styles.status, { color: colors.text }]} numberOfLines={1}>
          {statusText}
        </Text>
        {activeGoal?.label && isRunning && (
          <Text style={[styles.goal, { color: colors.textSecondary }]} numberOfLines={1}>
            {activeGoal.label}
          </Text>
        )}
        {distanceText && isRunning && (
          <Text style={[styles.distance, { color: colors.textSecondary }]}>{distanceText}</Text>
        )}
        {status === 'failed' && lastError && (
          <Text style={[styles.error, { color: colors.signal }]} numberOfLines={1}>
            {lastError}
          </Text>
        )}
        <Pressable
          hitSlop={8}
          style={styles.closeBtn}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={isRunning ? 'Cancel navigation' : 'Dismiss'}
        >
          <Ionicons
            name={isRunning ? 'close-circle' : 'close'}
            size={20}
            color={isRunning ? colors.signal : colors.textSecondary}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 188,
    left: spacing[4],
    right: spacing[4],
    zIndex: 25,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    ...elevation[1],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  status: {
    fontSize: typography.caption.size,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    flexShrink: 0,
  },
  goal: {
    fontSize: typography.caption.size,
    fontFamily: fonts.body,
    flex: 1,
    minWidth: 0,
  },
  distance: {
    fontSize: typography.caption.size,
    fontFamily: fonts.monoMedium,
    flexShrink: 0,
  },
  error: {
    fontSize: typography.caption.size,
    fontFamily: fonts.body,
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 2,
    flexShrink: 0,
  },
});
