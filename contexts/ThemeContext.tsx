import React, { createContext, useContext, useState, useMemo } from 'react';

export type ThemeMode = 'light' | 'dark' | 'high-contrast';

export interface ThemeColors {
  horizonBlue: string;
  liftCyan: string;
  daylight: string;
  cloud: string;
  mist: string;
  ink: string;
  inkSoft: string;
  meadow: string;
  amber: string;
  signal: string;
  horizonBlueFill: string;
  liftCyanFill: string;
  signalFill: string;
  amberFill: string;
  meadowFill: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textSecondary: string;
  statusBar: 'light' | 'dark';
  /** Map / 3D scene palette */
  mapBg: string;
  mapGround: string;
  mapUnknown: string;
  mapFree: string;
  mapOccupied: string;
  mapWall: string;
  mapWallEmissive: string;
  mapGrid: string;
  mapGridMinor: string;
  mapFrame: string;
  mapPath: string;
}

const THEMES: Record<ThemeMode, ThemeColors> = {
  light: {
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
  },
  dark: {
    horizonBlue: '#4D7AFF',
    liftCyan: '#00E0FF',
    daylight: '#1A2332',
    cloud: '#1E2A3A',
    mist: '#2A3A50',
    ink: '#E8ECF2',
    inkSoft: '#9AADC4',
    meadow: '#4CAF6E',
    amber: '#D4952A',
    signal: '#E05545',
    horizonBlueFill: 'rgba(77, 122, 255, 0.15)',
    liftCyanFill: 'rgba(0, 224, 255, 0.12)',
    signalFill: 'rgba(224, 85, 69, 0.15)',
    amberFill: 'rgba(212, 149, 42, 0.12)',
    meadowFill: 'rgba(76, 175, 110, 0.12)',
    surface: '#0F1923',
    surfaceElevated: '#1A2A3A',
    border: '#2A3A50',
    text: '#E8ECF2',
    textSecondary: '#9AADC4',
    statusBar: 'light',
    mapBg: '#0B1524',
    mapGround: '#0D1626',
    mapUnknown: '#0B1321',
    mapFree: '#1B2A42',
    mapOccupied: '#96AACE',
    mapWall: '#DFE8F7',
    mapWallEmissive: '#2A3D5C',
    mapGrid: '#27436E',
    mapGridMinor: '#1A2C4A',
    mapFrame: '#4D7AFF',
    mapPath: '#00E0FF',
  },
  'high-contrast': {
    horizonBlue: '#5B8FFF',
    liftCyan: '#00FFFF',
    daylight: '#000000',
    cloud: '#1A1A1A',
    mist: '#333333',
    ink: '#FFFFFF',
    inkSoft: '#CCCCCC',
    meadow: '#00CC66',
    amber: '#FFB800',
    signal: '#FF4444',
    horizonBlueFill: 'rgba(91, 143, 255, 0.25)',
    liftCyanFill: 'rgba(0, 255, 255, 0.20)',
    signalFill: 'rgba(255, 68, 68, 0.20)',
    amberFill: 'rgba(255, 184, 0, 0.18)',
    meadowFill: 'rgba(0, 204, 102, 0.18)',
    surface: '#000000',
    surfaceElevated: '#1A1A1A',
    border: '#444444',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    statusBar: 'light',
    mapBg: '#000000',
    mapGround: '#0A0A0A',
    mapUnknown: '#111111',
    mapFree: '#1A1A1A',
    mapOccupied: '#EEEEEE',
    mapWall: '#FFFFFF',
    mapWallEmissive: '#666666',
    mapGrid: '#666666',
    mapGridMinor: '#333333',
    mapFrame: '#5B8FFF',
    mapPath: '#00FFFF',
  },
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: THEMES.light,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const colors = useMemo(() => THEMES[mode], [mode]);

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
