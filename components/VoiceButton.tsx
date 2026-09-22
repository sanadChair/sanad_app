import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { elevation } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';
import VoiceService from '../services/VoiceService';

const BUTTON_SIZE = 56;

interface VoiceButtonProps {
  onRecordingChange?: (isRecording: boolean) => void;
}

export default function VoiceButton({ onRecordingChange }: VoiceButtonProps) {
  const { colors } = useTheme();
  const recording = useSharedValue(0);
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);
  const [recordingOn, setRecordingOn] = useState(false);
  const isRecordingRef = useRef(false);
  const voiceServiceRef = useRef<VoiceService | null>(null);

  useEffect(() => {
    recording.value = withSpring(recordingOn ? 1 : 0, { damping: 15 });
    if (recordingOn) {
      wave1.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      wave2.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      wave3.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(wave1);
      cancelAnimation(wave2);
      cancelAnimation(wave3);
      wave1.value = withSpring(0);
      wave2.value = withSpring(0);
      wave3.value = withSpring(0);
    }
    return () => {
      cancelAnimation(wave1);
      cancelAnimation(wave2);
      cancelAnimation(wave3);
    };
  }, [recordingOn, recording, wave1, wave2, wave3]);

  const startListening = useCallback(() => {
    if (!voiceServiceRef.current) {
      voiceServiceRef.current = VoiceService.getInstance();
    }
    voiceServiceRef.current.publishCommand('start_listening');
  }, []);

  const stopListening = useCallback(() => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.publishCommand('stop_listening');
    }
  }, []);

  const toggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isStarting = recording.value === 0;
    isRecordingRef.current = isStarting;
    onRecordingChange?.(isStarting);
    setRecordingOn(isStarting);

    if (isStarting) {
      startListening();
    } else {
      stopListening();
    }
  }, [recording, startListening, stopListening, onRecordingChange]);

  const btnStyle = useAnimatedStyle(() => {
    const isOn = recording.value > 0.5;
    return {
      backgroundColor: isOn ? colors.signal : colors.surface,
      transform: [{ scale: interpolate(recording.value, [0, 1], [1, 1.08]) }],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const isOn = recording.value > 0.5;
    return {
      borderColor: isOn ? colors.signal : colors.border,
      transform: [{ scale: interpolate(recording.value, [0, 1], [1, 1.2]) }],
    };
  });

  const wave1Style = useAnimatedStyle(() => ({
    opacity: interpolate(wave1.value, [0, 0.5, 1], [0, 0.4, 0]),
    transform: [{ scale: interpolate(wave1.value, [0, 1], [0.8, 1.6]) }],
  }));

  const wave2Style = useAnimatedStyle(() => ({
    opacity: interpolate(wave2.value, [0, 0.5, 1], [0, 0.3, 0]),
    transform: [{ scale: interpolate(wave2.value, [0, 1], [0.8, 1.8]) }],
  }));

  const wave3Style = useAnimatedStyle(() => ({
    opacity: interpolate(wave3.value, [0, 0.5, 1], [0, 0.2, 0]),
    transform: [{ scale: interpolate(wave3.value, [0, 1], [0.8, 2.0]) }],
  }));

  return (
    <Pressable style={styles.wrapper} onPress={toggle}>
      <Animated.View style={[styles.wave, { borderColor: colors.signal }, wave1Style]} />
      <Animated.View style={[styles.wave, { borderColor: colors.signal }, wave2Style]} />
      <Animated.View style={[styles.wave, { borderColor: colors.signal }, wave3Style]} />
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.button, btnStyle]}>
        <Ionicons name="mic" size={22} color={colors.text} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: BUTTON_SIZE + 16,
    height: BUTTON_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    position: 'absolute',
    width: BUTTON_SIZE + 20,
    height: BUTTON_SIZE + 20,
    borderRadius: (BUTTON_SIZE + 20) / 2,
    borderWidth: 2,
  },
  ring: {
    position: 'absolute',
    width: BUTTON_SIZE + 8,
    height: BUTTON_SIZE + 8,
    borderRadius: (BUTTON_SIZE + 8) / 2,
    borderWidth: 1.5,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation[1],
  },
});
