import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { StudentProfile } from '@/services/student-profile';
import type { DeviceRegistration } from '@/services/device-trust';

interface ProfileOnboardingProps {
  studentId: string;
  accountEmail: string | null;
  profile: StudentProfile | null;
  device: DeviceRegistration | null;
  needsDetails: boolean;
  needsDeviceApproval: boolean;
  onSaveDetails: (updates: Partial<StudentProfile>) => Promise<void>;
  onSyncDevice: () => Promise<void>;
  onCompleted: () => void;
}

type OnboardingStep = 'details' | 'device';

export function ProfileOnboarding({
  profile,
  device,
  accountEmail,
  needsDetails,
  needsDeviceApproval,
  onSaveDetails,
  onSyncDevice,
  onCompleted
}: ProfileOnboardingProps) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const [step, setStep] = useState<OnboardingStep>(needsDetails ? 'details' : 'device');
  const [currentProfile, setCurrentProfile] = useState<StudentProfile | null>(profile);

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (needsDetails) {
      setStep('details');
    } else if (needsDeviceApproval) {
      setStep('device');
    } else {
      onCompleted();
    }
  }, [needsDetails, needsDeviceApproval, onCompleted]);

  if (!needsDetails && !needsDeviceApproval) {
    return null;
  }

  return step === 'details' ? (
    <DetailsStep
      paletteTint={palette.tint}
      profile={currentProfile}
      accountEmail={accountEmail}
      onSubmit={async (updates) => {
        await onSaveDetails(updates);
        setCurrentProfile((previous) => ({
          displayName: updates.displayName ?? previous?.displayName ?? null,
          email: accountEmail,
          photoURL: previous?.photoURL ?? null,
          studentNumber: updates.studentNumber ?? previous?.studentNumber ?? null,
          enrolledClasses: previous?.enrolledClasses ?? [],
          activeDeviceKey: previous?.activeDeviceKey ?? null,
          deviceApprovalState: previous?.deviceApprovalState ?? 'pending',
          deviceApprovalReason: previous?.deviceApprovalReason ?? null,
          deviceApprovalUpdatedAt: previous?.deviceApprovalUpdatedAt,
          createdAt: previous?.createdAt,
          updatedAt: new Date().toISOString(),
          profileCompletedAt: previous?.profileCompletedAt ?? null
        } satisfies StudentProfile));
        setStep('device');
      }}
    />
  ) : (
    <DeviceTrustStep paletteTint={palette.tint} device={device} onRefresh={onSyncDevice} />
  );
}

function DetailsStep({
  profile,
  paletteTint,
  accountEmail,
  onSubmit
}: {
  profile: StudentProfile | null;
  paletteTint: string;
  accountEmail: string | null;
  onSubmit: (updates: Partial<StudentProfile>) => Promise<void>;
}) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const cardBackground = colorScheme === 'dark' ? 'rgba(26,28,30,0.9)' : 'rgba(0,0,0,0.03)';
  const inputBackground = colorScheme === 'dark' ? 'rgba(236,237,238,0.12)' : '#fff';
  const inputTextColor = palette.text;
  const placeholderTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [studentNumber, setStudentNumber] = useState(profile?.studentNumber ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = displayName.trim().length > 1 && studentNumber.trim().length >= 3;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        displayName: displayName.trim(),
        studentNumber: studentNumber.trim(),
        email: accountEmail ?? profile?.email ?? null
      });
    } catch (err) {
      console.error('Failed to save profile details', err);
      setError('Unable to save your details. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <ThemedView style={[styles.card, { backgroundColor: cardBackground }]}> 
        <ThemedText type="title">Set up your profile</ThemedText>
        <ThemedText type="default">Tell us who you are before the first check-in.</ThemedText>

        <View style={styles.formGroup}>
          <ThemedText type="defaultSemiBold">Preferred name</ThemedText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Jordan Lee"
            placeholderTextColor={placeholderTextColor}
            style={[styles.input, { borderColor: paletteTint, backgroundColor: inputBackground, color: inputTextColor }]}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText type="defaultSemiBold">Student number</ThemedText>
          <TextInput
            value={studentNumber}
            onChangeText={setStudentNumber}
            placeholder="e.g. S1234567"
            autoCapitalize="characters"
            placeholderTextColor={placeholderTextColor}
            style={[styles.input, { borderColor: paletteTint, backgroundColor: inputBackground, color: inputTextColor }]}
          />
        </View>

        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          style={[styles.primaryButton, { backgroundColor: paletteTint, opacity: canSubmit ? 1 : 0.7 }]}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>}
        </Pressable>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

function DeviceTrustStep({
  device,
  paletteTint,
  onRefresh
}: {
  device: DeviceRegistration | null;
  paletteTint: string;
  onRefresh: () => Promise<void>;
}) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const [refreshing, setRefreshing] = useState(false);
  const [initialRequestMade, setInitialRequestMade] = useState(false);

  useEffect(() => {
    if (!device && !initialRequestMade) {
      setInitialRequestMade(true);
      onRefresh().catch(() => setInitialRequestMade(false));
    }
  }, [device, initialRequestMade, onRefresh]);

  const status = device?.approvalState ?? 'pending';
  const statusMeta = useMemo(() => {
    const successColor = colorScheme === 'dark' ? '#3dd68c' : '#047857';
    const dangerColor = colorScheme === 'dark' ? '#f26d6d' : '#b42318';
    const infoColor = palette.tint;
    const infoBackground = colorScheme === 'dark' ? 'rgba(10,126,164,0.18)' : 'rgba(10,126,164,0.12)';

    switch (status) {
      case 'approved':
        return {
          title: 'Device approved',
          description: 'This device is cleared to mark attendance.',
          tone: successColor,
          background: colorScheme === 'dark' ? 'rgba(12,128,96,0.18)' : 'rgba(12,128,96,0.12)'
        };
      case 'blocked':
        return {
          title: 'Device blocked',
          description: device?.approvalReason ?? 'This hardware cannot be used for attendance. Contact your administrator.',
          tone: dangerColor,
          background: colorScheme === 'dark' ? 'rgba(197,34,67,0.18)' : 'rgba(197,34,67,0.12)'
        };
      default:
        return {
          title: 'Waiting for approval',
          description:
            device?.approvalReason ??
            'Your institution needs to approve this device. Ask an administrator to review it in the Smart Attender console.',
          tone: infoColor,
          background: infoBackground
        };
    }
  }, [colorScheme, device?.approvalReason, palette, status]);

  const metadata = useMemo(() => {
    if (!device) {
      return null;
    }

    return [
      device.modelName ? `${device.modelName}` : null,
      device.platform ? `${device.platform}${device.osVersion ? ` ${device.osVersion}` : ''}` : null,
      device.deviceKey ? `Key: ${device.deviceKey}` : null
    ].filter(Boolean);
  }, [device]);

  const lastSyncedLabel = useMemo(() => {
    if (!device?.lastSyncedAt) {
      return null;
    }
    const timestamp = new Date(device.lastSyncedAt);
    if (Number.isNaN(timestamp.getTime())) {
      return null;
    }
    return `Last checked ${timestamp.toLocaleString()}`;
  }, [device?.lastSyncedAt]);

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    try {
      setRefreshing(true);
      await onRefresh();
    } catch (error) {
      console.warn('Device refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.deviceContainer, { backgroundColor: palette.background }]}> 
      <ThemedView style={[styles.deviceCard, { backgroundColor: statusMeta.background }]}> 
        <ThemedText type="title" style={[styles.deviceHeading, { color: statusMeta.tone }]}> 
          {statusMeta.title}
        </ThemedText>
        <ThemedText type="default" style={styles.deviceDescription}>
          {statusMeta.description}
        </ThemedText>

        {metadata?.length ? (
          <View style={styles.deviceMetaList}>
            {metadata.map((line) => (
              <ThemedText key={line} type="default" style={styles.deviceMetaText}>
                {line}
              </ThemedText>
            ))}
          </View>
        ) : null}

        {lastSyncedLabel ? (
          <ThemedText type="default" style={styles.deviceMetaHint}>
            {lastSyncedLabel}
          </ThemedText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleRefresh}
          style={[styles.primaryButton, { backgroundColor: paletteTint, marginTop: 16 }]}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Refresh status</ThemedText>
          )}
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.helperCard}> 
        <ThemedText type="defaultSemiBold">Why this matters</ThemedText>
        <ThemedText type="default" style={styles.helperText}>
          Each student can only check in from their approved device. This stops proxies from using emulators or duplicate
          hardware to mark attendance.
        </ThemedText>
        <ThemedText type="default" style={styles.helperText}>
          If this device stays pending, ask your administrator to approve it in the dashboard. They may need the device key
          shown above.
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 460,
    padding: 24,
    borderRadius: 24,
    gap: 16
  },
  formGroup: {
    width: '100%',
    gap: 8
  },
  input: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16
  },
  errorText: {
    color: '#d20f39',
    marginTop: 4
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  deviceContainer: {
    flex: 1,
    padding: 24,
    gap: 24,
    justifyContent: 'center'
  },
  deviceCard: {
    borderRadius: 24,
    padding: 24,
    gap: 16
  },
  deviceHeading: {
    fontSize: 24,
    fontWeight: '700'
  },
  deviceDescription: {
    fontSize: 16
  },
  deviceMetaList: {
    marginTop: 8,
    gap: 4
  },
  deviceMetaText: {
    fontSize: 15
  },
  deviceMetaHint: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.8
  },
  helperCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(17,24,28,0.04)',
    gap: 8
  },
  helperText: {
    fontSize: 14,
    opacity: 0.8
  }
});
