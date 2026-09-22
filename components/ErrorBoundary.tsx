import { Component, Fragment, type ReactNode } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
}

interface State {
  hasError: boolean;
  resetKey: number;
}

function ThemedFallback() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.mapBg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Map unavailable</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>3D view could not be initialized</Text>
    </View>
  );
}

function RootFallback({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>An unexpected error occurred</Text>
      <Pressable
        style={[styles.retryBtn, { backgroundColor: colors.horizonBlue }]}
        onPress={onRetry}
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export { RootFallback };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[ErrorBoundary]', error.message);
  }

  reset = () => {
    this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') return fallback(this.reset);
      if (fallback) return fallback;
      return <ThemedFallback />;
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}

export function isWebGLAvailable(): boolean {
  if (Platform.OS !== 'web') return true;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  sub: {
    fontSize: 13,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
