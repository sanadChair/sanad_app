import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import MapService from '../services/MapService';
import rosHandler from '../services/ros';
import type { OccupancyGrid, RobotPose } from '../services/types';

interface MapContextValue {
  map: OccupancyGrid | null;
  robotPose: RobotPose | null;
  isConnected: boolean;
  isLoading: boolean;
}

const MapContext = createContext<MapContextValue>({
  map: null,
  robotPose: null,
  isConnected: false,
  isLoading: true,
});

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<OccupancyGrid | null>(null);
  const [robotPose, setRobotPose] = useState<RobotPose | null>(null);
  const [isConnected, setIsConnected] = useState(() => rosHandler.connected);
  const [isLoading, setIsLoading] = useState(true);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const unsubConn = rosHandler.onConnection(() => setIsConnected(true));
    const unsubDisc = rosHandler.onDisconnect(() => setIsConnected(false));

    return () => {
      unsubConn();
      unsubDisc();
    };
  }, []);

  useEffect(() => {
    // Clean up previous subscriptions
    unsubscribersRef.current.forEach((unsub) => unsub());
    unsubscribersRef.current = [];

    const mapService = MapService.getInstance();

    const unsubMap = mapService.onMapUpdate((data) => {
      setMap(data);
      setIsLoading(false);
    });

    const unsubPose = mapService.onPoseUpdate((pose) => {
      setRobotPose(pose);
    });

    unsubscribersRef.current = [unsubMap, unsubPose];

    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];
    };
  }, []);

  return (
    <MapContext.Provider value={{ map, robotPose, isConnected, isLoading }}>
      {children}
    </MapContext.Provider>
  );
}

export const useMap = () => useContext(MapContext);
