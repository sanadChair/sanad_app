import React, { createContext, useContext, useCallback, useRef } from 'react';
import WheelchairService from '../services/WheelchairService';

interface JoystickContextValue {
  updateVelocity: (linear: number, angular: number) => void;
  stop: () => void;
}

const JoystickContext = createContext<JoystickContextValue>({
  updateVelocity: () => {},
  stop: () => {},
});

export function JoystickProvider({ children }: { children: React.ReactNode }) {
  const serviceRef = useRef<WheelchairService | null>(null);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = WheelchairService.getInstance();
    }
    return serviceRef.current;
  }, []);

  const updateVelocity = useCallback(
    (linear: number, angular: number) => {
      getService().updateVelocity(linear, angular);
    },
    [getService],
  );

  const stop = useCallback(() => {
    getService().stop();
  }, [getService]);

  return (
    <JoystickContext.Provider value={{ updateVelocity, stop }}>
      {children}
    </JoystickContext.Provider>
  );
}

export const useJoystick = () => useContext(JoystickContext);
