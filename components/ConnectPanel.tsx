import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, radius, typography, fonts, elevation } from '../constants/tokens';
import { useTheme } from '../contexts/ThemeContext';
import rosHandler from '../services/ros';
import {
  scanForRosbridge,
  normalizeWsUrl,
  type ScanProgress,
} from '../services/discovery';

interface ConnectPanelProps {
  visible: boolean;
  onClose: () => void;
  isConnected: boolean;
}

type PanelMode = 'idle' | 'scanning' | 'connecting';

export default function ConnectPanel({ visible, onClose, isConnected }: ConnectPanelProps) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<PanelMode>('idle');
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [currentUrl, setCurrentUrl] = useState(() => rosHandler.getUrl());
  const abortRef = useRef({ aborted: false });
  const connectWatchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetPanel = useCallback(() => {
    abortRef.current = { aborted: false };
    if (connectWatchRef.current) clearTimeout(connectWatchRef.current);
    setCurrentUrl(rosHandler.getUrl());
    setManual('');
    setError(null);
    setStatus(null);
    setProgress(null);
    setMode('idle');
  }, []);

  const stopWork = useCallback(() => {
    abortRef.current.aborted = true;
    if (connectWatchRef.current) clearTimeout(connectWatchRef.current);
  }, []);

  const handleClose = useCallback(() => {
    stopWork();
    onClose();
  }, [onClose, stopWork]);

  useEffect(() => stopWork, [stopWork]);

  const watchConnection = useCallback((ms = 4000) => {
    if (connectWatchRef.current) clearTimeout(connectWatchRef.current);
    const started = Date.now();
    const tick = () => {
      setCurrentUrl(rosHandler.getUrl());
      if (rosHandler.connected) {
        setMode('idle');
        setStatus('Connected');
        setError(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      if (Date.now() - started > ms) {
        setMode('idle');
        setError('No response from that address. Check the chair is on this Wi‑Fi.');
        return;
      }
      connectWatchRef.current = setTimeout(tick, 250);
    };
    tick();
  }, []);

  const handleAutoScan = useCallback(async () => {
    if (mode !== 'idle') return;
    setError(null);
    setStatus(null);
    setMode('scanning');
    setProgress({ done: 0, total: 0, found: [] });
    abortRef.current = { aborted: false };
    try {
      const found = await scanForRosbridge(9090, setProgress, abortRef.current);
      if (abortRef.current.aborted) return;
      if (found.length === 0) {
        setMode('idle');
        setError('No rosbridge found on this network. Try Enter IP.');
        return;
      }
      setStatus(`Found ${found[0]} — connecting…`);
      setMode('connecting');
      rosHandler.setUrl(found[0]);
      setCurrentUrl(rosHandler.getUrl());
      watchConnection();
    } catch (e) {
      setMode('idle');
      setError(e instanceof Error ? e.message : 'Scan failed.');
    }
  }, [mode, watchConnection]);

  const handleManualConnect = useCallback(() => {
    if (mode !== 'idle') return;
    const url = normalizeWsUrl(manual);
    if (!url) {
      setError('Enter an IP like 192.168.1.20 (port 9090 is assumed).');
      return;
    }
    setError(null);
    setStatus(null);
    setMode('connecting');
    try {
      rosHandler.setUrl(url);
      setCurrentUrl(rosHandler.getUrl());
      watchConnection();
    } catch (e) {
      setMode('idle');
      setError(e instanceof Error ? e.message : 'Invalid address.');
    }
  }, [manual, mode, watchConnection]);

  const busy = mode !== 'idle';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      onShow={resetPanel}
      onDismiss={stopWork}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!busy) handleClose();
        }}
      >
        <View
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: isConnected ? colors.meadowFill : colors.signalFill },
              ]}
            >
              <Ionicons
                name="wifi"
                size={18}
                color={isConnected ? colors.meadow : colors.signal}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Connect to chair</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                {currentUrl}
                {isConnected ? ' · Online' : ' · Offline'}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={handleClose} disabled={busy} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Pressable
            style={[
              styles.primaryBtn,
              { backgroundColor: colors.horizonBlue },
              busy && styles.disabled,
            ]}
            onPress={handleAutoScan}
            disabled={busy}
          >
            {mode === 'scanning' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.primaryLabel}>
              {mode === 'scanning'
                ? progress && progress.total > 0
                  ? `Scanning ${progress.done}/${progress.total}…`
                  : 'Scanning…'
                : mode === 'connecting'
                  ? 'Connecting…'
                  : 'Auto scan network'}
            </Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.textSecondary }]}>or enter IP</Text>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.manualRow}>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.cloud,
                  color: colors.text,
                },
              ]}
              placeholder="192.168.1.20"
              placeholderTextColor={colors.textSecondary}
              value={manual}
              onChangeText={setManual}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!busy}
              onSubmitEditing={handleManualConnect}
            />
            <Pressable
              style={[
                styles.connectBtn,
                { backgroundColor: colors.horizonBlue },
                busy && styles.disabled,
              ]}
              onPress={handleManualConnect}
              disabled={busy}
            >
              <Text style={styles.connectLabel}>Connect</Text>
            </Pressable>
          </View>

          {status && (
            <Text style={[styles.status, { color: colors.meadow }]} numberOfLines={2}>
              {status}
            </Text>
          )}
          {error && (
            <Text style={[styles.error, { color: colors.signal }]} numberOfLines={3}>
              {error}
            </Text>
          )}

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Phone and chair must share the same Wi‑Fi. Port 9090 (rosbridge).
          </Text>
        </View>
      </Pressable>
    </Modal>
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
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation[2],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.subtitle.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.subtitle.weight,
  },
  sub: {
    fontSize: typography.mono.size - 3,
    fontFamily: fonts.monoMedium,
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 48,
    borderRadius: radius.md,
    marginBottom: spacing[3],
  },
  primaryLabel: {
    fontSize: typography.label.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.label.weight,
    color: '#FFFFFF',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orText: {
    fontSize: typography.caption.size,
    fontFamily: fonts.body,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.body.size - 2,
    fontFamily: fonts.monoMedium,
  },
  connectBtn: {
    paddingHorizontal: spacing[4],
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectLabel: {
    fontSize: typography.label.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.label.weight,
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.55,
  },
  status: {
    fontSize: typography.caption.size,
    fontFamily: fonts.body,
    marginBottom: spacing[2],
  },
  error: {
    fontSize: typography.caption.size,
    fontFamily: fonts.body,
    marginBottom: spacing[2],
  },
  hint: {
    fontSize: typography.caption.size - 1,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
});
