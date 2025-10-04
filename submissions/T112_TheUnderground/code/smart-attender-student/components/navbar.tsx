import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface NavbarAction {
  label: string;
  href: Href;
}

interface NavbarProps {
  title?: string;
  subtitle?: string;
  actions?: NavbarAction[];
}

export function Navbar({ title = 'Smart Attender', subtitle, actions = [] }: NavbarProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: palette.background }]}> 
      <View style={[styles.container, { borderColor: palette.tint + '33' }]}> 
        <View style={styles.headerBlock}>
          <ThemedText type="title" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="subtitle" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {actions.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionsRow}
          >
            {actions.map((action) => (
              <ThemedText
                key={String(action.href)}
                type="link"
                style={[styles.actionLabel, { color: palette.tint }]}
                onPress={() => router.replace(action.href)}
              >
                {action.label}
              </ThemedText>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flexShrink: 0
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  headerBlock: {
    gap: 4
  },
  title: {
    fontSize: 22
  },
  subtitle: {
    fontSize: 14
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 20
  },
  actionLabel: {
    fontSize: 14
  }
});
