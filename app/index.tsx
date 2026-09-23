import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { usePinpoints, Pinpoint } from '../contexts/PinpointsContext';
import { useMap } from '../contexts/MapContext';
import { useNavigation } from '../contexts/NavigationContext';
import MapScene from '../components/MapScene';
import MapTopBar from '../components/MapTopBar';
import MapControls from '../components/MapControls';
import NearbyPins from '../components/NearbyPins';
import NavigationStatus from '../components/NavigationStatus';
import PinModals from '../components/PinModals';
import BottomBar from '../components/BottomBar';
import type { DriveMode } from '../components/ModeIndicator';

export default function MapScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { pinpoints, addPinpoint, removePinpoint, navigateToPinpoint, lastError, clearError } =
    usePinpoints();
  const { map, robotPose, isConnected } = useMap();
  const { status, activeGoal, lastFeedback, pathHistory, navigateTo, cancelNavigation } = useNavigation();

  const [, setIsVoiceActive] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pinpoint | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinName, setPinName] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
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
        clearError();
        setSelectedPin(existing);
        return;
      }
      setPendingPin({ x: worldX, y: worldY });
      setShowChoice(true);
    },
    [pinpoints, clearError]
  );

  const handleSavePin = useCallback(async () => {
    if (!pendingPin || !pinName.trim() || isSavingPin) return;
    setIsSavingPin(true);
    try {
      const ok = await addPinpoint(pinName.trim(), pendingPin.x, pendingPin.y);
      if (ok) {
        setShowAdd(false);
        clearPending();
        setPinName('');
      }
    } finally {
      setIsSavingPin(false);
    }
  }, [pendingPin, pinName, isSavingPin, addPinpoint, clearPending]);

  const handleRemovePin = useCallback(async () => {
    if (!selectedPin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await removePinpoint(selectedPin.id);
    if (ok) setSelectedPin(null);
  }, [selectedPin, removePinpoint]);

  const handleNavigateHere = useCallback(() => {
    if (!pendingPin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    navigateTo(pendingPin.x, pendingPin.y, 'Map location');
    setFollowMode(true);
    setFullView(false);
    clearPending();
  }, [pendingPin, navigateTo, clearPending]);

  const handleOpenSave = useCallback(() => {
    clearError();
    setShowChoice(false);
    setShowAdd(true);
  }, [clearError]);

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

  const handleCloseAdd = useCallback(() => {
    setShowAdd(false);
    clearPending();
  }, [clearPending]);

  const handleCloseDetail = useCallback(() => setSelectedPin(null), []);

  const handleOpenSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

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

      <MapTopBar
        isConnected={isConnected}
        fullView={fullView}
        onToggleFullView={handleToggleFullView}
        onOpenSettings={handleOpenSettings}
      />

      <MapControls
        followMode={followMode}
        fullView={fullView}
        onRecenter={handleRecenter}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      <NearbyPins pins={pinpoints} robotPose={robotPose} onNavigatePin={handleNavigatePin} />

      <NavigationStatus />

      <PinModals
        showChoice={showChoice}
        pendingPin={pendingPin}
        onDismissChoice={clearPending}
        onNavigateHere={handleNavigateHere}
        onOpenSave={handleOpenSave}
        showAdd={showAdd}
        pinName={pinName}
        onChangePinName={setPinName}
        isSavingPin={isSavingPin}
        onSavePin={handleSavePin}
        onCloseAdd={handleCloseAdd}
        selectedPin={selectedPin}
        onCloseDetail={handleCloseDetail}
        onNavigatePin={handleNavigatePin}
        onRemovePin={handleRemovePin}
        lastError={lastError}
        onClearError={clearError}
      />

      <BottomBar
        mode={mode}
        isNavigating={isNavigating}
        robotPose={robotPose}
        activeGoal={activeGoal}
        distanceRemaining={lastFeedback?.distanceRemaining}
        onCancelNavigation={handleCancelNav}
        onRecordingChange={setIsVoiceActive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
