import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, typography, fonts } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';
import type { Pinpoint } from '../contexts/PinpointsContext';
import type { RobotPose } from '../services/types';

interface NearbyPinsProps {
  pins: Pinpoint[];
  robotPose: RobotPose | null;
  onNavigatePin: (pin: Pinpoint) => void;
}

export default function NearbyPins({ pins, robotPose, onNavigatePin }: NearbyPinsProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const nearby = robotPose
    ? pins.filter((p) => Math.abs(p.x - robotPose.x) < 15 && Math.abs(p.z - robotPose.y) < 15)
    : [];

  if (nearby.length === 0) return null;

  return (
    <View style={[styles.chips, { top: insets.top + 64 }]}>
      {nearby.slice(0, 4).map((p) => (
        <Pressable
          key={p.id}
          style={[
            styles.chip,
            { backgroundColor: colors.surfaceElevated + 'E6', borderColor: colors.border },
          ]}
          onPress={() => onNavigatePin(p)}
        >
          <View style={[styles.chipDot, { backgroundColor: colors.signal }]} />
          <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
            {p.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    zIndex: 15,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    maxWidth: 140,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: {
    fontSize: typography.caption.size,
    fontFamily: fonts.bodyBold,
    fontWeight: '600',
  },
});
