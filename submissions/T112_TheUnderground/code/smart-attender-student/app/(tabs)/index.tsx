import { ScrollView, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { formatDistanceToNow, parseISO } from 'date-fns';

import { Navbar } from '@/components/navbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/AuthProvider';
import { useAttendanceHistory } from '@/hooks/use-attendance-history';
import { useStudentTasks } from '@/hooks/use-student-tasks';
import type { StudentTask } from '@/services/student-tasks';

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user, isMock, signOut } = useAuth();
  const { tasks } = useStudentTasks();
  const { records } = useAttendanceHistory(5);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const goTo = (path: string) => router.push(path as never);
  const nextTask = useMemo(() => selectNextTask(tasks), [tasks]);
  const latestAttendance = records[0];

  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const accentCardColor = colorScheme === 'dark' ? 'rgba(10, 126, 164, 0.35)' : 'rgba(10, 126, 164, 0.12)';
  const surfaceColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const surfaceAltColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const statusTint = colorScheme === 'dark' ? 'rgba(10, 126, 164, 0.45)' : 'rgba(10, 126, 164, 0.16)';

  const handleSignOut = async () => {
    if (signingOut || isMock) {
      return;
    }

    try {
      setSignOutError(null);
      setSigningOut(true);
      await signOut();
    } catch (err) {
      console.error('Failed to sign out', err);
      setSignOutError('Unable to sign out right now. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor }]}
      showsVerticalScrollIndicator={false}
    >
      <Navbar subtitle="Plan your day and stay on top of attendance." />
      <ThemedView style={[styles.headerCard, { backgroundColor: accentCardColor }]}>
        <View style={styles.accountRow}>
          <View>
            <ThemedText type="subtitle">Hello{user?.displayName ? `, ${user.displayName}` : ''} 👋</ThemedText>
            <ThemedText type="default">{user?.email ?? 'Signed in'}</ThemedText>
          </View>
          {!isMock ? (
            <ThemedText type="link" onPress={handleSignOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="title">You&apos;re on track today.</ThemedText>
        <View style={styles.headerActions}>
          <ThemedText type="default">
            Ready for class? Start by marking your attendance when you arrive.
          </ThemedText>
          <ThemedText type="link" onPress={() => goTo('/(tabs)/check-in')}>
            Open scanner
          </ThemedText>
        </View>
        {signOutError ? <ThemedText style={styles.errorText}>{signOutError}</ThemedText> : null}
      </ThemedView>

      <View style={styles.quickActions}>
        <QuickAction
          label="Check in"
          description="Scan your classroom QR code"
          onPress={() => goTo('/(tabs)/check-in')}
          backgroundColor={surfaceAltColor}
        />
        <QuickAction
          label="Tasks"
          description="Track and finish your homework"
          onPress={() => goTo('/(tabs)/tasks')}
          backgroundColor={surfaceAltColor}
        />
        <QuickAction
          label="History"
          description="See your attendance log"
          onPress={() => goTo('/(tabs)/history')}
          backgroundColor={surfaceAltColor}
        />
      </View>

      <ThemedView style={[styles.section, { backgroundColor: surfaceColor }]}>
        <SectionHeader title="Next up" actionLabel="View tasks" onPress={() => goTo('/(tabs)/tasks')} />
        {nextTask ? (
          <View style={styles.card}>
            <ThemedText type="defaultSemiBold">{nextTask.title}</ThemedText>
            {nextTask.dueDate && (
              <ThemedText>
                Due {formatRelativeLabel(nextTask.dueDate)} · Status: {formatStatus(nextTask.status)}
              </ThemedText>
            )}
            {nextTask.description && <ThemedText>{nextTask.description}</ThemedText>}
          </View>
        ) : (
          <ThemedText>No pending tasks. Enjoy your day!</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={[styles.section, { backgroundColor: surfaceColor }]}>
        <SectionHeader title="Recent attendance" actionLabel="See all" onPress={() => goTo('/(tabs)/history')} />
        {latestAttendance ? (
          <View style={styles.card}>
            <ThemedText type="defaultSemiBold">{latestAttendance.className}</ThemedText>
            <ThemedText>{latestAttendance.subject}</ThemedText>
            <ThemedText>
              {latestAttendance.recordedAtLabel ?? formatRelativeLabel(latestAttendance.recordedAt ?? '')}
            </ThemedText>
            <StatusPill status={latestAttendance.status} tint={statusTint} />
          </View>
        ) : (
          <ThemedText>No scans yet. Your next session will appear here.</ThemedText>
        )}
      </ThemedView>

      <View style={styles.footer}>
        {isMock && <ThemedText type="default">Connected in demo mode</ThemedText>}
      </View>
    </ScrollView>
  );
}

interface QuickActionProps {
  label: string;
  description: string;
  onPress: () => void;
  backgroundColor?: string;
}

function QuickAction({ label, description, onPress, backgroundColor }: QuickActionProps) {
  return (
    <ThemedView style={[styles.quickAction, backgroundColor ? { backgroundColor } : null]}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <ThemedText type="default">{description}</ThemedText>
      <ThemedText type="link" onPress={onPress}>
        Open
      </ThemedText>
    </ThemedView>
  );
}

interface SectionHeaderProps {
  title: string;
  actionLabel: string;
  onPress: () => void;
}

function SectionHeader({ title, actionLabel, onPress }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText type="link" onPress={onPress}>
        {actionLabel}
      </ThemedText>
    </View>
  );
}

function StatusPill({ status, tint }: { status: string; tint: string }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: tint }]}>
      <ThemedText type="defaultSemiBold" style={styles.statusPillText}>
        {status.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function selectNextTask(tasks: StudentTask[]): StudentTask | undefined {
  if (!tasks.length) {
    return undefined;
  }

  const upcoming = [...tasks].filter((task) => task.status !== 'completed' && task.dueDate);
  if (upcoming.length === 0) {
    return tasks[0];
  }

  return upcoming.sort((a, b) => {
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return dateA - dateB;
  })[0];
}

function formatRelativeLabel(dateString: string) {
  if (!dateString) {
    return 'soon';
  }

  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return 'soon';
  }
}

function formatStatus(status: StudentTask['status']) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in-progress':
      return 'In progress';
    default:
      return 'Pending';
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 24
  },
  headerCard: {
    borderRadius: 18,
    padding: 20,
    gap: 12
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerActions: {
    gap: 12
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  section: {
    borderRadius: 18,
    padding: 20,
    gap: 12
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  card: {
    gap: 6
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  statusPillText: {
    fontSize: 12,
    letterSpacing: 1.2
  },
  footer: {
    marginTop: 'auto',
    gap: 8
  },
  errorText: {
    color: '#ff5d5d'
  }
});
