import { View, Text, StyleSheet, Pressable, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, typography, fonts, elevation } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';
import type { Pinpoint } from '../contexts/PinpointsContext';

interface PinModalsProps {
  showChoice: boolean;
  pendingPin: { x: number; y: number } | null;
  onDismissChoice: () => void;
  onNavigateHere: () => void;
  onOpenSave: () => void;
  showAdd: boolean;
  pinName: string;
  onChangePinName: (name: string) => void;
  isSavingPin: boolean;
  onSavePin: () => void;
  onCloseAdd: () => void;
  selectedPin: Pinpoint | null;
  onCloseDetail: () => void;
  onNavigatePin: (pin: Pinpoint) => void;
  onRemovePin: () => void;
  lastError: string | null;
  onClearError: () => void;
}

export default function PinModals({
  showChoice,
  pendingPin,
  onDismissChoice,
  onNavigateHere,
  onOpenSave,
  showAdd,
  pinName,
  onChangePinName,
  isSavingPin,
  onSavePin,
  onCloseAdd,
  selectedPin,
  onCloseDetail,
  onNavigatePin,
  onRemovePin,
  lastError,
  onClearError,
}: PinModalsProps) {
  const { colors } = useTheme();
  const sheetOpen = showAdd || !!selectedPin || showChoice;

  return (
    <>
      {/* Spot service error (background load failures; sheet errors render inline) */}
      {lastError && !sheetOpen && (
        <View
          style={[
            styles.errorToast,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.signal },
          ]}
        >
          <View style={[styles.errorDot, { backgroundColor: colors.signal }]} />
          <Text style={[styles.errorToastText, { color: colors.signal }]} numberOfLines={2}>
            {lastError}
          </Text>
          <Pressable hitSlop={8} onPress={onClearError} accessibilityLabel="Dismiss error">
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Choice sheet — compact two-action bar */}
      {showChoice && (
        <Pressable style={styles.choiceBackdrop} onPress={onDismissChoice}>
          <View
            style={[
              styles.choiceSheet,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <View style={[styles.choiceHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.choiceTitle, { color: colors.text }]}>
              {pendingPin ? `${pendingPin.x.toFixed(1)}, ${pendingPin.y.toFixed(1)}` : 'Location'}
            </Text>
            <View style={styles.choiceActions}>
              <Pressable
                style={[styles.choiceBtn, { backgroundColor: colors.horizonBlue }]}
                onPress={onNavigateHere}
              >
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
                <Text style={styles.choiceBtnLabel}>Navigate</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.choiceBtn,
                  styles.choiceBtnSecondary,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                onPress={onOpenSave}
              >
                <Ionicons name="bookmark-outline" size={18} color={colors.text} />
                <Text style={[styles.choiceBtnLabelSecondary, { color: colors.text }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      )}

      {/* Pinpoint detail sheet */}
      <Modal visible={!!selectedPin} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={onCloseDetail}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetRow}>
              <View style={[styles.sheetIcon, { backgroundColor: colors.signalFill }]}>
                <Ionicons name="location" size={20} color={colors.signal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {selectedPin?.name}
                </Text>
                <Text style={[styles.sheetCoord, { color: colors.textSecondary }]}>
                  {selectedPin?.x.toFixed(1)}, {selectedPin?.z.toFixed(1)}
                </Text>
              </View>
            </View>
            {lastError && (
              <Text style={[styles.errorInline, { color: colors.signal }]} numberOfLines={3}>
                {lastError}
              </Text>
            )}
            <View style={styles.sheetBtns}>
              <Pressable
                style={[styles.sheetPrimary, { backgroundColor: colors.horizonBlue }]}
                onPress={() => selectedPin && onNavigatePin(selectedPin)}
              >
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
                <Text style={styles.sheetPrimaryText}>Navigate</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetDanger, { backgroundColor: colors.signalFill }]}
                onPress={onRemovePin}
              >
                <Ionicons name="trash-outline" size={18} color={colors.signal} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Add pinpoint name sheet */}
      <Modal visible={showAdd} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={onCloseAdd}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Name this location</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.cloud,
                  color: colors.text,
                },
              ]}
              placeholder="Kitchen, Bedroom..."
              placeholderTextColor={colors.textSecondary}
              value={pinName}
              onChangeText={onChangePinName}
              autoFocus
            />
            {lastError && (
              <Text style={[styles.errorInline, { color: colors.signal }]} numberOfLines={3}>
                {lastError}
              </Text>
            )}
            <View style={styles.sheetBtns}>
              <Pressable
                style={[styles.sheetCancel, { backgroundColor: colors.cloud }]}
                onPress={onCloseAdd}
              >
                <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sheetPrimary,
                  { backgroundColor: colors.horizonBlue },
                  (!pinName.trim() || isSavingPin) && { opacity: 0.4 },
                ]}
                onPress={onSavePin}
                disabled={!pinName.trim() || isSavingPin}
              >
                <Text style={styles.sheetPrimaryText}>
                  {isSavingPin ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 21, 36, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    ...elevation[2],
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: typography.subtitle.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.subtitle.weight,
  },
  sheetCoord: {
    fontSize: typography.mono.size,
    fontFamily: fonts.monoMedium,
    marginTop: 2,
  },
  sheetBtns: { flexDirection: 'row', gap: spacing[3] },
  sheetPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
  },
  sheetPrimaryText: {
    fontSize: typography.label.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.label.weight,
    color: '#FFFFFF',
  },
  sheetDanger: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancel: {
    flex: 1,
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: typography.label.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.label.weight,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing[4],
    fontSize: typography.body.size,
    fontFamily: fonts.body,
    marginBottom: spacing[6],
  },
  errorInline: {
    fontSize: typography.caption.size,
    fontFamily: fonts.body,
    fontWeight: '600',
    marginTop: -spacing[4],
    marginBottom: spacing[4],
  },
  errorToast: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: 250,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    zIndex: 26,
    ...elevation[1],
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  errorToastText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.caption.size,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  choiceBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
    paddingBottom: 176,
    zIndex: 30,
  },
  choiceSheet: {
    marginHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    ...elevation[1],
  },
  choiceHandle: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    alignSelf: 'center',
    marginBottom: spacing[3],
    opacity: 0.6,
  },
  choiceTitle: {
    fontSize: typography.caption.size,
    fontFamily: fonts.monoMedium,
    fontWeight: '600',
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  choiceActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 48,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
  },
  choiceBtnSecondary: {
    borderWidth: 1,
  },
  choiceBtnLabel: {
    fontSize: typography.label.size,
    fontFamily: fonts.bodyBold,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  choiceBtnLabelSecondary: {
    fontSize: typography.label.size,
    fontFamily: fonts.bodyBold,
    fontWeight: '600',
  },
});
