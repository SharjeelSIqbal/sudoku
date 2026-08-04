import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProgress } from '../../../state/ProgressContext';
import { useC } from '../../../theme/colors';
import { formatDuration } from '../../../utils/dates';
import { DIFFICULTY_LABELS, formatPoints } from '../../../utils/labels';

export function StatsScreen() {
  const colors = useC();
  const { streak, longestStreak, totalPoints, statsPerDifficulty, refresh } = useProgress();

  // Stats go stale the moment a game finishes, so refresh on focus rather than
  // only on mount.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const styles = createStyles();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headlineRow}>
        <Headline label="Points" value={formatPoints(totalPoints)} />
        <Headline label="Streak" value={`${streak.currentStreakDays}`} />
        <Headline label="Best streak" value={`${longestStreak}`} />
      </View>

      {streak.freezesRemaining > 0 ? (
        <Text style={[styles.freezeNote, { color: colors.foregroundMuted }]}>
          You have {streak.freezesRemaining} streak freeze
          {streak.freezesRemaining === 1 ? '' : 's'} in hand. A freeze covers one missed
          day automatically, so a busy day will not cost you your streak.
        </Text>
      ) : null}

      <Text style={[styles.sectionHeading, { color: colors.foregroundMuted }]}>
        By difficulty
      </Text>

      {statsPerDifficulty.map((stats) => (
        <View
          key={stats.difficulty}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.rule }]}
          accessibilityLabel={`${DIFFICULTY_LABELS[stats.difficulty]}: ${stats.gamesCompleted} solved of ${stats.gamesPlayed} played${
            stats.bestSeconds === null ? '' : `, best time ${formatDuration(stats.bestSeconds)}`
          }`}
        >
          <View style={styles.rowHeader}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>
              {DIFFICULTY_LABELS[stats.difficulty]}
            </Text>
            <Text style={[styles.rowCount, { color: colors.foregroundMuted }]}>
              {stats.gamesCompleted}/{stats.gamesPlayed}
            </Text>
          </View>
          <View style={styles.rowDetails}>
            <Detail
              label="Best"
              value={stats.bestSeconds === null ? '—' : formatDuration(stats.bestSeconds)}
            />
            <Detail
              label="Average"
              value={
                stats.averageSeconds === null ? '—' : formatDuration(stats.averageSeconds)
              }
            />
            <Detail label="Best score" value={formatPoints(stats.bestPoints)} />
          </View>
        </View>
      ))}

      <Text style={[styles.footnote, { color: colors.foregroundMuted }]}>
        Best and average times count ranked games only — zen games are untimed.
      </Text>
    </ScrollView>
  );
}

function Headline({ label, value }: { label: string; value: string }) {
  const colors = useC();
  const styles = createStyles();

  return (
    <View style={styles.headline} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.headlineValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.headlineLabel, { color: colors.foregroundMuted }]}>{label}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const colors = useC();
  const styles = createStyles();

  return (
    <View style={styles.detail}>
      <Text style={[styles.detailLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    content: { padding: 16, gap: 12 },
    headlineRow: { flexDirection: 'row', gap: 12 },
    headline: { flex: 1, alignItems: 'center', gap: 2 },
    headlineValue: { fontSize: 26, fontWeight: '700' },
    headlineLabel: { fontSize: 12 },
    freezeNote: { fontSize: 13, lineHeight: 18 },
    sectionHeading: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 8,
    },
    row: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
    rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowTitle: { fontSize: 16, fontWeight: '600' },
    rowCount: { fontSize: 13 },
    rowDetails: { flexDirection: 'row', gap: 16 },
    detail: { flex: 1, gap: 2 },
    detailLabel: { fontSize: 11 },
    detailValue: { fontSize: 14, fontWeight: '600' },
    footnote: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  });
}
