/**
 * Colour tokens.
 *
 * Screens read colours through `useC()` and never hard-code a palette value.
 * The board carries most of the semantic colour in the app, so its states get
 * their own `board` group rather than being improvised per screen.
 *
 * The conflict colour is deliberately **not** red-against-green. Red/green is
 * the most common form of colourblindness and it is the one cue this game most
 * needs a player to read, so conflicts are amber and the correct-highlight is
 * blue. Colour is also never the only signal — the board backs every state
 * with weight or an underline as well.
 */

import { useColorScheme } from 'react-native';

export interface BoardColors {
  /** The grid background. */
  surface: string;
  /** Thin lines between cells. */
  rule: string;
  /** Thick lines between boxes. */
  boxRule: string;
  /** Clue digits: the puzzle's own, not the player's. */
  givenDigit: string;
  /** Digits the player entered. */
  enteredDigit: string;
  /** Pencil marks. */
  pencilMark: string;
  /** The selected cell. */
  selected: string;
  /** Cells sharing a row, column or box with the selection. */
  peerHighlight: string;
  /** Cells holding the same digit as the selection. */
  sameDigitHighlight: string;
  /** A wrong entry. Amber, never red-vs-green. */
  conflict: string;
  /** The background behind a wrong entry. */
  conflictSurface: string;
  /** A cell a hint is pointing at. */
  hint: string;
  /** The background behind a hinted cell. */
  hintSurface: string;
}

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  foreground: string;
  foregroundMuted: string;
  accent: string;
  accentForeground: string;
  rule: string;
  success: string;
  warning: string;
  danger: string;
  board: BoardColors;
}

const LIGHT_COLORS: ThemeColors = {
  background: '#FBFAF7',
  surface: '#FFFFFF',
  surfaceRaised: '#F1EFEA',
  foreground: '#1B1A17',
  foregroundMuted: '#6B675F',
  accent: '#2F6FB5',
  accentForeground: '#FFFFFF',
  rule: '#DCD8D0',
  success: '#2E7D57',
  warning: '#B5761F',
  danger: '#A8452F',
  board: {
    surface: '#FFFFFF',
    rule: '#D8D4CC',
    boxRule: '#57534B',
    givenDigit: '#1B1A17',
    enteredDigit: '#2F6FB5',
    pencilMark: '#8A857C',
    selected: '#CFE0F2',
    peerHighlight: '#EDEAE4',
    sameDigitHighlight: '#DCE8F5',
    conflict: '#8A5200',
    conflictSurface: '#F7E3C0',
    hint: '#1F6B4F',
    hintSurface: '#CDEBDB',
  },
};

const DARK_COLORS: ThemeColors = {
  background: '#121211',
  surface: '#1C1C1A',
  surfaceRaised: '#262623',
  foreground: '#F2F0EB',
  foregroundMuted: '#A29D93',
  accent: '#7FB3E8',
  accentForeground: '#0E1620',
  rule: '#34332F',
  success: '#6FC79A',
  warning: '#E0A857',
  danger: '#E58A72',
  board: {
    surface: '#1C1C1A',
    rule: '#34332F',
    boxRule: '#8A857C',
    givenDigit: '#F2F0EB',
    enteredDigit: '#7FB3E8',
    pencilMark: '#8A857C',
    selected: '#2C4055',
    peerHighlight: '#262623',
    sameDigitHighlight: '#243748',
    conflict: '#E0A857',
    conflictSurface: '#4A3616',
    hint: '#6FC79A',
    hintSurface: '#1E3D2E',
  },
};

/**
 * The house hook. Named `useC` and destructured as `colors = useC()` to match
 * the sibling projects, so muscle memory carries across.
 */
export function useC(): ThemeColors {
  return useColorScheme() === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

/** For tests and anything outside a component tree. */
export function colorsForScheme(scheme: 'light' | 'dark'): ThemeColors {
  return scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}
