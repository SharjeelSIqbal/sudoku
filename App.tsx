import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { GameProvider } from './src/state/GameContext';
import { ProgressProvider } from './src/state/ProgressContext';
import { SettingsProvider } from './src/state/SettingsContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ProgressProvider>
          <GameProvider>
            <StatusBar style="auto" />
            <AppNavigator />
          </GameProvider>
        </ProgressProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
