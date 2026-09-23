import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import MapService from '../services/MapService';
import SpotsService, { mapServiceError } from '../services/SpotsService';
import rosHandler from '../services/ros';
import type { Spot } from '../services/types';

export interface Pinpoint {
  id: string;
  name: string;
  x: number;
  z: number;
}

interface PinpointsContextValue {
  pinpoints: Pinpoint[];
  isLoading: boolean;
  lastError: string | null;
  clearError: () => void;
  addPinpoint: (name: string, x: number, z: number) => Promise<boolean>;
  removePinpoint: (id: string) => Promise<boolean>;
  navigateToPinpoint: (pin: Pinpoint) => void;
}

/** ROS Spot → Pinpoint. Title is the ROS key, so id === name === title. */
export function spotToPinpoint(spot: Spot): Pinpoint {
  return { id: spot.title, name: spot.title, x: spot.pose_x, z: spot.pose_y };
}

const PinpointsContext = createContext<PinpointsContextValue>({
  pinpoints: [],
  isLoading: false,
  lastError: null,
  clearError: () => {},
  addPinpoint: async () => false,
  removePinpoint: async () => false,
  navigateToPinpoint: () => {},
});

export function PinpointsProvider({ children }: { children: React.ReactNode }) {
  const [pinpoints, setPinpoints] = useState<Pinpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const mapServiceRef = useRef<MapService | null>(null);
  const refreshSeqRef = useRef(0);

  const getMapService = useCallback(() => {
    if (!mapServiceRef.current) {
      mapServiceRef.current = MapService.getInstance();
    }
    return mapServiceRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    setIsLoading(true);
    try {
      const spots = await SpotsService.getInstance().getAll();
      if (seq !== refreshSeqRef.current) return;
      setPinpoints(spots.map(spotToPinpoint));
      setLastError(null);
    } catch (error) {
      if (seq !== refreshSeqRef.current) return;
      const message = mapServiceError(error);
      console.error('[Pinpoints] Failed to load spots:', message);
      setLastError(message);
    } finally {
      if (seq === refreshSeqRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer past the connection event so every service's onConnection
    // rebind (Map/Spots/Voice/Wheelchair) runs before getAll().
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = rosHandler.onConnection(() => {
      timer = setTimeout(() => refresh(), 0);
    });
    if (rosHandler.connected) {
      timer = setTimeout(() => refresh(), 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  const clearError = useCallback(() => setLastError(null), []);

  const addPinpoint = useCallback(
    async (name: string, x: number, z: number): Promise<boolean> => {
      setLastError(null);
      try {
        // screenToWorld → (x, rosY); Pinpoint.z stores rosY = Spot.pose_y.
        await SpotsService.getInstance().add({
          title: name,
          pose_x: x,
          pose_y: z,
          pose_z: 0,
          pose_theta: 0,
        });
        await refresh();
        return true;
      } catch (error) {
        const message = mapServiceError(error);
        console.error('[Pinpoints] Failed to add spot:', message);
        setLastError(message);
        return false;
      }
    },
    [refresh],
  );

  const removePinpoint = useCallback(
    async (id: string): Promise<boolean> => {
      setLastError(null);
      try {
        await SpotsService.getInstance().remove(id);
        await refresh();
        return true;
      } catch (error) {
        const message = mapServiceError(error);
        console.error('[Pinpoints] Failed to remove spot:', message);
        setLastError(message);
        return false;
      }
    },
    [refresh],
  );

  const navigateToPinpoint = useCallback(
    (pin: Pinpoint) => {
      const service = getMapService();
      if (service) {
        service.setGoal(pin.x, pin.z, pin.name);
      }
    },
    [getMapService],
  );

  return (
    <PinpointsContext.Provider
      value={{
        pinpoints,
        isLoading,
        lastError,
        clearError,
        addPinpoint,
        removePinpoint,
        navigateToPinpoint,
      }}
    >
      {children}
    </PinpointsContext.Provider>
  );
}

export const usePinpoints = () => useContext(PinpointsContext);
