import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Every route in the app. A new screen registers here *and* in
 * `AppNavigator` — one without the other is the usual cause of a route that
 * navigates but does not typecheck, or vice versa.
 *
 * No route carries the puzzle itself: the game in play lives in `GameContext`,
 * so a board survives navigating away and back without being serialised
 * through route params.
 */
export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Stats: undefined;
  Achievements: undefined;
  Settings: undefined;
};

export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Use this instead of `useNavigation<any>`, which loses every route type. */
export function useAppNavigation(): AppNavigationProp {
  return useNavigation<AppNavigationProp>();
}
