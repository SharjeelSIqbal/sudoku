import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AchievementsScreen } from '../screens/progress/achievements/AchievementsScreen';
import { StatsScreen } from '../screens/progress/stats/StatsScreen';
import { GameScreen } from '../screens/play/game/GameScreen';
import { HomeScreen } from '../screens/play/home/HomeScreen';
import { SettingsScreen } from '../screens/settings/preferences/SettingsScreen';
import { useC } from '../theme/colors';
import { type RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const colors = useC();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { color: colors.foreground },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Sudoku' }} />
        <Stack.Screen
          name="Game"
          component={GameScreen}
          // The header back button would leave a game running behind it; the
          // screen provides its own pause control instead.
          options={{ title: '', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'Stats' }} />
        <Stack.Screen
          name="Achievements"
          component={AchievementsScreen}
          options={{ title: 'Achievements' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
