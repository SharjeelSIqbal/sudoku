import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useSettings, type InputMode } from '../../../state/SettingsContext';
import { useC } from '../../../theme/colors';
import { MINIMUM_TOUCH_TARGET } from '../../play/home/constants';
import { INPUT_MODE_BLURBS, INPUT_MODE_LABELS } from './constants';

export function SettingsScreen() {
  const colors = useC();
  const { settings, updateSettings } = useSettings();
  const styles = createStyles();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <SectionHeading title="Difficulty" />
      <Text style={[styles.sectionNote, { color: colors.foregroundMuted }]}>
        Both of these make a puzzle harder, and they stack. Neither is on by default.
      </Text>

      <ToggleRow
        title="Tell me when I'm wrong"
        description="On, a wrong digit is flagged as you enter it. Off is harder — you only find out at the end."
        value={settings.instantValidation}
        onChange={(instantValidation) => updateSettings({ instantValidation })}
      />
      <ToggleRow
        title="Three-mistake limit"
        description="On, three wrong entries ends the run. Off, you can make as many as you like."
        value={settings.strikeLimit}
        onChange={(strikeLimit) => updateSettings({ strikeLimit })}
      />

      <SectionHeading title="How you enter digits" />
      <View style={styles.choiceRow}>
        {(['cell-first', 'digit-first'] as const).map((mode: InputMode) => {
          const isSelected = settings.inputMode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${INPUT_MODE_LABELS[mode]}. ${INPUT_MODE_BLURBS[mode]}`}
              onPress={() => updateSettings({ inputMode: mode })}
              style={[
                styles.choiceButton,
                {
                  backgroundColor: isSelected ? colors.surfaceRaised : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.rule,
                },
              ]}
            >
              <Text style={[styles.choiceTitle, { color: colors.foreground }]}>
                {INPUT_MODE_LABELS[mode]}
              </Text>
              <Text style={[styles.choiceBlurb, { color: colors.foregroundMuted }]}>
                {INPUT_MODE_BLURBS[mode]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeading title="Help while you play" />
      <ToggleRow
        title="Fill notes automatically"
        description="Keeps pencil marks up to date for you. It does most of the bookkeeping, so it caps the points a game can earn."
        value={settings.autoCandidates}
        onChange={(autoCandidates) => updateSettings({ autoCandidates })}
      />
      <ToggleRow
        title="Highlight the row, column and box"
        description="Dims the cells that share a unit with the one you've selected."
        value={settings.highlightPeers}
        onChange={(highlightPeers) => updateSettings({ highlightPeers })}
      />
      <ToggleRow
        title="Highlight matching digits"
        description="Marks every cell holding the same digit as the one you've selected."
        value={settings.highlightSameDigit}
        onChange={(highlightSameDigit) => updateSettings({ highlightSameDigit })}
      />

      <SectionHeading title="Feel" />
      <ToggleRow
        title="Vibration"
        description="A short buzz on a wrong entry, and on finishing a puzzle."
        value={settings.hapticsEnabled}
        onChange={(hapticsEnabled) => updateSettings({ hapticsEnabled })}
      />

      <SectionHeading title="Reminders" />
      <ToggleRow
        title="Remind me about my streak"
        description="One gentle notification a day, and only when a streak is actually at risk."
        value={settings.streakReminderEnabled}
        onChange={(streakReminderEnabled) => updateSettings({ streakReminderEnabled })}
      />

      <Text style={[styles.footnote, { color: colors.foregroundMuted }]}>
        Everything stays on this device. There is no account, nothing is uploaded, and
        the app works with no signal at all.
      </Text>
    </ScrollView>
  );
}

function SectionHeading({ title }: { title: string }) {
  const colors = useC();
  const styles = createStyles();

  return (
    <Text
      accessibilityRole="header"
      style={[styles.sectionHeading, { color: colors.foregroundMuted }]}
    >
      {title}
    </Text>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const colors = useC();
  const styles = createStyles();

  return (
    <View
      style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.rule }]}
    >
      <View style={styles.toggleText}>
        <Text style={[styles.toggleTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.toggleDescription, { color: colors.foregroundMuted }]}>
          {description}
        </Text>
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityHint={description}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.rule }}
      />
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    content: { padding: 16, gap: 10 },
    sectionHeading: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 12,
    },
    sectionNote: { fontSize: 13, lineHeight: 18 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 14,
      minHeight: MINIMUM_TOUCH_TARGET,
    },
    toggleText: { flex: 1, gap: 2 },
    toggleTitle: { fontSize: 15, fontWeight: '600' },
    toggleDescription: { fontSize: 12, lineHeight: 17 },
    choiceRow: { flexDirection: 'row', gap: 10 },
    choiceButton: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 12,
      gap: 4,
      minHeight: MINIMUM_TOUCH_TARGET,
    },
    choiceTitle: { fontSize: 15, fontWeight: '600' },
    choiceBlurb: { fontSize: 12, lineHeight: 16 },
    footnote: { fontSize: 12, lineHeight: 17, marginTop: 16 },
  });
}
