import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type ModalParams = {
  status?: string;
  message?: string;
  proximity?: string;
  notes?: string;
  className?: string;
  subject?: string;
};

export default function ModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ModalParams>();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const cardBackground = colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)';
  const defaultAccent = colorScheme === 'dark' ? '#0a7ea4' : palette.tint;

  const status = (params.status ?? 'present').toLowerCase();
  const message = params.message ?? 'Attendance recorded.';
  const proximityMeters = Number.parseFloat(params.proximity ?? '0');
  const notes = typeof params.notes === 'string' && params.notes.length > 0 ? params.notes.split('|') : [];
  const className = params.className ?? 'Class';
  const subject = params.subject ?? 'Subject';
  const statusMeta = resolveStatusMeta(status, defaultAccent);

  const showDistance = Number.isFinite(proximityMeters) && proximityMeters > 0;

  const primaryButtonTint = statusMeta.tint === '#fff' ? defaultAccent : statusMeta.tint;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <ThemedView style={styles.container}> 
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { backgroundColor: cardBackground }]}
          style={styles.cardScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.cardHeader, { borderColor: statusMeta.tint, backgroundColor: statusMeta.background }]}> 
            <ThemedText type="defaultSemiBold" style={[styles.statusText, { color: statusMeta.tint }]}>
              {statusMeta.label.toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText type="title" style={styles.title}>
            {className}
          </ThemedText>
          <ThemedText type="subtitle">{subject}</ThemedText>
          <ThemedText type="default" style={styles.message}>
            {message}
          </ThemedText>
          {showDistance && (
            <ThemedText type="default">Distance from class: {proximityMeters.toFixed(1)} m</ThemedText>
          )}
          {notes.length > 0 && (
            <View style={styles.notes}>
              {notes.map((note, index) => (
                <ThemedText key={`${note}-${index}`} type="default">
                  • {note}
                </ThemedText>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: primaryButtonTint }]}
            onPress={() => router.replace('/(tabs)/index' as never)}
          >
            <ThemedText
              type="defaultSemiBold"
              style={styles.primaryLabel}
            >
              Back to dashboard
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: defaultAccent }]}
            onPress={() => router.replace('/(tabs)/history' as never)}
          >
            <ThemedText type="defaultSemiBold" style={[styles.secondaryLabel, { color: defaultAccent }]}>
              View history
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

function resolveStatusMeta(status: string, defaultTint: string) {
  const fallbackTint = defaultTint === '#fff' ? '#0a7ea4' : defaultTint;
  switch (status) {
    case 'flagged':
      return {
        label: 'flagged',
        tint: '#d64545',
        background: 'rgba(214, 69, 69, 0.12)'
      };
    case 'late':
      return {
        label: 'late',
        tint: '#d08700',
        background: 'rgba(208, 135, 0, 0.12)'
      };
    default:
      return {
        label: status,
        tint: fallbackTint,
        background: 'rgba(10, 126, 164, 0.12)'
      };
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 24
  },
  cardScroll: {
    borderRadius: 18,
    overflow: 'hidden'
  },
  scrollContent: {
    borderRadius: 18,
    padding: 24,
    gap: 12
  },
  cardHeader: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1
  },
  statusText: {
    fontSize: 12,
    letterSpacing: 1
  },
  title: {
    textAlign: 'left'
  },
  message: {
    lineHeight: 20
  },
  notes: {
    gap: 4
  },
  actions: {
    gap: 12
  },
  primaryButton: {
    alignSelf: 'stretch',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14
  },
  primaryLabel: {
    textAlign: 'center',
    color: '#fff'
  },
  secondaryButton: {
    alignSelf: 'stretch',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5
  },
  secondaryLabel: {
    textAlign: 'center'
  }
});
