import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import MapService from '../services/MapService';
import type { NavigationState, GoalPoint, NavigationFeedback, NavigationStatus, PathPoint } from '../services/types';

interface NavigationContextValue {
  status: NavigationStatus;
  activeGoal: GoalPoint | null;
  lastFeedback: NavigationFeedback | null;
  pathHistory: PathPoint[];
  lastError: string | null;
  navigateTo: (x: number, y: number, label?: string) => void;
  cancelNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  status: 'idle',
  activeGoal: null,
  lastFeedback: null,
  pathHistory: [],
  lastError: null,
  navigateTo: () => {},
  cancelNavigation: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [navState, setNavState] = useState<NavigationState>({
    status: 'idle',
    activeGoal: null,
    lastFeedback: null,
    pathHistory: [],
    lastError: null,
  });
  const mapServiceRef = useRef<MapService | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // rosHandler.connected is a plain getter, not React state — never use it
    // as a useEffect dependency or navigateTo stays a silent no-op after connect.
    const mapService = MapService.getInstance();
    mapServiceRef.current = mapService;
    unsubRef.current = mapService.onNavigationUpdate(setNavState);

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      mapServiceRef.current = null;
    };
  }, []);

  const navigateTo = useCallback((x: number, y: number, label?: string) => {
    if (!mapServiceRef.current) {
      mapServiceRef.current = MapService.getInstance();
    }
    mapServiceRef.current.setGoal(x, y, label);
  }, []);

  const cancelNavigation = useCallback(() => {
    if (!mapServiceRef.current) {
      mapServiceRef.current = MapService.getInstance();
    }
    mapServiceRef.current.cancelGoal();
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        status: navState.status,
        activeGoal: navState.activeGoal,
        lastFeedback: navState.lastFeedback,
        pathHistory: navState.pathHistory,
        lastError: navState.lastError,
        navigateTo,
        cancelNavigation,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export const useNavigation = () => useContext(NavigationContext);
