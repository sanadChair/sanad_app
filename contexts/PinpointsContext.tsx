import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import MapService from '../services/MapService';

export interface Pinpoint {
  id: string;
  name: string;
  x: number;
  z: number;
}

interface PinpointsContextValue {
  pinpoints: Pinpoint[];
  addPinpoint: (name: string, x: number, z: number) => void;
  removePinpoint: (id: string) => void;
  navigateToPinpoint: (pin: Pinpoint) => void;
}

const PinpointsContext = createContext<PinpointsContextValue>({
  pinpoints: [],
  addPinpoint: () => {},
  removePinpoint: () => {},
  navigateToPinpoint: () => {},
});

export function PinpointsProvider({ children }: { children: React.ReactNode }) {
  const [pinpoints, setPinpoints] = useState<Pinpoint[]>([]);
  const mapServiceRef = useRef<MapService | null>(null);

  const getMapService = useCallback(() => {
    if (!mapServiceRef.current) {
      mapServiceRef.current = MapService.getInstance();
    }
    return mapServiceRef.current;
  }, []);

  const addPinpoint = useCallback((name: string, x: number, z: number) => {
    setPinpoints((prev) => [
      ...prev,
      { id: Date.now().toString(), name, x, z },
    ]);
  }, []);

  const removePinpoint = useCallback((id: string) => {
    setPinpoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

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
      value={{ pinpoints, addPinpoint, removePinpoint, navigateToPinpoint }}
    >
      {children}
    </PinpointsContext.Provider>
  );
}

export const usePinpoints = () => useContext(PinpointsContext);
