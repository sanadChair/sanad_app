import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { PinpointsProvider } from '../contexts/PinpointsContext';
import { MapProvider } from '../contexts/MapContext';
import { NavigationProvider } from '../contexts/NavigationContext';
import { JoystickProvider } from '../contexts/JoystickContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ErrorBoundary, { RootFallback } from '../components/ErrorBoundary';

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const { colors } = useTheme();

  return (
    <SafeAreaProvider>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="settings"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <ErrorBoundary
          fallback={(reset) => <RootFallback onRetry={reset} />}
        >
          <JoystickProvider>
            <MapProvider>
              <NavigationProvider>
                <PinpointsProvider>
                  <RootLayoutInner />
                </PinpointsProvider>
              </NavigationProvider>
            </MapProvider>
          </JoystickProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
