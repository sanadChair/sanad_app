import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, elevation } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';

interface MapControlsProps {
  followMode: boolean;
  fullView: boolean;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export default function MapControls({
  followMode,
  fullView,
  onRecenter,
  onZoomIn,
  onZoomOut,
}: MapControlsProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.mapControls, { bottom: 208 }]}>
      {(!followMode || fullView) && (
        <Pressable
          style={[
            styles.mapCtrlBtn,
            styles.recenterBtn,
            { backgroundColor: colors.horizonBlue, borderColor: colors.horizonBlue },
          ]}
          onPress={onRecenter}
        >
          <Ionicons name="locate" size={20} color="#FFFFFF" />
        </Pressable>
      )}
      {!fullView && (
        <View
          style={[
            styles.zoomStack,
            { backgroundColor: colors.surfaceElevated + 'E6', borderColor: colors.border },
          ]}
        >
          <Pressable style={styles.zoomBtn} onPress={onZoomIn}>
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
          <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />
          <Pressable style={styles.zoomBtn} onPress={onZoomOut}>
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapControls: {
    position: 'absolute',
    right: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
    zIndex: 18,
  },
  mapCtrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation[2],
  },
  recenterBtn: {},
  zoomStack: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...elevation[2],
  },
  zoomBtn: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
