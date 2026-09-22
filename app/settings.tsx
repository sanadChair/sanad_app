import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, radius, typography, fonts } from '../constants/tokens';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';

const THEMES: { id: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
  { id: 'high-contrast', label: 'High Contrast', icon: 'contrast-outline' },
];

function ThemeRow({
  theme,
  isActive,
  onSelect,
  isLast,
  colors,
}: {
  theme: typeof THEMES[number];
  isActive: boolean;
  onSelect: () => void;
  isLast: boolean;
  colors: any;
}) {
  return (
    <View style={!isLast ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : undefined}>
      <Pressable style={styles.row} onPress={onSelect}>
        <View style={[styles.rowIcon, { backgroundColor: isActive ? colors.horizonBlueFill : colors.cloud }]}>
          <Ionicons name={theme.icon} size={20} color={isActive ? colors.horizonBlue : colors.textSecondary} />
        </View>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{theme.label}</Text>
        {isActive && <Ionicons name="checkmark-circle" size={20} color={colors.horizonBlue} />}
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, colors, setMode } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: colors.cloud }]}
          onPress={() => {
            Haptics.selectionAsync();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.horizonBlue} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.cloud }]}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.border }]}>
            <Ionicons name="person" size={28} color={colors.textSecondary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>Sanad User</Text>
            <Text style={[styles.profileModel, { color: colors.textSecondary }]}>Chair Model S1</Text>
          </View>
          <View style={[styles.profileBadge, { backgroundColor: colors.horizonBlueFill }]}>
            <Text style={[styles.profileBadgeText, { color: colors.horizonBlue }]}>S1</Text>
          </View>
        </View>

        {/* Theme section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DISPLAY</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.cloud }]}>
            {THEMES.map((t, i) => (
              <ThemeRow
                key={t.id}
                theme={t}
                isActive={mode === t.id}
                onSelect={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMode(t.id);
                }}
                isLast={i === THEMES.length - 1}
                colors={colors}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Sanad v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.title.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.title.weight,
  },
  content: {
    padding: spacing[4],
    paddingTop: spacing[1],
    paddingBottom: 48,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.subtitle.size,
    fontFamily: fonts.bodyBold,
    fontWeight: typography.subtitle.weight,
  },
  profileModel: {
    fontSize: typography.caption.size,
    fontFamily: fonts.monoMedium,
    marginTop: 2,
  },
  profileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  profileBadgeText: {
    fontSize: typography.caption.size,
    fontFamily: fonts.monoMedium,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: typography.caption.size,
    fontFamily: fonts.bodyBold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    paddingLeft: spacing[1],
  },
  sectionCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: 48,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.body.size,
    fontFamily: fonts.body,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  footerText: {
    fontSize: typography.caption.size,
    fontFamily: fonts.monoMedium,
  },
});
