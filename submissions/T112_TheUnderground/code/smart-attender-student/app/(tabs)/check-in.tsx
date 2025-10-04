import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Navbar } from '@/components/navbar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { useAuth } from '@/providers/AuthProvider';
import {
  parseQrPayload,
  recordAttendance,
  resolveSessionFromPayload,
  type ResolvedSession
} from '@/services/attendance';

interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

type CheckInStep = 'scan' | 'confirm';

type DeviceStatusVariant = 'approved' | 'pending' | 'blocked';

type StatusMeta = {
  label: string;
  description: string;
  tint: string;
  background: string;
};

const STEP_LABELS: Record<CheckInStep, string> = {
  scan: 'Scan classroom QR code',
  confirm: 'Confirm class details'
};

export default function CheckInScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user, isMock } = useAuth();
  const {
    loading: profileLoading,
    profile,
    device,
    needsDeviceApproval,
    syncDevice
  } = useStudentProfile();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<CheckInStep>('scan');
  const [pendingSession, setPendingSession] = useState<ResolvedSession | null>(null);
  const [pendingLocation, setPendingLocation] = useState<CapturedLocation | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceSyncing, setDeviceSyncing] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);

  const palette = Colors[colorScheme ?? 'light'];
  const tint = palette.tint;
  const backgroundColor = palette.background;
  const primaryButtonColor = colorScheme === 'dark' ? '#0a7ea4' : tint;
  const cardBackground = colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)';
  const overlayBackground = 'rgba(0,0,0,0.35)';
  const signedInLabel = user?.displayName ?? user?.email ?? (isMock ? 'Demo student' : 'Student');

  const deviceStatusVariant: DeviceStatusVariant = useMemo(() => {
    if (!device) {
      return 'pending';
    }

    if (device.approvalState === 'blocked') {
      return 'blocked';
    }

    if (device.approvalState === 'approved') {
      return 'approved';
    }

    return 'pending';
  }, [device]);

  const deviceStatusMeta = useMemo<StatusMeta>(() => {
    const successColor = colorScheme === 'dark' ? '#3dd68c' : '#047857';
    const dangerColor = colorScheme === 'dark' ? '#f26d6d' : '#b42318';
    const infoColor = palette.tint;
    const infoBackground = colorScheme === 'dark' ? 'rgba(10,126,164,0.18)' : 'rgba(10,126,164,0.12)';

    switch (deviceStatusVariant) {
      case 'approved':
        return {
          label: 'Device approved',
          description: 'This device is cleared to submit attendance.',
          tint: successColor,
          background: colorScheme === 'dark' ? 'rgba(12,128,96,0.18)' : 'rgba(12,128,96,0.12)'
        } satisfies StatusMeta;
      case 'blocked':
        return {
          label: 'Device blocked',
          description: device?.approvalReason ?? 'Contact your administrator to use a different device.',
          tint: dangerColor,
          background: colorScheme === 'dark' ? 'rgba(197,34,67,0.18)' : 'rgba(197,34,67,0.12)'
        } satisfies StatusMeta;
      default:
        return {
          label: 'Waiting for approval',
          description:
            device?.approvalReason ??
            'Ask your administrator to approve this hardware in the Smart Attender console.',
          tint: infoColor,
          background: infoBackground
        } satisfies StatusMeta;
    }
  }, [colorScheme, device?.approvalReason, deviceStatusVariant, palette.tint]);

  const deviceApproved = deviceStatusVariant === 'approved' && !needsDeviceApproval;

  const resetWorkflow = useCallback(() => {
    setStep('scan');
    setPendingSession(null);
    setPendingLocation(null);
    setLastScanned(null);
    setError(null);
    setCameraFacing('back');
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    if (!cameraPermission?.granted && cameraPermission?.canAskAgain) {
      requestCameraPermission().catch(() => undefined);
    }
  }, [cameraPermission, requestCameraPermission]);

  useFocusEffect(
    useCallback(() => {
      resetWorkflow();

      return () => {
        setIsProcessing(false);
      };
    }, [resetWorkflow])
  );

  const ensureLocationPermission = useCallback(async () => {
    if (locationPermission?.granted) {
      return locationPermission;
    }

    const result = await requestLocationPermission?.();
    if (!result?.granted) {
      throw new Error('Location permission is required to submit attendance.');
    }
    return result;
  }, [locationPermission, requestLocationPermission]);

  const handleBarcodeScanned = useCallback(
    async (scan: BarcodeScanningResult) => {
      if (step !== 'scan' || isProcessing || !scan?.data) {
        return;
      }

      if (scan.data === lastScanned) {
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const payload = parseQrPayload(scan.data);
        const resolvedSession = await resolveSessionFromPayload(payload);

        await ensureLocationPermission();
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

        const locationSnapshot: CapturedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null
        };

        setPendingSession(resolvedSession);
        setPendingLocation(locationSnapshot);
        setLastScanned(scan.data);
        setStep('confirm');
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unable to process this QR code.');
      } finally {
        setIsProcessing(false);
      }
    },
    [ensureLocationPermission, isProcessing, lastScanned, step]
  );

  const handleRefreshDevice = useCallback(async () => {
    if (deviceSyncing) {
      return;
    }

    try {
      setDeviceSyncing(true);
      await syncDevice();
    } catch (err) {
      console.warn('Failed to refresh device registration', err);
      setError('Unable to refresh device status. Try again shortly.');
    } finally {
      setDeviceSyncing(false);
    }
  }, [deviceSyncing, syncDevice]);

  const handleSubmitAttendance = useCallback(async () => {
    if (!pendingSession || !pendingLocation || !user || isProcessing) {
      return;
    }

    if (!deviceApproved) {
      setError('This device must be approved before you can submit attendance.');
      return;
    }

    if (!device) {
      setError('Unable to verify this device. Refresh status and try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await recordAttendance({
        student: user,
        session: pendingSession,
        studentLocation: pendingLocation,
        device,
        profile
      });

      router.push({
        pathname: '/modal',
        params: {
          status: result.status,
          message: result.message,
          proximity: Number.isFinite(result.proximityMeters)
            ? result.proximityMeters.toString()
            : undefined,
          notes: result.notes.join('|'),
          className: pendingSession.session.className,
          subject: pendingSession.session.subject
        }
      } as never);

      resetWorkflow();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to record attendance right now.');
    } finally {
      setIsProcessing(false);
    }
  }, [device, deviceApproved, isProcessing, pendingLocation, pendingSession, profile, resetWorkflow, router, user]);

  const statusLabel = useMemo(() => {
    if (step === 'scan') {
      return isProcessing ? 'Processing QR…' : 'Ready to scan';
    }

    return isProcessing ? 'Submitting attendance…' : 'Review and submit your check-in.';
  }, [isProcessing, step]);

  if (profileLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor }]}> 
        <ThemedView style={styles.loadingContainer}> 
          <ActivityIndicator size="large" color={tint} />
          <ThemedText type="default">Preparing your profile…</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (!cameraPermission?.granted) {
    return (
      <PermissionPrompt
        title="Camera access needed"
        description="We need camera access to scan the classroom QR code."
        actionLabel="Grant camera access"
        onAction={() => requestCameraPermission?.()}
      />
    );
  }

  if (!locationPermission?.granted && locationPermission?.status !== Location.PermissionStatus.UNDETERMINED) {
    return (
      <PermissionPrompt
        title="Location access needed"
        description="Location data helps verify you're near the classroom."
        actionLabel="Grant location access"
        onAction={() => requestLocationPermission?.()}
      />
    );
  }

  const actionsLayout = step === 'scan' ? styles.actionsRow : styles.actionsColumn;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top', 'left', 'right']}>
      <ThemedView style={styles.screen}>
        <Navbar subtitle="Scan your classroom QR code, confirm the class, then submit attendance." />
        <View style={styles.cameraContainer}>
          {step === 'confirm' && pendingSession ? (
            <ThemedView style={[styles.sessionCard, { backgroundColor: cardBackground }]}> 
              <ThemedText type="title">{pendingSession.session.className}</ThemedText>
              <ThemedText type="default">{formatSessionTime(pendingSession.session.scheduledFor)}</ThemedText>
              <ThemedText type="default">
                Teacher: {pendingSession.session.teacherId}
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                facing={cameraFacing}
                style={styles.camera}
                barcodeScannerSettings={step === 'scan' ? { barcodeTypes: ['qr'] } : undefined}
                onBarcodeScanned={step === 'scan' ? handleBarcodeScanned : undefined}
              />
              <View style={[styles.overlay, { backgroundColor: overlayBackground }]}> 
                <ThemedText type="defaultSemiBold">Scan the QR code</ThemedText>
                <ThemedText>Position the QR within the frame to capture it.</ThemedText>
                <ThemedText>We’ll confirm your location when you submit.</ThemedText>
              </View>
            </View>
          )}
        </View>

        <ThemedView style={[styles.infoCard, { backgroundColor: cardBackground }]}> 
          <View style={styles.statusRow}>
            <ThemedText type="defaultSemiBold">{STEP_LABELS[step]}</ThemedText>
            <StatusIndicator active={isProcessing} label={statusLabel} tint={tint} />
          </View>
          <ThemedText type="default" style={styles.accountHint}>
            Signed in as {signedInLabel}
          </ThemedText>

          {step === 'confirm' ? (
            <View style={styles.confirmDetails}>
              <View style={[styles.deviceStatusCard, { borderColor: deviceStatusMeta.tint, backgroundColor: deviceStatusMeta.background }]}> 
                <ThemedText type="defaultSemiBold" style={[styles.deviceStatusLabel, { color: deviceStatusMeta.tint }]}> 
                  {deviceStatusMeta.label}
                </ThemedText>
                <ThemedText type="default" style={styles.deviceStatusDescription}>
                  {deviceStatusMeta.description}
                </ThemedText>
                {device?.modelName ? (
                  <ThemedText type="default" style={styles.deviceStatusMeta}>
                    {device.modelName} • {device.platform}
                    {device.osVersion ? ` ${device.osVersion}` : ''}
                  </ThemedText>
                ) : null}
                {device?.deviceKey ? (
                  <ThemedText type="default" style={styles.deviceStatusMeta}>
                    Device key: {device.deviceKey}
                  </ThemedText>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  style={[styles.secondaryButton, { borderColor: tint }]}
                  onPress={handleRefreshDevice}
                  disabled={deviceSyncing}
                >
                  <ThemedText type="defaultSemiBold" style={[styles.secondaryLabel, { color: tint }]}>
                    {deviceSyncing ? 'Refreshing…' : 'Refresh device status'}
                  </ThemedText>
                </Pressable>
              </View>

              {pendingLocation ? (
                <View style={styles.locationBlock}>
                  <ThemedText type="defaultSemiBold">Captured location</ThemedText>
                  <ThemedText type="default">
                    {pendingLocation.latitude.toFixed(5)}, {pendingLocation.longitude.toFixed(5)}
                  </ThemedText>
                  {pendingLocation.accuracy ? (
                    <ThemedText type="default" style={styles.locationMeta}>
                      Accuracy ±{Math.round(pendingLocation.accuracy)} m
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}

              {!deviceApproved ? (
                <ThemedText type="default" style={styles.warningText}>
                  This device must be approved before submitting attendance.
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <View style={actionsLayout}>
            {step === 'scan' ? (
              <>
                <Pressable
                  style={[styles.button, { borderColor: tint }]}
                  onPress={() => setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))}
                >
                  <ThemedText type="defaultSemiBold">Flip camera</ThemedText>
                </Pressable>
                {!locationPermission?.granted && (
                  <Pressable style={[styles.button, { borderColor: tint }]} onPress={() => requestLocationPermission?.()}>
                    <ThemedText type="defaultSemiBold">Enable location</ThemedText>
                  </Pressable>
                )}
              </>
            ) : null}

            {step === 'confirm' ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.fullWidthButton,
                    styles.primaryAction,
                    (!deviceApproved || isProcessing) ? styles.disabledButton : null,
                    { backgroundColor: pressed ? primaryButtonColor + 'cc' : primaryButtonColor }
                  ]}
                  onPress={handleSubmitAttendance}
                  disabled={!deviceApproved || isProcessing}
                >
                  <ThemedText type="defaultSemiBold" style={styles.primaryLabel} lightColor="#ffffff" darkColor="#ffffff">
                    {isProcessing ? 'Submitting…' : 'Submit attendance'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.fullWidthButton, { borderColor: tint }, isProcessing ? styles.disabledButton : null]}
                  disabled={isProcessing}
                  onPress={resetWorkflow}
                >
                  <ThemedText type="defaultSemiBold">Rescan QR</ThemedText>
                </Pressable>
              </>
            ) : null}
          </View>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

interface PermissionPromptProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

function PermissionPrompt({ title, description, actionLabel, onAction }: PermissionPromptProps) {
  return (
    <ThemedView style={styles.permissionContainer}> 
      <ThemedText type="title" style={styles.permissionTitle}>
        {title}
      </ThemedText>
      <ThemedText style={styles.permissionDescription}>{description}</ThemedText>
      <Pressable style={styles.permissionButton} onPress={onAction}>
        <ThemedText type="defaultSemiBold" style={styles.permissionButtonLabel}>
          {actionLabel}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function StatusIndicator({ active, label, tint }: { active: boolean; label: string; tint: string }) {
  return (
    <View style={styles.statusIndicator}>
      {active && <ActivityIndicator size="small" color={tint} />}
      <ThemedText>{label}</ThemedText>
    </View>
  );
}

function formatSessionTime(rawValue?: string) {
  if (!rawValue) {
    return 'Scheduled time unavailable';
  }

  try {
    const parsedDate = parseISO(rawValue);
    return format(parsedDate, 'EEE, MMM d · h:mm a');
  } catch {
    return rawValue;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  screen: {
    flex: 1,
    padding: 16,
    gap: 16
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden'
  },
  cameraWrapper: {
    flex: 1
  },
  camera: {
    flex: 1
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 6
  },
  sessionCard: {
    flex: 1,
    borderRadius: 24,
    padding: 24,
    justifyContent: 'center',
    gap: 12
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    gap: 16
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  accountHint: {
    fontSize: 13,
    opacity: 0.8
  },
  confirmDetails: {
    gap: 16
  },
  deviceStatusCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1.5
  },
  deviceStatusLabel: {
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  deviceStatusDescription: {
    fontSize: 14
  },
  deviceStatusMeta: {
    fontSize: 13,
    opacity: 0.85
  },
  locationBlock: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: 'rgba(10,126,164,0.12)'
  },
  locationMeta: {
    fontSize: 12,
    opacity: 0.75
  },
  warningText: {
    color: '#b42318',
    fontSize: 13
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12
  },
  actionsColumn: {
    flexDirection: 'column',
    gap: 12
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5
  },
  fullWidthButton: {
    width: '100%'
  },
  primaryAction: {
    borderColor: 'transparent'
  },
  primaryLabel: {
    textAlign: 'center',
    color: '#fff'
  },
  disabledButton: {
    opacity: 0.65
  },
  errorText: {
    color: '#ff5d5d'
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16
  },
  permissionTitle: {
    textAlign: 'center'
  },
  permissionDescription: {
    textAlign: 'center'
  },
  permissionButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12
  },
  permissionButtonLabel: {
    color: '#fff'
  },
  statusIndicator: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5
  },
  secondaryLabel: {
    textAlign: 'center'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  }
});
