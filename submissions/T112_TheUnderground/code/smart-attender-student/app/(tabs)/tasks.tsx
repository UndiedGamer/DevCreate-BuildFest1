import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';

import { Navbar } from '@/components/navbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/AuthProvider';
import { useStudentTasks } from '@/hooks/use-student-tasks';
import type { StudentTask } from '@/services/student-tasks';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { useFreePeriodTasks } from '@/hooks/use-free-period-tasks';

export default function TasksScreen() {
  const colorScheme = useColorScheme();
  const { user, isMock } = useAuth();
  const { tasks, loading, error, toggleTask, refresh } = useStudentTasks();
  const { profile } = useStudentProfile();
  const [refreshing, setRefreshing] = useState(false);

  const firstClass = useMemo(() => profile?.enrolledClasses?.[0], [profile?.enrolledClasses]);
  const gradeLevel = useMemo(() => {
    if (!profile?.studentNumber) {
      return 'Grades 9-12';
    }

    const gradeMatch = profile.studentNumber.match(/(9|10|11|12)/);
    if (gradeMatch) {
      return `Grade ${gradeMatch[0]}`;
    }

    return 'Grades 9-12';
  }, [profile?.studentNumber]);
  const activeMood = useMemo(() => {
    const pendingCount = tasks.filter((task) => task.status !== 'completed').length;
    if (pendingCount === 0) {
      return 'energized';
    }
    if (pendingCount > 3) {
      return 'focused';
    }
    return 'motivated';
  }, [tasks]);

  const {
    ideas,
    loading: ideasLoading,
    error: ideasError,
    isFallback: ideasAreFallback,
    refresh: refreshIdeas
  } = useFreePeriodTasks({
    gradeLevel,
    interest: firstClass,
    mood: activeMood,
    time: '15 minutes'
  });

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const surface = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const accent = Colors[colorScheme ?? 'light'].tint;

  useEffect(() => {
    if (!loading && !ideasLoading && refreshing) {
      setRefreshing(false);
    }
  }, [loading, ideasLoading, refreshing]);

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    refreshIdeas();
  };

  const handleToggleTask = async (task: StudentTask) => {
    await toggleTask(task);
  };

  return (
    <ThemedView style={styles.screen}>
      <Navbar subtitle="Stay on top of your assignments." />
      <View style={styles.header}>
        <ThemedText type="title">Tasks</ThemedText>
        <ThemedText type="subtitle">Keep up with your assignments and reminders.</ThemedText>
        <ThemedText type="default" style={styles.accountHint}>
          Managing tasks for {user?.displayName ?? user?.email ?? (isMock ? 'demo student' : 'student')}
        </ThemedText>
        {isMock && (
          <ThemedText type="default">
            Demo mode active. Tasks sync locally until Firebase is configured.
          </ThemedText>
        )}
      </View>

      <FlatList
        data={sortedTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.ideasSection}>
            <View style={styles.ideasHeader}>
              <ThemedText type="title">Free time ideas</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={refreshIdeas}
                disabled={ideasLoading}
                style={({ pressed }) => [styles.refreshLink, pressed && styles.refreshLinkPressed]}
              >
                <ThemedText type="defaultSemiBold" style={styles.refreshText}>
                  {ideasLoading ? 'Refreshing…' : 'New ideas'}
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="subtitle">
              Quick wins tailored to {firstClass ?? 'your goals'} when you&apos;re feeling {activeMood}.
            </ThemedText>
            <View style={styles.ideasList}>
              {ideasLoading && ideas.length === 0 ? (
                <ThemedText>Loading inspiration…</ThemedText>
              ) : (
                ideas.map((idea) => (
                  <View key={idea.id} style={[styles.ideaCard, { backgroundColor: surface }]}> 
                    <ThemedText type="defaultSemiBold">{idea.title}</ThemedText>
                    <ThemedText>{idea.description}</ThemedText>
                    <View style={styles.ideaMetaRow}>
                      <Badge label={idea.duration} accent={accent} />
                      <Badge label={idea.focusArea.replace('-', ' ')} accent={accent} variant="outline" />
                    </View>
                  </View>
                ))
              )}
            </View>
            {ideasError && <ThemedText style={styles.errorText}>{ideasError}</ThemedText>}
            {ideasAreFallback && !ideasLoading && (
              <ThemedText style={styles.fallbackText}>
                Showing example ideas while we connect to the server.
              </ThemedText>
            )}
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => handleToggleTask(item)}
            style={({ pressed }) => [
              styles.taskCard,
              { backgroundColor: surface, opacity: pressed ? 0.94 : 1 }
            ]}>
            <View style={styles.cardHeader}>
              <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
              <StatusBadge status={item.status} accent={accent} />
            </View>
            {item.description && <ThemedText>{item.description}</ThemedText>}
            {item.dueDate && (
              <ThemedText type="default">
                Due {formatDueDate(item.dueDate)}
              </ThemedText>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ThemedText>Loading tasks...</ThemedText>
          ) : (
            <ThemedText>No tasks yet. You&apos;re all caught up!</ThemedText>
          )
        }
      />

      {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
    </ThemedView>
  );
}

function StatusBadge({ status, accent }: { status: StudentTask['status']; accent: string }) {
  const background = status === 'completed' ? accent : 'transparent';
  const textColor = status === 'completed' ? '#fff' : accent;

  return (
    <View
      style={[styles.badge, { backgroundColor: background, borderColor: accent }]}
    >
      <ThemedText type="defaultSemiBold" style={[styles.badgeText, { color: textColor }]}>
        {status.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function Badge({
  label,
  accent,
  variant = 'solid'
}: {
  label: string;
  accent: string;
  variant?: 'solid' | 'outline';
}) {
  const backgroundColor = variant === 'solid' ? accent : 'transparent';
  const textColor = variant === 'solid' ? '#fff' : accent;
  const borderColor = variant === 'solid' ? 'transparent' : accent;

  return (
    <View style={[styles.ideaBadge, { backgroundColor, borderColor }]}> 
      <ThemedText type="defaultSemiBold" style={[styles.badgeText, styles.ideaBadgeText, { color: textColor }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function sortTasks(tasks: StudentTask[]): StudentTask[] {
  return [...tasks].sort((a, b) => {
    const statusOrder = statusValue(a.status) - statusValue(b.status);
    if (statusOrder !== 0) {
      return statusOrder;
    }

    const dueA = parseDateMillis(a.dueDate);
    const dueB = parseDateMillis(b.dueDate);
    return dueA - dueB;
  });
}

function statusValue(status: StudentTask['status']): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'in-progress':
      return 1;
    case 'completed':
      return 2;
    default:
      return 3;
  }
}

function parseDateMillis(iso?: string): number {
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = parseISO(iso);
  return isValid(parsed) ? parsed.getTime() : Number.POSITIVE_INFINITY;
}

function formatDueDate(iso: string): string {
  const parsed = parseISO(iso);
  if (!isValid(parsed)) {
    return 'soon';
  }
  return formatDistanceToNow(parsed, { addSuffix: true });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    gap: 16
  },
  header: {
    gap: 8
  },
  accountHint: {
    fontSize: 13,
    opacity: 0.8
  },
  listContent: {
    gap: 12,
    paddingBottom: 24
  },
  ideasSection: {
    gap: 12,
    marginBottom: 16
  },
  ideasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  ideasList: {
    gap: 12
  },
  ideaCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  ideaMetaRow: {
    flexDirection: 'row',
    gap: 8
  },
  refreshLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  refreshLinkPressed: {
    opacity: 0.7
  },
  refreshText: {
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.5
  },
  taskCard: {
    padding: 16,
    borderRadius: 16,
    gap: 8
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1
  },
  badgeText: {
    fontSize: 12,
    letterSpacing: 0.5
  },
  ideaBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  ideaBadgeText: {
    fontSize: 12,
    letterSpacing: 0.5
  },
  errorText: {
    color: '#ff5d5d'
  },
  fallbackText: {
    fontSize: 12,
    opacity: 0.7
  }
});
