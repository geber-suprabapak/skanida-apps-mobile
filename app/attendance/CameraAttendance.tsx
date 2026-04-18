import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useRef, useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  StyleSheet,
} from "react-native";
import { Text } from "~/components/ui/text";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";

import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import { ensureFaceApiConfigured } from "~/utils/secureConfig";
import { Icon } from "~/components/ui/icon";
import AttendanceSuccessPopup from "~/components/ui/pop-up";
import {
  Camera as CameraIcon,
  SwitchCamera,
  ArrowLeft,
  Loader2,
} from "lucide-react-native";
import { timeSync } from "~/utils/timeSync";
import useAuthStore from "~/store/authStore";
import {
  bytesInfo,
  elapsedMs,
  faceApiError,
  faceApiLog,
  faceApiWarn,
  parseFaceApiBody,
  responseDebugInfo,
  sessionDebugInfo,
  startFaceApiTimer,
} from "~/utils/faceApiDebug";
import { ensureFaceApiReady } from "~/utils/faceApiRuntime";

// --- CONSTANTS ---
const MAX_BASE64_SIZE_MB = 5;
const MAX_BASE64_SIZE_BYTES = MAX_BASE64_SIZE_MB * 1024 * 1024;
const FACE_API_TIMEOUT_MS = 30_000;

// --- TYPES AND INTERFACES ---
type CameraFacing = "front" | "back";
type ProcessStage = "verifying" | "saving";
type Coordinates = {
  latitude: number;
  longitude: number;
};

interface ProcessProgress {
  stage: ProcessStage;
  percentage: number;
  message: string;
}

interface FaceRecogResponse {
  status: string;
  student_id?: string;
  student_name?: string;
  confidence?: number;
  process_time_ms?: number;
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
    <View className="w-full h-2 bg-gray-700 rounded-full">
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

const getReadableError = (error: unknown, fallback = "Terjadi kesalahan.") => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
};

const sanitizeBase64 = (value: string) => value.replace(/[^A-Za-z0-9+/=]/g, "");

const getBase64ByteSize = (base64: string) => {
  const paddingLength = base64.match(/=+$/)?.[0]?.length ?? 0;
  return (base64.length * 3) / 4 - paddingLength;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// --- MAIN COMPONENT ---
const CameraAttendance = () => {
  // --- HOOKS ---
  const router = useRouter();
  const params = useLocalSearchParams<{
    actionType?: string | string[];
    latitude?: string | string[];
    longitude?: string | string[];
  }>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const permissionAttemptedRef = useRef(false);

  // --- STATE ---
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("front");
  const device = useCameraDevice(cameraFacing);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [successState, setSuccessState] = useState<{
    visible: boolean;
    time: string;
    processingTime: number;
    confidence?: number;
    serverProcessTime?: number;
    studentName?: string;
  }>({
    visible: false,
    time: "",
    processingTime: 0,
  });
  const [processProgress, setProcessProgress] = useState<ProcessProgress>({
    stage: "verifying",
    percentage: 0,
    message: "Menunggu proses...",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFaceResult, setLastFaceResult] = useState<FaceRecogResponse | null>(
    null,
  );

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

  // --- STORE & PARAMS ---
  const user = useAuthStore((state) => state.user);

  const actionType = useMemo<"check_in" | "check_out">(() => {
    const value = params.actionType;
    const candidate = Array.isArray(value) ? value[0] : value;
    if (candidate === "check_in" || candidate === "check_out") {
      return candidate;
    }
    return "check_in";
  }, [params.actionType]);

  const preFetchedLocation = useMemo<Coordinates | null>(() => {
    const resolveValue = (val?: string | string[]) =>
      Array.isArray(val) ? val[0] : val;

    const latString = resolveValue(params.latitude);
    const lonString = resolveValue(params.longitude);

    if (!latString || !lonString) {
      return null;
    }

    const latitude = Number(latString);
    const longitude = Number(lonString);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }, [params.latitude, params.longitude]);

  useEffect(() => {
    faceApiLog("attendance-camera:params", {
      actionType,
      rawParams: params,
      preFetchedLocation,
      userId: user?.id ?? null,
      cameraFacing,
    });
  }, [actionType, cameraFacing, params, preFetchedLocation, user?.id]);

  // --- FACE RECOGNITION API ---
  const verifyFaceWithServer = useCallback(
    async (base64Image: string): Promise<FaceRecogResponse> => {
      const startedAt = startFaceApiTimer();
      faceApiLog("identify:start", {
        base64Chars: base64Image.length,
        payloadSize: bytesInfo(getBase64ByteSize(base64Image)),
      });

      const runtime = await ensureFaceApiReady();
      faceApiLog("identify:runtime-ready", {
        message: runtime.message,
        readinessPath: runtime.info?.readinessPath ?? null,
        issues: runtime.issues,
      });

      await ensureSupabaseInitialized();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      faceApiLog("identify:session", sessionDebugInfo(session));

      if (!session) {
        faceApiWarn("identify:missing-session", {
          durationMs: elapsedMs(startedAt),
        });
        throw new Error("Sesi tidak valid. Silakan login ulang.");
      }

      const faceApiBaseUrl = await ensureFaceApiConfigured();
      const faceApiUrl = `${faceApiBaseUrl}/v1/identify`;

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        FACE_API_TIMEOUT_MS,
      );

      try {
        faceApiLog("identify:request", {
          method: "POST",
          url: faceApiUrl,
          timeoutMs: FACE_API_TIMEOUT_MS,
          headers: {
            "Content-Type": "application/json",
            Authorization: "[redacted bearer]",
          },
          body: {
            image_base64: "[redacted]",
            base64Chars: base64Image.length,
            estimatedSize: bytesInfo(getBase64ByteSize(base64Image)),
          },
        });

        const response = await fetch(faceApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ image_base64: base64Image }),
          signal: controller.signal,
        });

        const bodyText = await response.text();
        const parsedBody = parseFaceApiBody(bodyText);
        faceApiLog("identify:response", {
          durationMs: elapsedMs(startedAt),
          ...responseDebugInfo(response, parsedBody),
        });

        if (!response.ok) {
          const errData = isRecord(parsedBody) ? parsedBody : {};
          throw new Error(
            typeof errData.message === "string"
              ? errData.message
              : `Gagal verifikasi wajah (${response.status})`,
          );
        }

        if (!isRecord(parsedBody)) {
          throw new Error("Respons Face API tidak valid.");
        }

        return parsedBody as unknown as FaceRecogResponse;
      } catch (error: any) {
        if (error?.name === "AbortError") {
          faceApiError("identify:timeout", {
            durationMs: elapsedMs(startedAt),
            timeoutMs: FACE_API_TIMEOUT_MS,
            error,
          });
          throw new Error(
            "Permintaan verifikasi wajah melebihi batas waktu. Silakan coba lagi.",
          );
        }
        faceApiError("identify:failed", {
          durationMs: elapsedMs(startedAt),
          error,
        });
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [],
  );

  // --- MAIN PROCESS ---
  const processAttendance = useCallback(
    async (base64Image: string): Promise<void> => {
      if (!user) {
        faceApiWarn("attendance-process:missing-user", {
          actionType,
        });
        Alert.alert("Error", "Sesi pengguna tidak valid.");
        return;
      }

      if (!actionType) {
        faceApiWarn("attendance-process:missing-action-type", {
          userId: user.id,
        });
        Alert.alert("Error", "Data absensi tidak valid.");
        return;
      }

      const sanitizedBase64 = sanitizeBase64(base64Image);
      const payloadSizeBytes = getBase64ByteSize(sanitizedBase64);
      const startedAt = startFaceApiTimer();

      faceApiLog("attendance-process:start", {
        userId: user.id,
        actionType,
        rawBase64Chars: base64Image.length,
        sanitizedBase64Chars: sanitizedBase64.length,
        payloadSize: bytesInfo(payloadSizeBytes),
        hasPreFetchedLocation: Boolean(preFetchedLocation),
        preFetchedLocation,
      });

      if (payloadSizeBytes > MAX_BASE64_SIZE_BYTES) {
        faceApiWarn("attendance-process:payload-too-large", {
          maxSize: bytesInfo(MAX_BASE64_SIZE_BYTES),
          payloadSize: bytesInfo(payloadSizeBytes),
        });
        Alert.alert(
          "Error",
          `Ukuran data foto melebihi batas ${MAX_BASE64_SIZE_MB}MB. Silakan ambil ulang foto dengan pencahayaan lebih baik atau jarak lebih dekat.`,
        );
        return;
      }

      setIsProcessing(true);
      setLastFaceResult(null);
      const startTime = Date.now();

      try {
        // Step 1: Verify Face
        setProcessProgress({
          stage: "verifying",
          percentage: 30,
          message: "Memverifikasi wajah...",
        });

        const faceResult = await verifyFaceWithServer(sanitizedBase64);
        faceApiLog("attendance-process:identify-result", {
          durationMs: elapsedMs(startedAt),
          faceResult,
        });

        if (faceResult.status !== "ok") {
          throw new Error(faceResult.message || "Wajah tidak dikenali.");
        }

        // Step 2: Save to Database
        setProcessProgress({
          stage: "saving",
          percentage: 70,
          message: "Menyimpan data absensi...",
        });

        let resolvedLocation = preFetchedLocation;

        if (!resolvedLocation) {
          faceApiLog("attendance-process:location-fetch:start", {
            reason: "no-prefetched-location",
          });
          const latestLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          faceApiLog("attendance-process:location-fetch:result", {
            mocked: latestLocation.mocked,
            latitude: latestLocation.coords.latitude,
            longitude: latestLocation.coords.longitude,
            accuracy: latestLocation.coords.accuracy,
          });

          if (latestLocation.mocked) {
            throw new Error(
              "Terdeteksi lokasi palsu (mock location). Mohon matikan aplikasi fake GPS.",
            );
          }

          resolvedLocation = {
            latitude: latestLocation.coords.latitude,
            longitude: latestLocation.coords.longitude,
          };
        } else {
          faceApiLog("attendance-process:location-prefetched", {
            latitude: resolvedLocation.latitude,
            longitude: resolvedLocation.longitude,
          });
        }

        faceApiLog("attendance-process:save-rpc:request", {
          rpc: "save_attendance_record",
          params: {
            p_user_id: user.id,
            p_action_type: actionType,
            p_photo_path: null,
            p_latitude: resolvedLocation.latitude,
            p_longitude: resolvedLocation.longitude,
          },
        });

        const { data: saveData, error: saveError } = await supabase.rpc(
          "save_attendance_record",
          {
            p_user_id: user.id,
            p_action_type: actionType,
            p_photo_path: null,
            p_latitude: resolvedLocation.latitude,
            p_longitude: resolvedLocation.longitude,
          },
        );

        faceApiLog("attendance-process:save-rpc:response", {
          durationMs: elapsedMs(startedAt),
          data: saveData,
          error: saveError,
        });

        if (saveError || !saveData?.success) {
          throw new Error(
            `Gagal menyimpan data: ${
              saveError?.message || saveData?.message || "Respons tidak valid"
            }`,
          );
        }

        setProcessProgress({
          stage: "saving",
          percentage: 100,
          message: "Berhasil!",
        });

        const totalTime = Date.now() - startTime;
        faceApiLog("attendance-process:success", {
          totalTimeMs: totalTime,
          fullDurationMs: elapsedMs(startedAt),
          actionType,
          faceResult,
          saveData,
        });
        setLastFaceResult(faceResult);
        const currentTime = timeSync
          .getSyncedTime()
          .toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          });

        setSuccessState({
          visible: true,
          time: currentTime,
          processingTime: totalTime,
          confidence: faceResult.confidence,
          serverProcessTime: faceResult.process_time_ms,
          studentName: faceResult.student_name,
        });
      } catch (error: any) {
        faceApiError("attendance-process:failed", {
          durationMs: elapsedMs(startedAt),
          actionType,
          error,
        });
        Alert.alert(
          "Error",
          getReadableError(error, "Gagal memproses absensi."),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [user, actionType, verifyFaceWithServer, preFetchedLocation],
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

    let photoUri: string | null = null;
    const startedAt = startFaceApiTimer();
    faceApiLog("attendance-capture:start", {
      cameraFacing,
      actionType,
      snapshotQuality: 70,
    });

    try {
      // Use takeSnapshot for faster capture
      const snapshot = await cameraRef.current.takeSnapshot({
        quality: 70,
      });

      faceApiLog("attendance-capture:snapshot", {
        durationMs: elapsedMs(startedAt),
        hasPath: Boolean(snapshot?.path),
        path: snapshot?.path,
      });

      if (!snapshot?.path) {
        throw new Error("Failed to capture photo - no file path returned");
      }

      photoUri = snapshot.path.startsWith("file://")
        ? snapshot.path
        : `file://${snapshot.path}`;

      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      faceApiLog("attendance-capture:file-info", {
        exists: fileInfo.exists,
        uri: photoUri,
        size: fileInfo.exists ? bytesInfo(fileInfo.size || 0) : null,
      });

      // Read file as base64 directly (no compression)
      const rawBase64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const sanitizedBase64 = sanitizeBase64(rawBase64);
      const base64SizeBytes = getBase64ByteSize(sanitizedBase64);
      faceApiLog("attendance-capture:base64-ready", {
        rawChars: rawBase64.length,
        sanitizedChars: sanitizedBase64.length,
        payloadSize: bytesInfo(base64SizeBytes),
        maxPayloadSize: bytesInfo(MAX_BASE64_SIZE_BYTES),
      });

      if (base64SizeBytes > MAX_BASE64_SIZE_BYTES) {
        faceApiWarn("attendance-capture:base64-too-large", {
          payloadSize: bytesInfo(base64SizeBytes),
          maxPayloadSize: bytesInfo(MAX_BASE64_SIZE_BYTES),
        });
        Alert.alert(
          "Error",
          `Ukuran data foto melebihi ${MAX_BASE64_SIZE_MB}MB. Silakan ambil ulang foto.`,
        );
        return;
      }

      await processAttendance(sanitizedBase64);
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
      if (photoUri) {
        faceApiLog("attendance-capture:cleanup-temp-file", { photoUri });
        FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
      }
      setIsCapturingPhoto(false);
    }
  }, [isCameraReady, isCapturingPhoto, processAttendance, isProcessing]);

  const handleToggleCameraFacing = useCallback(() => {
    faceApiLog("attendance-camera:toggle-facing", {
      from: cameraFacing,
      to: cameraFacing === "front" ? "back" : "front",
    });
    setCameraFacing((current) => (current === "front" ? "back" : "front"));
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
            onPress: () => router.back(),
          },
        ],
      );
      return true;
    }

    return false;
  }, [isProcessing, router]);

  // --- EFFECTS ---
  useEffect(() => {
    if (!actionType) {
      Alert.alert("Error", "Data absensi tidak valid. Silakan coba lagi.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [actionType, router]);

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
  const permissionResolved = typeof hasPermission === "boolean";

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
        <View className="flex-1 items-center justify-center px-10">
          <Animated.View className="items-center justify-center">
            <Icon as={CameraIcon} className="size-20 text-[#0066FF]" />
            <Text variant="h2" className="text-white text-center mt-4 mb-2">
              Izinkan akses kamera
            </Text>
            <Text variant="default" className="text-white/80 text-center mb-8">
              Kami membutuhkan izin kamera untuk mengambil foto absensi Anda.
            </Text>
            <TouchableOpacity
              className="bg-[#0066FF] px-8 py-4 rounded-lg flex-row items-center"
              activeOpacity={0.7}
              onPress={requestCameraAccess}
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
        video
        enableZoomGesture
        onInitialized={handleCameraReady}
      />

      <AttendanceSuccessPopup
        visible={successState.visible}
        onClose={() => {
          setSuccessState((current) => ({ ...current, visible: false }));
          router.replace("/Dashboard");
        }}
        attendanceType={actionType}
        studentName={
          successState.studentName ||
          lastFaceResult?.student_name ||
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          ""
        }
        time={successState.time}
        processingTime={successState.processingTime}
        confidence={successState.confidence ?? lastFaceResult?.confidence}
        serverProcessTime={
          successState.serverProcessTime ?? lastFaceResult?.process_time_ms
        }
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
                className="w-10 h-10 rounded-full bg-[#0066FF] justify-center items-center shadow-lg"
                onPress={() => router.back()}
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                <Icon as={ArrowLeft} className="size-6 text-white" />
              </TouchableOpacity>
            </View>

            <View className="absolute bottom-12 left-0 right-0 flex-row justify-around items-center px-5">
              <TouchableOpacity
                className="w-16 h-16 rounded-full bg-black/50 justify-center items-center"
                onPress={handleToggleCameraFacing}
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
