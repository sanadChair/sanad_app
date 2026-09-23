import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, typography, fonts } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';

interface MapTopBarProps {
  isConnected: boolean;
  fullView: boolean;
  onToggleFullView: () => void;
  onOpenSettings: () => void;
  onOpenConnect: () => void;
}

export default function MapTopBar({
  isConnected,
  fullView,
  onToggleFullView,
  onOpenSettings,
  onOpenConnect,
}: MapTopBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.topBar,
        {
          paddingTop: insets.top + spacing[2],
          backgroundColor: colors.surfaceElevated + 'E6',
        },
      ]}
    >
      <Pressable style={styles.avatarBtn} onPress={onOpenSettings}>
        <View
          style={[
            styles.avatarInner,
            { backgroundColor: colors.cloud, borderColor: colors.border },
          ]}
        >
          <Ionicons name="person" size={18} color={colors.text} />
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isConnected ? 'Connection online, open connect panel' : 'Connect to chair'}
        onPress={onOpenConnect}
        style={[
          styles.statusPill,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: isConnected ? colors.meadow : colors.signal,
          },
        ]}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isConnected ? colors.meadow : colors.signal },
          ]}
        />
        <Text style={[styles.statusText, { color: colors.text }]}>
          {isConnected ? 'Online' : 'Connect'}
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.listBtn,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}
        onPress={onToggleFullView}
      >
        <Ionicons
          name={fullView ? 'contract-outline' : 'expand-outline'}
          size={20}
          color={colors.text}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    zIndex: 20,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  avatarBtn: { padding: 2 },
  avatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: {
    fontSize: typography.caption.size,
    fontFamily: fonts.monoMedium,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  listBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
