// Default light theme colors (used as fallback by components not using ThemeContext)
export const colors = {
  horizonBlue: '#1D3FE0',
  liftCyan: '#00E0FF',
  daylight: '#FFFFFF',
  cloud: '#F5F7FA',
  mist: '#E4E9F0',
  ink: '#0B1524',
  inkSoft: '#46536B',
  meadow: '#2E7D4F',
  amber: '#B8720E',
  signal: '#B23A2A',
  horizonBlueFill: 'rgba(29, 63, 224, 0.10)',
  liftCyanFill: 'rgba(0, 224, 255, 0.12)',
  signalFill: 'rgba(178, 58, 42, 0.10)',
  amberFill: 'rgba(184, 114, 14, 0.10)',
  meadowFill: 'rgba(46, 125, 79, 0.10)',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F7FA',
  border: '#E4E9F0',
  text: '#0B1524',
  textSecondary: '#46536B',
  statusBar: 'dark',
  mapBg: '#F4F6F9',
  mapGround: '#EEF1F6',
  mapUnknown: '#D9DEE7',
  mapFree: '#FFFFFF',
  mapOccupied: '#5A6A80',
  mapWall: '#C5CDD9',
  mapWallEmissive: '#8A96A8',
  mapGrid: '#C8D0DC',
  mapGridMinor: '#DDE3EB',
  mapFrame: '#1D3FE0',
  mapPath: '#1D3FE0',
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
} as const;

export const typography = {
  display: { size: 30, lineHeight: 38, weight: '800' as const },
  title: { size: 22, lineHeight: 28, weight: '700' as const },
  subtitle: { size: 18, lineHeight: 24, weight: '600' as const },
  body: { size: 17, lineHeight: 26, weight: '500' as const },
  label: { size: 15, lineHeight: 20, weight: '600' as const },
  caption: { size: 13, lineHeight: 18, weight: '500' as const },
  mono: { size: 16, lineHeight: 24, weight: '500' as const },
} as const;

export const fonts = {
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const elevation = {
  0: 'none',
  1: { boxShadow: '0px 2px 8px rgba(11, 21, 36, 0.08)', elevation: 3 },
  2: { boxShadow: '0px 8px 24px rgba(11, 21, 36, 0.14)', elevation: 8 },
} as const;
