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
import {
  Camera as CameraIcon,
  SwitchCamera,
  ArrowLeft,
  Loader2,
} from "lucide-react-native";
import { timeSync } from "~/utils/timeSync";
import useAuthStore from "~/store/authStore";

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

  // --- STORE & PARAMS ---
  const { user } = useAuthStore();

  const actionType = useMemo<"check_in" | "check_out" | null>(() => {
    const value = params.actionType;
    const candidate = Array.isArray(value) ? value[0] : value;
    if (candidate === "check_in" || candidate === "check_out") {
      return candidate;
    }
    return null;
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

  // --- FACE RECOGNITION API ---
  const verifyFaceWithServer = useCallback(
    async (base64Image: string): Promise<FaceRecogResponse> => {
      await ensureSupabaseInitialized();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
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
        const response = await fetch(faceApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ image_base64: base64Image }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.message || `Gagal verifikasi wajah (${response.status})`,
          );
        }

        return response.json();
      } catch (error: any) {
        if (error?.name === "AbortError") {
          throw new Error(
            "Permintaan verifikasi wajah melebihi batas waktu. Silakan coba lagi.",
          );
        }
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
        Alert.alert("Error", "Sesi pengguna tidak valid.");
        return;
      }

      if (!actionType) {
        Alert.alert("Error", "Data absensi tidak valid.");
        return;
      }

      const sanitizedBase64 = sanitizeBase64(base64Image);
      const payloadSizeBytes = getBase64ByteSize(sanitizedBase64);

      if (payloadSizeBytes > MAX_BASE64_SIZE_BYTES) {
        Alert.alert(
          "Error",
          `Ukuran data foto melebihi batas ${MAX_BASE64_SIZE_MB}MB. Silakan ambil ulang foto dengan pencahayaan lebih baik atau jarak lebih dekat.`,
        );
        return;
      }

      setIsProcessing(true);
      const startTime = Date.now();

      try {
        // Step 1: Verify Face
        setProcessProgress({
          stage: "verifying",
          percentage: 30,
          message: "Memverifikasi wajah...",
        });

        const faceResult = await verifyFaceWithServer(sanitizedBase64);

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
          const latestLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          resolvedLocation = {
            latitude: latestLocation.coords.latitude,
            longitude: latestLocation.coords.longitude,
          };
        }

        const { data: saveData, error: saveError } = await supabase.rpc(
          "save_attendance_record",
          {
            p_user_id: user.id,
            p_action_type: actionType,
            p_photo_path: "",
            p_latitude: resolvedLocation.latitude,
            p_longitude: resolvedLocation.longitude,
          },
        );

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
        const currentTime = timeSync
          .getSyncedTime()
          .toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          });

        router.replace({
          pathname: "/Dashboard",
          params: {
            showSuccessPopup: "true",
            attendanceType: actionType,
            successTime: currentTime,
            processingTime: totalTime.toString(),
          },
        });
      } catch (error: any) {
        Alert.alert(
          "Error",
          getReadableError(error, "Gagal memproses absensi."),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [user, actionType, verifyFaceWithServer, router, preFetchedLocation],
  );

  // --- EVENT HANDLERS ---
  const requestCameraAccess = useCallback(async () => {
    permissionAttemptedRef.current = true;

    try {
      const granted = await requestPermission();

      if (!granted) {
        Alert.alert(
          "Izin Kamera Diperlukan",
          "Izinkan akses kamera untuk melanjutkan absensi.",
        );
      }

      return granted;
    } catch {
      Alert.alert(
        "Error",
        "Gagal meminta izin kamera. Silakan coba lagi dari pengaturan.",
      );
      return false;
    }
  }, [requestPermission]);

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  const handleTakePicture = useCallback(async () => {
    if (
      !isCameraReady ||
      !cameraRef.current ||
      isCapturingPhoto ||
      isProcessing
    ) {
      return;
    }

    setIsCapturingPhoto(true);

    let photoUri: string | null = null;

    try {
      // Use takeSnapshot for faster capture
      const snapshot = await cameraRef.current.takeSnapshot({
        quality: 70,
      });

      if (!snapshot?.path) {
        throw new Error("Failed to capture photo - no file path returned");
      }

      photoUri = snapshot.path.startsWith("file://")
        ? snapshot.path
        : `file://${snapshot.path}`;

      // Read file as base64 directly (no compression)
      const rawBase64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const sanitizedBase64 = sanitizeBase64(rawBase64);
      const base64SizeBytes = getBase64ByteSize(sanitizedBase64);

      if (base64SizeBytes > MAX_BASE64_SIZE_BYTES) {
        Alert.alert(
          "Error",
          `Ukuran data foto melebihi ${MAX_BASE64_SIZE_MB}MB. Silakan ambil ulang foto.`,
        );
        return;
      }

      await processAttendance(sanitizedBase64);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengambil foto. Silakan coba lagi.",
      );
    } finally {
      if (photoUri) {
        FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
      }
      setIsCapturingPhoto(false);
    }
  }, [isCameraReady, isCapturingPhoto, processAttendance, isProcessing]);

  const handleToggleCameraFacing = useCallback(() => {
    setCameraFacing((current) => (current === "front" ? "back" : "front"));
  }, []);

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
        video={true}
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
