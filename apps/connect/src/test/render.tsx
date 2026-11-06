import { staffTheme, ThemeProvider } from '@citius/ui';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const metrics = { frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 47 } };

export async function renderWithTheme(element: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider theme={staffTheme}>{element}</ThemeProvider>
    </SafeAreaProvider>
  );
}
