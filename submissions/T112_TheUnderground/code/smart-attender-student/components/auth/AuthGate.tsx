import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { useAuth } from '@/providers/AuthProvider';
import { ProfileOnboarding } from '@/components/auth/ProfileOnboarding';
import { missingFirebaseConfigKeys } from '@/lib/firebase';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, isMock } = useAuth();
  const [demoAcknowledged, setDemoAcknowledged] = useState(false);
  const {
    loading: profileLoading,
    profile,
    device,
    needsDetails,
    needsDeviceApproval,
    saveDetails,
    syncDevice,
    refresh
  } = useStudentProfile();
  const accountEmail = user?.email ?? profile?.email ?? null;

  useEffect(() => {
    if (!isMock) {
      setDemoAcknowledged(false);
    }
  }, [isMock]);

  if (loading) {
    return <FullScreenStatus message="Checking your session…" />;
  }

  if (!user && !isMock) {
    return <SignInPrompt />;
  }

  if (isMock && !demoAcknowledged) {
    return <DemoModeNotice onContinue={() => setDemoAcknowledged(true)} />;
  }

  const needsOnboarding = Boolean(user && (needsDetails || needsDeviceApproval));

  if (user && profileLoading) {
    return <FullScreenStatus message="Preparing your profile…" />;
  }

  if (user && needsOnboarding) {
    return (
      <ProfileOnboarding
        studentId={user.uid}
        profile={profile}
        device={device}
        accountEmail={accountEmail}
        needsDetails={needsDetails}
        needsDeviceApproval={needsDeviceApproval}
        onSaveDetails={saveDetails}
        onSyncDevice={syncDevice}
        onCompleted={refresh}
      />
    );
  }

  return <>{children}</>;
}

function SignInPrompt() {
  const colorScheme = useColorScheme();
  const { signIn, requestPasswordReset, error, isMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const palette = Colors[colorScheme ?? 'light'];
  const tint = palette.tint;
  const background = palette.background;
  const textColor = palette.text;
  const cardBackground = colorScheme === 'dark' ? 'rgba(236, 237, 238, 0.08)' : 'rgba(17, 24, 28, 0.04)';
  const cardBorder = colorScheme === 'dark' ? 'rgba(236, 237, 238, 0.16)' : 'rgba(10, 126, 164, 0.12)';
  const inputBackground = colorScheme === 'dark' ? 'rgba(236, 237, 238, 0.08)' : '#fff';
  const placeholder = colorScheme === 'dark' ? 'rgba(236, 237, 238, 0.5)' : 'rgba(17, 24, 28, 0.45)';
  const mockHint = useMemo(() => {
    if (!isMock) {
      return null;
    }
    const keys = missingFirebaseConfigKeys.length ? missingFirebaseConfigKeys.join(', ') : 'Firebase credentials';
    return `Demo mode uses a local sample profile and nothing is persisted to Firebase. Add the missing ${keys} variables to enable real sign-in and cloud storage.`;
  }, [isMock]);

  const handleSubmit = async () => {
    if (!email || !password || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setSuccessMessage(null);
      await signIn(email.trim(), password);
    } catch (err) {
      console.warn('Sign-in failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && successMessage) {
    setSuccessMessage(null);
  }

  const handleResetPassword = async () => {
    if (!email || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      await requestPasswordReset(email.trim());
      setSuccessMessage('Password reset email sent. Check your inbox.');
    } catch (err) {
      console.warn('Password reset failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (error) {
      setSuccessMessage(null);
    }
  }, [error]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.gateContainer, { backgroundColor: background }]}
    >
      <ThemedView
        style={[
          styles.card,
          {
            backgroundColor: cardBackground,
            borderColor: cardBorder,
            borderWidth: StyleSheet.hairlineWidth,
            shadowColor: colorScheme === 'dark' ? '#000' : '#0a7ea4',
            shadowOpacity: colorScheme === 'dark' ? 0.35 : 0.15,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 12 },
            elevation: colorScheme === 'dark' ? 0 : 8
          }
        ]}
      >
        <ThemedText type="title">Sign in to continue</ThemedText>
        <ThemedText type="default">Use your school email to access Smart Attender.</ThemedText>
  {mockHint ? <ThemedText type="default" style={styles.noticeText}>{mockHint}</ThemedText> : null}

        <View style={styles.formGroup}>
          <ThemedText type="defaultSemiBold">Email</ThemedText>
          <TextInput
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="student@example.edu"
            onChangeText={setEmail}
            style={[styles.input, { borderColor: tint, color: textColor, backgroundColor: inputBackground }]}
            placeholderTextColor={placeholder}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText type="defaultSemiBold">Password</ThemedText>
          <TextInput
            value={password}
            secureTextEntry
            placeholder="Enter your password"
            onChangeText={setPassword}
            style={[styles.input, { borderColor: tint, color: textColor, backgroundColor: inputBackground }]}
            placeholderTextColor={placeholder}
          />
        </View>

        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

        {successMessage ? <ThemedText style={styles.successText}>{successMessage}</ThemedText> : null}

        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleSubmit}
          disabled={submitting || !email || !password}
          style={[
            styles.primaryButton,
            { backgroundColor: tint, opacity: submitting || !email || !password ? 0.7 : 1 }
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleResetPassword}
          disabled={submitting || !email}
        >
          <ThemedText type="link">Forgot password?</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

function FullScreenStatus({ message }: { message: string }) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const statusBackground = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[styles.gateContainer, { backgroundColor: palette.background }]}>
      <ThemedView style={[styles.statusCard, { backgroundColor: statusBackground }]}>
        <ActivityIndicator color={palette.tint} />
        <ThemedText type="defaultSemiBold">{message}</ThemedText>
      </ThemedView>
    </View>
  );
}

function DemoModeNotice({ onContinue }: { onContinue: () => void }) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const background = palette.background;
  const surface = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={[styles.gateContainer, { backgroundColor: background }]}> 
      <ThemedView style={[styles.card, { backgroundColor: surface }]}> 
        <ThemedText type="title">Demo mode active</ThemedText>
        <ThemedText type="default">
          You&apos;re seeing mock student data because Firebase credentials aren&apos;t configured yet. While in demo mode,
          sign-ins and attendance stay on this device only. Configure the missing
          {missingFirebaseConfigKeys.length ? ` ${missingFirebaseConfigKeys.join(', ')}` : ' Firebase keys'} and restart
          the app to enable real sign-in and cloud persistence.
        </ThemedText>
        <TouchableOpacity accessibilityRole="button" onPress={onContinue} style={[styles.primaryButton, { backgroundColor: palette.tint }]}
        >
          <ThemedText style={styles.primaryButtonText}>Continue in demo mode</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    gap: 16,
    borderRadius: 20
  },
  statusCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12
  },
  formGroup: {
    gap: 8
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  errorText: {
    color: '#ff6b6b'
  },
  noticeText: {
    opacity: 0.8
  },
  successText: {
    color: '#2e9d55'
  }
});
