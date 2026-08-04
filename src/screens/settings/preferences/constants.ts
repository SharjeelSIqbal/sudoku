import { type InputMode } from '../../../state/SettingsContext';

export const INPUT_MODE_LABELS: Record<InputMode, string> = {
  'cell-first': 'Cell first',
  'digit-first': 'Digit first',
};

export const INPUT_MODE_BLURBS: Record<InputMode, string> = {
  'cell-first': 'Tap a square, then tap a number.',
  'digit-first': 'Tap a number, then tap the squares it goes in.',
};
