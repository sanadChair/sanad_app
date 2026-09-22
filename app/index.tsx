import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, radius, typography, fonts, elevation } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';
import { usePinpoints, Pinpoint } from '../contexts/PinpointsContext';
import { useMap } from '../contexts/MapContext';
import { useNavigation } from '../contexts/NavigationContext';
import MapScene from '../components/MapScene';
import Joystick from '../components/Joystick';
import ModeIndicator, { DriveMode } from '../components/ModeIndicator';
import VoiceButton from '../components/VoiceButton';
import NavigationStatus from '../components/NavigationStatus';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { pinpoints, addPinpoint, removePinpoint, navigateToPinpoint } = usePinpoints();
  const { map, robotPose, isConnected } = useMap();
  const { status, activeGoal, lastFeedback, pathHistory, navigateTo, cancelNavigation } = useNavigation();

  const [, setIsVoiceActive] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pinpoint | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinName, setPinName] = useState('');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [fullView, setFullView] = useState(false);
  // Follow mode: camera locked + smoothed on the chair. Any manual drag
  // drops into free-explore; the locate button snaps back.
  const [followMode, setFollowMode] = useState(true);
  const [zoom, setZoom] = useState(1);

  const isNavigating = status === 'goal_sent' || status === 'navigating';

  // Derived from Nav2 only: autonomous while a goal is active, manual otherwise.
  const mode: DriveMode = isNavigating ? 'autonomous' : 'manual';

  const clearPending = useCallback(() => {
    setPendingPin(null);
    setShowChoice(false);
  }, []);

  const handleTapMap = useCallback(
    (worldX: number, worldY: number) => {
      const existing = pinpoints.find(
        (p) => Math.abs(p.x - worldX) < 1.5 && Math.abs(p.z - worldY) < 1.5
      );
      if (existing) {
        setSelectedPin(existing);
        return;
      }
      setPendingPin({ x: worldX, y: worldY });
      setShowChoice(true);
    },
    [pinpoints]
  );

  const handleSavePin = useCallback(() => {
    if (!pendingPin || !pinName.trim()) return;
    addPinpoint(pinName.trim(), pendingPin.x, pendingPin.y);
    setShowAdd(false);
    clearPending();
    setPinName('');
  }, [pendingPin, pinName, addPinpoint, clearPending]);

  const handleNavigateHere = useCallback(() => {
    if (!pendingPin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    navigateTo(pendingPin.x, pendingPin.y, 'Map location');
    setFollowMode(true);
    setFullView(false);
    clearPending();
  }, [pendingPin, navigateTo, clearPending]);

  const handleOpenSave = useCallback(() => {
    setShowChoice(false);
    setShowAdd(true);
  }, []);

  const handleNavigatePin = useCallback(
    (p: Pinpoint) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      navigateToPinpoint(p);
      setFollowMode(true);
      setFullView(false);
      setSelectedPin(null);
    },
    [navigateToPinpoint]
  );

  const handleCancelNav = useCallback(() => {
    cancelNavigation();
  }, [cancelNavigation]);

  const handleManualPan = useCallback(() => {
    setFollowMode(false);
  }, []);

  const handleRecenter = useCallback(() => {
    Haptics.selectionAsync();
    setFollowMode(true);
    setFullView(false);
    setZoom(1);
    setResetTrigger((t) => t + 1);
  }, []);

  const handleToggleFullView = useCallback(() => {
    Haptics.selectionAsync();
    setFullView((v) => {
      if (v) {
        // coming back from zoomed-out -> lock back onto the chair
        setFollowMode(true);
        setZoom(1);
        setResetTrigger((t) => t + 1);
      }
      return !v;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    Haptics.selectionAsync();
    setFullView(false);
    setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    Haptics.selectionAsync();
    setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  }, []);

  const nearbyPins = robotPose
    ? pinpoints.filter(
        (p) => Math.abs(p.x - robotPose.x) < 15 && Math.abs(p.z - robotPose.y) < 15
      )
    : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <MapScene
        robotPose={robotPose}
        mapData={map}
        onTapMap={handleTapMap}
        resetTrigger={resetTrigger}
        pendingPin={pendingPin}
        fullView={fullView}
        followMode={followMode}
        onManualPan={handleManualPan}
        zoom={zoom}
        onZoomChange={setZoom}
        activeGoal={activeGoal}
        pathHistory={pathHistory}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing[2], backgroundColor: colors.surfaceElevated + 'E6' }]}>
        <Pressable style={styles.avatarBtn} onPress={() => router.push('/settings')}>
          <View style={[styles.avatarInner, { backgroundColor: colors.cloud, borderColor: colors.border }]}>
            <Ionicons name="person" size={18} color={colors.text} />
          </View>
        </Pressable>

        <View style={[styles.statusPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.meadow : colors.signal }]} />
          <Text style={[styles.statusText, { color: colors.text }]}>{isConnected ? 'Online' : 'Offline'}</Text>
        </View>

        <Pressable
          style={[styles.listBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={handleToggleFullView}
        >
          <Ionicons name={fullView ? 'contract-outline' : 'expand-outline'} size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Map controls: recenter + zoom stepper */}
      <View style={[styles.mapControls, { bottom: 208 }]}>
        {(!followMode || fullView) && (
          <Pressable
            style={[styles.mapCtrlBtn, styles.recenterBtn, { backgroundColor: colors.horizonBlue, borderColor: colors.horizonBlue }]}
            onPress={handleRecenter}
          >
            <Ionicons name="locate" size={20} color="#FFFFFF" />
          </Pressable>
        )}
        {!fullView && (
          <View style={[styles.zoomStack, { backgroundColor: colors.surfaceElevated + 'E6', borderColor: colors.border }]}>
            <Pressable style={styles.zoomBtn} onPress={handleZoomIn}>
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
            <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.zoomBtn} onPress={handleZoomOut}>
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Nearby pinpoint chips */}
      {nearbyPins.length > 0 && (
        <View style={[styles.chips, { top: insets.top + 64 }]}>
          {nearbyPins.slice(0, 4).map((p) => (
            <Pressable
              key={p.id}
              style={[styles.chip, { backgroundColor: colors.surfaceElevated + 'E6', borderColor: colors.border }]}
              onPress={() => handleNavigatePin(p)}
            >
              <View style={[styles.chipDot, { backgroundColor: colors.signal }]} />
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <NavigationStatus />

      {/* Choice sheet — compact two-action bar */}
      {showChoice && (
        <Pressable style={styles.choiceBackdrop} onPress={clearPending}>
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
                onPress={handleNavigateHere}
              >
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
                <Text style={styles.choiceBtnLabel}>Navigate</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, styles.choiceBtnSecondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={handleOpenSave}
              >
                <Ionicons name="bookmark-outline" size={18} color={colors.text} />
                <Text style={[styles.choiceBtnLabelSecondary, { color: colors.text }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing[3] }]}>
        <View style={styles.joystickWrap}>
          <Joystick
            isNavigating={isNavigating}
            robotPose={robotPose}
            navGoal={activeGoal}
            distanceRemaining={lastFeedback?.distanceRemaining}
            onCancelNavigation={handleCancelNav}
          />
        </View>

        <View style={styles.centerControls}>
          <ModeIndicator mode={mode} onCancelNavigation={handleCancelNav} />
        </View>

        <View style={styles.voiceWrap}>
          <VoiceButton onRecordingChange={setIsVoiceActive} />
        </View>
      </View>

      {/* Pinpoint detail sheet */}
      <Modal visible={!!selectedPin} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setSelectedPin(null)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetRow}>
              <View style={[styles.sheetIcon, { backgroundColor: colors.signalFill }]}>
                <Ionicons name="location" size={20} color={colors.signal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{selectedPin?.name}</Text>
                <Text style={[styles.sheetCoord, { color: colors.textSecondary }]}>
                  {selectedPin?.x.toFixed(1)}, {selectedPin?.z.toFixed(1)}
                </Text>
              </View>
            </View>
            <View style={styles.sheetBtns}>
              <Pressable
                style={[styles.sheetPrimary, { backgroundColor: colors.horizonBlue }]}
                onPress={() => selectedPin && handleNavigatePin(selectedPin)}
              >
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
                <Text style={styles.sheetPrimaryText}>Navigate</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetDanger, { backgroundColor: colors.signalFill }]}
                onPress={() => {
                  if (selectedPin) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    removePinpoint(selectedPin.id);
                    setSelectedPin(null);
                  }
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.signal} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Add pinpoint name sheet */}
      <Modal visible={showAdd} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => { setShowAdd(false); clearPending(); }}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Name this location</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.cloud, color: colors.text }]}
              placeholder="Kitchen, Bedroom..."
              placeholderTextColor={colors.textSecondary}
              value={pinName}
              onChangeText={setPinName}
              autoFocus
            />
            <View style={styles.sheetBtns}>
              <Pressable style={[styles.sheetCancel, { backgroundColor: colors.cloud }]} onPress={() => { setShowAdd(false); clearPending(); }}>
                <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetPrimary, { backgroundColor: colors.horizonBlue }, !pinName.trim() && { opacity: 0.4 }]}
                onPress={handleSavePin}
                disabled={!pinName.trim()}
              >
                <Text style={styles.sheetPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
