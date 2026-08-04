import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProgress } from '../../../state/ProgressContext';
import { useC } from '../../../theme/colors';
import { ACHIEVEMENTS } from '../../../utils/achievements';

export function AchievementsScreen() {
  const colors = useC();
  const { unlockedAchievementIds, refresh } = useProgress();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const unlocked = new Set(unlockedAchievementIds);
  const styles = createStyles();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.summary, { color: colors.foregroundMuted }]}>
        {unlocked.size} of {ACHIEVEMENTS.length} earned
      </Text>

      {ACHIEVEMENTS.map((achievement) => {
        const isEarned = unlocked.has(achievement.id);

        return (
          <View
            key={achievement.id}
            accessibilityLabel={`${achievement.title}. ${achievement.description} ${
              isEarned ? 'Earned.' : 'Not yet earned.'
            }`}
            style={[
              styles.row,
              {
                backgroundColor: isEarned ? colors.surface : colors.background,
                borderColor: isEarned ? colors.accent : colors.rule,
              },
            ]}
          >
            <View style={styles.rowText}>
              <Text
                style={[
                  styles.title,
                  {
                    color: isEarned ? colors.foreground : colors.foregroundMuted,
                    // Earned is bolder as well as tinted, so the state does not
                    // depend on colour alone.
                    fontWeight: isEarned ? '700' : '500',
                  },
                ]}
              >
                {achievement.title}
              </Text>
              <Text style={[styles.description, { color: colors.foregroundMuted }]}>
                {achievement.description}
              </Text>
              {!achievement.countsZenGames ? (
                <Text style={[styles.note, { color: colors.foregroundMuted }]}>
                  Ranked games only
                </Text>
              ) : null}
            </View>
            <Text
              style={[styles.marker, { color: isEarned ? colors.success : colors.rule }]}
            >
              {isEarned ? '✓' : '○'}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
    content: { padding: 16, gap: 10 },
    summary: { fontSize: 14, marginBottom: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    rowText: { flex: 1, gap: 2 },
    title: { fontSize: 16 },
    description: { fontSize: 13, lineHeight: 18 },
    note: { fontSize: 11, fontStyle: 'italic' },
    marker: { fontSize: 20, fontWeight: '700' },
  });
}
