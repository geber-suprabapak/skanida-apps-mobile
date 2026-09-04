import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { useRouter, useLocalSearchParams, Stack, type Href } from "expo-router";
import { useRef, useState, useEffect, useCallback, memo } from "react";
import {
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  StyleSheet,
  Linking,
  AccessibilityInfo,
} from "react-native";
import { Text } from "~/components/ui/text";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "~/components/ui/icon";
import {
  Camera as CameraIcon,
  SwitchCamera,
  ArrowLeft,
  Loader2,
  Settings,
} from "lucide-react-native";
import {
  cancelAttendance,
  completeAttendance,
  type CompleteOutcome,
} from "~/features/attendance-workflow";
import {
  elapsedMs,
  faceApiError,
  faceApiLog,
  faceApiWarn,
  startFaceApiTimer,
} from "~/utils/faceApiDebug";

// --- TYPES AND INTERFACES ---
type CameraFacing = "front" | "back";
type ProcessStage = "verifying" | "saving";

interface ProcessProgress {
  stage: ProcessStage;
  percentage: number;
  message: string;
}

// --- MEMOIZED COMPONENTS ---
const ProgressBar = memo<{ percentage: number }>(({ percentage }) => {
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming(percentage, { duration: 500 });
  }, [percentage, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  return (
    <View className="w-full h-2 bg-white/20 rounded-full">
      <Animated.View
        className="h-full bg-[#0066FF] rounded-full"
        style={animatedStyle}
      />
    </View>
  );
});
ProgressBar.displayName = "ProgressBar";

const CaptureButton = memo<{
  isCapturing: boolean;
  isReady: boolean;
  isProcessing: boolean;
  onPress: () => void;
}>(({ isCapturing, isReady, isProcessing, onPress }) => (
  <Animated.View className="w-24 h-24 rounded-full bg-white/30 justify-center items-center">
    <TouchableOpacity
      className="w-20 h-20 rounded-full bg-white justify-center items-center"
      onPress={onPress}
      disabled={isCapturing || !isReady || isProcessing}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Ambil foto presensi"
      accessibilityHint="Ketuk dua kali untuk mengambil foto dan mencatat presensi"
      accessibilityState={{
        disabled: isCapturing || !isReady || isProcessing,
        busy: isCapturing || isProcessing,
      }}
    >
      {isCapturing ? (
        <ActivityIndicator size="large" color="#0066FF" />
      ) : (
        <View className="w-16 h-16 rounded-full bg-[#0066FF]" />
      )}
    </TouchableOpacity>
  </Animated.View>
));
CaptureButton.displayName = "CaptureButton";

const ProcessOverlay = memo<{
  message: string;
  percentage: number;
  spinnerStyle: any;
}>(({ message, percentage, spinnerStyle }) => (
  <View className="absolute inset-0 bg-black/80 justify-center items-center px-8">
    <Animated.View className="items-center justify-center w-full">
      <Animated.View style={spinnerStyle}>
        <Icon as={Loader2} className="size-8 text-[#0066FF]" />
      </Animated.View>
      <Text variant="h2" className="text-white mt-4 mb-2">
        Memproses absensi...
      </Text>
      <Text variant="default" className="text-white/70 text-center mb-8">
        {message}
      </Text>
      <ProgressBar percentage={percentage} />
      <Text variant="small" className="text-white/70 mt-2">
        {percentage}%
      </Text>
    </Animated.View>
  </View>
));
ProcessOverlay.displayName = "ProcessOverlay";

const CameraReadyOverlay = memo(() => (
  <View className="absolute inset-0 bg-black/70 justify-center items-center">
    <ActivityIndicator size="large" color="#0066FF" />
    <Text variant="default" className="text-white mt-3">
      Menyiapkan kamera...
    </Text>
  </View>
));
CameraReadyOverlay.displayName = "CameraReadyOverlay";

const messageForOutcome = (
  outcome: Extract<CompleteOutcome, { status: "failed" }>,
): string => {
  switch (outcome.code) {
    case "capture_missing":
      return "Failed to capture photo - no file path returned";
    case "payload_too_large":
      return "Ukuran data foto melebihi 5MB. Silakan ambil ulang foto.";
    case "fallback_mock_location":
      return "Terdeteksi lokasi palsu (mock location). Mohon matikan aplikasi fake GPS.";
    case "attempt_not_found":
      return "Data absensi tidak valid. Silakan coba lagi.";
    default:
      return "Gagal memproses absensi.";
  }
};

// --- MAIN COMPONENT ---
const CameraAttendance = () => {
  // --- HOOKS ---
  const router = useRouter();
  const safeAreaInsets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    attemptId?: string | string[];
  }>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const permissionAttemptedRef = useRef(false);
  const attemptId = Array.isArray(params.attemptId)
    ? params.attemptId[0]
    : params.attemptId;

  // --- STATE ---
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("front");
  const device = useCameraDevice(cameraFacing);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [processProgress, setProcessProgress] = useState<ProcessProgress>({
    stage: "verifying",
    percentage: 0,
    message: "Menunggu proses...",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const spinnerRotation = useSharedValue(0);

  useEffect(() => {
    if (isProcessing) {
      spinnerRotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false,
      );
    } else {
      spinnerRotation.value = 0;
    }
  }, [isProcessing, spinnerRotation]);

  const spinnerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinnerRotation.value}deg` }],
  }));

  useEffect(() => {
    faceApiLog("attendance-camera:params", {
      attemptId: attemptId ?? null,
      cameraFacing,
    });
  }, [attemptId, cameraFacing]);

  useEffect(
    () => () => {
      cancelAttendance(attemptId);
    },
    [attemptId],
  );

  // --- MAIN PROCESS ---
  const processAttendance = useCallback(
    async (snapshotPath: string | null | undefined): Promise<void> => {
      if (!attemptId) {
        Alert.alert("Error", "Data absensi tidak valid. Silakan coba lagi.");
        return;
      }

      const startedAt = startFaceApiTimer();
      setIsProcessing(true);
      setProcessProgress({
        stage: "verifying",
        percentage: 30,
        message: "Memverifikasi wajah...",
      });

      const outcome = await completeAttendance({
        attemptId,
        snapshotPath,
      });

      if (outcome.status === "submitted") {
        setProcessProgress({
          stage: "saving",
          percentage: 100,
          message: "Berhasil!",
        });
        AccessibilityInfo.announceForAccessibility(
          "Presensi berhasil dicatat.",
        );
        faceApiLog("attendance-process:success", {
          durationMs: elapsedMs(startedAt),
          attemptId,
          outcome,
        });
        // SAFETY: `/home` is supplied by the new `(tabs)/home.tsx` route; Expo's
        // generated typed-route cache is refreshed by Metro after file changes.
        router.replace("/home" as Href);
      } else if (outcome.status !== "cancelled") {
        const errorMsg = messageForOutcome(outcome);
        AccessibilityInfo.announceForAccessibility(
          `Presensi gagal: ${errorMsg}`,
        );
        faceApiError("attendance-process:failed", {
          durationMs: elapsedMs(startedAt),
          attemptId,
          code: outcome.code,
        });
        Alert.alert("Error", errorMsg);
      }

      setIsProcessing(false);
    },
    [attemptId, router],
  );

  // --- EVENT HANDLERS ---
  const requestCameraAccess = useCallback(async () => {
    permissionAttemptedRef.current = true;
    faceApiLog("attendance-camera:permission-request:start", {
      currentPermission: hasPermission,
    });

    try {
      const granted = await requestPermission();
      faceApiLog("attendance-camera:permission-request:result", { granted });

      if (!granted) {
        Alert.alert(
          "Izin Kamera Diperlukan",
          "Izinkan akses kamera untuk melanjutkan absensi.",
        );
      }

      return granted;
    } catch (error) {
      faceApiError("attendance-camera:permission-request:failed", { error });
      Alert.alert(
        "Error",
        "Gagal meminta izin kamera. Silakan coba lagi dari pengaturan.",
      );
      return false;
    }
  }, [hasPermission, requestPermission]);

  const handleCameraReady = useCallback(() => {
    faceApiLog("attendance-camera:ready", {
      device: device
        ? {
            id: device.id,
            name: device.name,
            position: device.position,
          }
        : null,
      cameraFacing,
    });
    AccessibilityInfo.announceForAccessibility(
      "Kamera siap. Posisikan wajah Anda di dalam bingkai.",
    );
    setIsCameraReady(true);
  }, [cameraFacing, device]);

  const handleTakePicture = useCallback(async () => {
    if (
      !isCameraReady ||
      !cameraRef.current ||
      isCapturingPhoto ||
      isProcessing
    ) {
      faceApiWarn("attendance-capture:blocked", {
        isCameraReady,
        hasCameraRef: Boolean(cameraRef.current),
        isCapturingPhoto,
        isProcessing,
      });
      return;
    }

    setIsCapturingPhoto(true);
    AccessibilityInfo.announceForAccessibility("Mengambil foto presensi...");
    const startedAt = startFaceApiTimer();
    faceApiLog("attendance-capture:start", {
      cameraFacing,
      attemptId: attemptId ?? null,
      snapshotQuality: 70,
    });

    try {
      const snapshot = await cameraRef.current.takeSnapshot({
        quality: 70,
      });

      const finalPhotoPath = snapshot?.path;

      faceApiLog("attendance-capture:snapshot", {
        durationMs: elapsedMs(startedAt),
        hasPath: Boolean(finalPhotoPath),
        path: finalPhotoPath,
      });

      await processAttendance(finalPhotoPath);
    } catch (error) {
      faceApiError("attendance-capture:failed", {
        durationMs: elapsedMs(startedAt),
        error,
      });
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengambil foto. Silakan coba lagi.",
      );
    } finally {
      setIsCapturingPhoto(false);
    }
  }, [
    attemptId,
    cameraFacing,
    isCameraReady,
    isCapturingPhoto,
    isProcessing,
    processAttendance,
  ]);

  const handleToggleCameraFacing = useCallback(() => {
    const nextFacing = cameraFacing === "front" ? "back" : "front";
    AccessibilityInfo.announceForAccessibility(
      nextFacing === "front"
        ? "Beralih ke kamera depan"
        : "Beralih ke kamera belakang",
    );
    faceApiLog("attendance-camera:toggle-facing", {
      from: cameraFacing,
      to: nextFacing,
    });
    setCameraFacing(nextFacing);
  }, [cameraFacing]);

  const handleBackPress = useCallback(() => {
    if (isProcessing) {
      Alert.alert(
        "Proses Sedang Berlangsung",
        "Absensi sedang diproses. Apakah Anda yakin ingin kembali?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Kembali",
            style: "destructive",
            onPress: () => {
              cancelAttendance(attemptId);
              router.back();
            },
          },
        ],
      );
      return true;
    }

    return false;
  }, [attemptId, isProcessing, router]);

  // --- EFFECTS ---
  useEffect(() => {
    if (!attemptId) {
      Alert.alert("Error", "Data absensi tidak valid. Silakan coba lagi.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [attemptId, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    return () => backHandler.remove();
  }, [handleBackPress]);

  useEffect(() => {
    if (hasPermission === false && !permissionAttemptedRef.current) {
      requestCameraAccess();
    }
  }, [hasPermission, requestCameraAccess]);

  // --- RENDER HELPERS ---
  const FullScreenMessage = memo<{ message: string }>(({ message }) => (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator size="large" color="#0066FF" />
        <Text variant="large" className="text-white text-center mt-4">
          {message}
        </Text>
      </View>
    </SafeAreaView>
  ));
  FullScreenMessage.displayName = "FullScreenMessage";

  // --- MAIN RENDER ---
  const permissionResolved = hasPermission === true || hasPermission === false;

  if (!permissionResolved) {
    return <FullScreenMessage message="Memeriksa izin kamera..." />;
  }

  if (!hasPermission) {
    return (
      <SafeAreaView
        className="flex-1 bg-black"
        edges={["top", "left", "right"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View className="px-4 py-2">
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-neutral-800 justify-center items-center shadow-lg"
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
          >
            <Icon as={ArrowLeft} className="size-6 text-white" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-10">
          <Animated.View className="items-center justify-center w-full">
            <Icon as={CameraIcon} className="size-20 text-[#0066FF]" />
            <Text variant="h2" className="text-white text-center mt-4 mb-2">
              Izinkan akses kamera
            </Text>
            <Text variant="default" className="text-white/80 text-center mb-8">
              Kami membutuhkan izin kamera untuk mengambil foto absensi Anda.
            </Text>
            <TouchableOpacity
              className="bg-[#0066FF] px-8 py-4 rounded-lg flex-row items-center mb-3 w-full justify-center"
              activeOpacity={0.7}
              onPress={() => {
                Linking.openSettings().catch(() => {
                  Alert.alert(
                    "Pengaturan tidak dapat dibuka",
                    "Buka pengaturan perangkat secara manual untuk mengaktifkan izin kamera.",
                  );
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Buka Pengaturan Aplikasi"
              accessibilityHint="Membuka menu pengaturan perangkat untuk mengaktifkan izin kamera"
            >
              <Icon as={Settings} className="size-6 text-white" />
              <Text variant="default" className="text-white font-bold ml-2">
                Buka Pengaturan Aplikasi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-neutral-800 px-8 py-4 rounded-lg flex-row items-center w-full justify-center"
              activeOpacity={0.7}
              onPress={requestCameraAccess}
              accessibilityRole="button"
              accessibilityLabel="Beri izin kamera"
            >
              <Icon as={CameraIcon} className="size-6 text-white" />
              <Text variant="default" className="text-white font-bold ml-2">
                Beri izin kamera
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return <FullScreenMessage message="Menyiapkan kamera perangkat..." />;
  }

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!isProcessing}
        photo
        enableZoomGesture
        onInitialized={handleCameraReady}
      />

      <View className="absolute inset-0" pointerEvents="box-none">
        <SafeAreaView
          className="absolute inset-0"
          edges={["top", "left", "right"]}
          pointerEvents="box-none"
        >
          <View className="flex-1">
            <View className="w-full h-10" />

            <View className="flex-row items-center justify-between px-4">
              <TouchableOpacity
                className="w-12 h-12 rounded-full bg-[#0066FF] justify-center items-center shadow-lg"
                onPress={() => router.back()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Kembali"
                accessibilityHint="Ketuk dua kali untuk kembali ke beranda"
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                <Icon as={ArrowLeft} className="size-6 text-white" />
              </TouchableOpacity>
            </View>

            <View
              className="absolute left-0 right-0 flex-row justify-around items-center px-5"
              style={{ bottom: Math.max(24, safeAreaInsets.bottom + 12) }}
            >
              <TouchableOpacity
                className="w-16 h-16 rounded-full bg-black/50 justify-center items-center"
                onPress={handleToggleCameraFacing}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Ganti kamera"
                accessibilityHint="Ketuk dua kali untuk beralih antara kamera depan dan belakang"
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                <Icon as={SwitchCamera} className="size-7 text-white" />
              </TouchableOpacity>

              <CaptureButton
                isCapturing={isCapturingPhoto}
                isReady={isCameraReady}
                isProcessing={isProcessing}
                onPress={handleTakePicture}
              />

              <View className="w-16 h-16" />
            </View>
          </View>
        </SafeAreaView>
      </View>

      {!isCameraReady && <CameraReadyOverlay />}

      {isProcessing && (
        <ProcessOverlay
          message={processProgress.message}
          percentage={processProgress.percentage}
          spinnerStyle={spinnerAnimatedStyle}
        />
      )}
    </View>
  );
};

export default CameraAttendance;
