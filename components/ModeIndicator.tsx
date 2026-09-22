import { StyleSheet, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, elevation, fonts, typography } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';

export type DriveMode = 'manual' | 'autonomous';

interface ModeIndicatorProps {
  mode: DriveMode;
  /** Present only in autonomous mode — tap returns to manual. */
  onCancelNavigation?: () => void;
}

export default function ModeIndicator({ mode, onCancelNavigation }: ModeIndicatorProps) {
  const { colors } = useTheme();
  const autonomous = mode === 'autonomous';
  const label = autonomous ? 'Autonomous' : 'Manual';
  const icon = autonomous ? 'navigate' : 'hand-left';

  const handlePress = () => {
    if (!autonomous || !onCancelNavigation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancelNavigation();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={!autonomous || !onCancelNavigation}
      accessibilityRole={autonomous && onCancelNavigation ? 'button' : 'text'}
      accessibilityLabel={
        autonomous
          ? 'Autonomous navigation active. Tap to cancel and return to manual.'
          : 'Manual drive mode'
      }
      style={({ pressed }) => [
        styles.badge,
        {
          backgroundColor: autonomous
            ? colors.horizonBlue
            : colors.surfaceElevated,
          borderColor: autonomous ? colors.horizonBlue : colors.border,
          opacity: pressed && autonomous ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={autonomous ? '#FFFFFF' : colors.textSecondary}
      />
      <Text
        style={[
          styles.label,
          { color: autonomous ? '#FFFFFF' : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {autonomous && onCancelNavigation && (
        <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.85)" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    ...elevation[1],
  },
  label: {
    fontSize: typography.caption.size,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
});
