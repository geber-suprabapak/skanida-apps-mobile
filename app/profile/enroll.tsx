import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { useRouter, Stack } from "expo-router";
import { useRef, useState, useEffect, useCallback, memo } from "react";
import {
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  StyleSheet,
  AccessibilityInfo,
  Linking,
} from "react-native";
import { Text } from "~/components/ui/text";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";

import {
  bytesInfo,
  elapsedMs,
  faceApiError,
  faceApiLog,
  faceApiWarn,
  startFaceApiTimer,
} from "~/utils/faceApiDebug";
import {
  fetchFaceApiRuntimeStatus,
  type FaceApiRuntimeStatusResult,
} from "~/utils/faceApiRuntime";
import { submitEnrollment } from "~/utils/bffMobileApi";
import { Icon } from "~/components/ui/icon";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Camera as CameraIcon,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Upload,
  Settings,
} from "lucide-react-native";

// --- CONSTANTS ---
const REQUIRED_IMAGES = 10;
const MAX_IMAGE_SIZE_MB = 2;
const SNAPSHOT_QUALITY = 60; // Lower quality for smaller file size

// --- TYPES ---
type EnrollmentStep = "capture" | "confirm" | "uploading" | "success" | "error";

interface CapturedImage {
  uri: string;
  size: number;
}

interface EnrollmentSuccessResponse {
  status: "success";
  message: string;
  student_id: string;
  images_processed: number;
  images_failed: number;
  total_embeddings: number;
}

type FormDataFilePart = {
  uri: string;
  name: string;
  type: string;
};

// --- UTILITY FUNCTIONS ---
const getReadableError = (
  cause: unknown,
  fallback = "Terjadi kesalahan.",
): string => {
  if (cause instanceof Error) return cause.message;
  if (Object.prototype.toString.call(cause) === "[object String]") {
    return String(cause);
  }
  if (
    cause !== null &&
    cause !== undefined &&
    Object.prototype.hasOwnProperty.call(cause, "message")
  ) {
    // SAFETY: Verified property existence before reading message property.
    const message = (cause as { message?: unknown }).message;
    if (Object.prototype.toString.call(message) === "[object String]") {
      return String(message);
    }
  }
  return fallback;
};

// --- MEMOIZED COMPONENTS ---
const ProgressCounter = memo<{ current: number; total: number }>(
  ({ current, total }) => (
    <View className="bg-black/60 px-4 py-2 rounded-full">
      <Text variant="h2" className="text-white text-center">
        {current}/{total}
      </Text>
    </View>
  ),
);
ProgressCounter.displayName = "ProgressCounter";

const CaptureButton = memo<{
  isCapturing: boolean;
  isReady: boolean;
  onPress: () => void;
  disabled: boolean;
}>(({ isCapturing, isReady, onPress, disabled }) => (
  <Animated.View className="w-24 h-24 rounded-full bg-white/30 justify-center items-center">
    <TouchableOpacity
      className="w-20 h-20 rounded-full bg-white justify-center items-center"
      onPress={onPress}
      disabled={isCapturing || !isReady || disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Ambil foto wajah"
      accessibilityHint="Ketuk dua kali untuk mengambil satu sampel foto wajah"
      accessibilityState={{
        disabled: isCapturing || !isReady || disabled,
        busy: isCapturing,
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

const UploadingOverlay = memo<{ message: string; spinnerStyle: any }>(
  ({ message, spinnerStyle }) => (
    <View className="absolute inset-0 bg-black/80 justify-center items-center px-8">
      <Animated.View className="items-center justify-center w-full">
        <Animated.View style={spinnerStyle}>
          <Icon as={Loader2} className="size-12 text-[#0066FF]" />
        </Animated.View>
        <Text variant="h2" className="text-white mt-6 mb-2 text-center">
          Mendaftarkan Wajah...
        </Text>
        <Text variant="default" className="text-white/70 text-center">
          {message}
        </Text>
      </Animated.View>
    </View>
  ),
);
UploadingOverlay.displayName = "UploadingOverlay";

const ConfirmationScreen = memo<{
  onConfirm: () => void;
  onRetry: () => void;
  isUploading: boolean;
}>(({ onConfirm, onRetry, isUploading }) => (
  <SafeAreaView className="flex-1 bg-slate-900" edges={["top", "bottom"]}>
    <View className="flex-1 px-4 py-6">
      <View className="items-center mb-6">
        <Icon as={CheckCircle} className="size-16 text-green-500 mb-4" />
        <Text variant="h2" className="text-white text-center mb-2">
          {REQUIRED_IMAGES} Foto Berhasil Diambil
        </Text>
        <Text variant="default" className="text-white/70 text-center">
          Pastikan sudah siap melanjutkan. Setelah dikirim, data wajah tidak
          dapat dibatalkan.
        </Text>
      </View>
      <Card className="bg-amber-500/20 border-amber-500 p-4 mb-6">
        <View className="flex-row items-start">
          <Icon
            as={AlertCircle}
            className="size-5 text-amber-500 mr-3 mt-0.5"
          />
          <View className="flex-1">
            <Text
              variant="default"
              className="text-amber-500 font-semibold mb-1"
            >
              Perhatian
            </Text>
            <Text variant="small" className="text-amber-400">
              Setelah enrollment berhasil, data wajah tidak dapat dihapus atau
              diubah. Pastikan Anda siap melanjutkan sebelum mengirim.
            </Text>
          </View>
        </View>
      </Card>

      <Card className="bg-white/5 border-white/10 p-4 mb-6">
        <Text variant="default" className="text-white font-semibold mb-1">
          Ringkasan Pengambilan
        </Text>
        <Text variant="small" className="text-white/70">
          Total foto yang akan dikirim: {REQUIRED_IMAGES} foto.
        </Text>
      </Card>

      <View className="gap-3">
        <Button
          onPress={onConfirm}
          disabled={isUploading}
          className="bg-[#0066FF]"
        >
          <Icon as={Upload} className="size-5 text-white mr-2" />
          <Text variant="default" className="text-white font-semibold">
            Lanjutkan Enrollment
          </Text>
        </Button>

        <Button
          variant="outline"
          onPress={onRetry}
          disabled={isUploading}
          className="border-white/30"
        >
          <Icon as={RefreshCw} className="size-5 text-white mr-2" />
          <Text variant="default" className="text-white">
            Ulangi Pengambilan Foto
          </Text>
        </Button>
      </View>
    </View>
  </SafeAreaView>
));
ConfirmationScreen.displayName = "ConfirmationScreen";

const SuccessScreen = memo<{
  response: EnrollmentSuccessResponse;
  onDone: () => void;
}>(({ response, onDone }) => (
  <SafeAreaView className="flex-1 bg-slate-900" edges={["top", "bottom"]}>
    <View className="flex-1 justify-center items-center px-8">
      <Animated.View entering={FadeIn.duration(500)} className="items-center">
        <View className="w-24 h-24 rounded-full bg-green-500/20 items-center justify-center mb-6">
          <Icon as={CheckCircle} className="size-16 text-green-500" />
        </View>
        <Text variant="h1" className="text-white text-center mb-2">
          Enrollment Berhasil!
        </Text>
        <Text variant="default" className="text-white/70 text-center mb-8">
          {response.message}
        </Text>

        <Card className="bg-white/10 p-4 w-full mb-8">
          <View className="flex-row justify-between mb-2">
            <Text variant="small" className="text-white/60">
              Foto Diproses
            </Text>
            <Text variant="default" className="text-white font-semibold">
              {response.images_processed}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text variant="small" className="text-white/60">
              Foto Gagal
            </Text>
            <Text variant="default" className="text-white font-semibold">
              {response.images_failed}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="small" className="text-white/60">
              Total Embeddings
            </Text>
            <Text variant="default" className="text-white font-semibold">
              {response.total_embeddings}
            </Text>
          </View>
        </Card>

        <Button onPress={onDone} className="bg-[#0066FF] w-full">
          <Text variant="default" className="text-white font-semibold">
            Selesai
          </Text>
        </Button>
      </Animated.View>
    </View>
  </SafeAreaView>
));
SuccessScreen.displayName = "SuccessScreen";

const ErrorScreen = memo<{
  errorMessage: string;
  onRetry: () => void;
  onBack: () => void;
}>(({ errorMessage, onRetry, onBack }) => (
  <SafeAreaView className="flex-1 bg-slate-900" edges={["top", "bottom"]}>
    <View className="flex-1 justify-center items-center px-8">
      <Animated.View entering={FadeIn.duration(500)} className="items-center">
        <View className="w-24 h-24 rounded-full bg-red-500/20 items-center justify-center mb-6">
          <Icon as={AlertCircle} className="size-16 text-red-500" />
        </View>
        <Text variant="h1" className="text-white text-center mb-2">
          Enrollment Gagal
        </Text>
        <Text variant="default" className="text-white/70 text-center mb-8">
          {errorMessage}
        </Text>

        <View className="gap-3 w-full">
          <Button onPress={onRetry} className="bg-[#0066FF]">
            <Icon as={RefreshCw} className="size-5 text-white mr-2" />
            <Text variant="default" className="text-white font-semibold">
              Coba Lagi
            </Text>
          </Button>

          <Button
            variant="outline"
            onPress={onBack}
            className="border-white/30"
          >
            <Text variant="default" className="text-white">
              Kembali
            </Text>
          </Button>
        </View>
      </Animated.View>
    </View>
  </SafeAreaView>
));
ErrorScreen.displayName = "ErrorScreen";

const FaceApiStatusScreen = memo<{
  status: FaceApiRuntimeStatusResult | null;
  isLoading: boolean;
  onRetry: () => void;
  onBack: () => void;
}>(({ status, isLoading, onRetry, onBack }) => (
  <SafeAreaView className="flex-1 bg-slate-900" edges={["top", "bottom"]}>
    <View className="flex-1 justify-center items-center px-8">
      <Animated.View entering={FadeIn.duration(500)} className="items-center">
        <View className="w-24 h-24 rounded-full bg-amber-500/20 items-center justify-center mb-6">
          <Icon as={AlertCircle} className="size-16 text-amber-500" />
        </View>
        <Text variant="h1" className="text-white text-center mb-2">
          {isLoading
            ? "Memeriksa server..."
            : status?.title || "Server belum siap"}
        </Text>
        <Text variant="default" className="text-white/70 text-center mb-8">
          {isLoading
            ? "Sedang memastikan server verifikasi wajah siap menerima enrollment."
            : status?.message ||
              "Server verifikasi wajah belum bisa digunakan saat ini."}
        </Text>

        <View className="gap-3 w-full">
          <Button onPress={onRetry} className="bg-[#0066FF]">
            <Icon as={RefreshCw} className="size-5 text-white mr-2" />
            <Text variant="default" className="text-white font-semibold">
              Cek Lagi
            </Text>
          </Button>

          <Button
            variant="outline"
            onPress={onBack}
            className="border-white/30"
          >
            <Text variant="default" className="text-white">
              Kembali
            </Text>
          </Button>
        </View>
      </Animated.View>
    </View>
  </SafeAreaView>
));
FaceApiStatusScreen.displayName = "FaceApiStatusScreen";

// --- MAIN COMPONENT ---
const FaceEnrollment = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const permissionAttemptedRef = useRef(false);

  // --- STATE ---
  const device = useCameraDevice("front");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [step, setStep] = useState<EnrollmentStep>("capture");
  const [uploadMessage, setUploadMessage] = useState("Mengunggah foto...");
  const [errorMessage, setErrorMessage] = useState("");
  const [successResponse, setSuccessResponse] =
    useState<EnrollmentSuccessResponse | null>(null);
  const [faceApiRuntime, setFaceApiRuntime] =
    useState<FaceApiRuntimeStatusResult | null>(null);
  const [isCheckingFaceApi, setIsCheckingFaceApi] = useState(true);

  const spinnerRotation = useSharedValue(0);

  useEffect(() => {
    if (step === "uploading") {
      spinnerRotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false,
      );
    } else {
      spinnerRotation.value = 0;
    }
  }, [step, spinnerRotation]);

  const spinnerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinnerRotation.value}deg` }],
  }));

  const refreshFaceApiRuntime = useCallback(async () => {
    setIsCheckingFaceApi(true);
    const result = await fetchFaceApiRuntimeStatus();
    faceApiLog("enroll-runtime:result", { result });
    setFaceApiRuntime(result);
    setIsCheckingFaceApi(false);
  }, []);

  // --- HANDLERS ---
  const requestCameraAccess = useCallback(async () => {
    permissionAttemptedRef.current = true;
    faceApiLog("enroll-camera:permission-request:start", {
      currentPermission: hasPermission,
    });
    try {
      const granted = await requestPermission();
      faceApiLog("enroll-camera:permission-request:result", { granted });
      if (!granted) {
        Alert.alert(
          "Izin Kamera Diperlukan",
          "Izinkan akses kamera untuk melanjutkan enrollment wajah.",
        );
      }
      return granted;
    } catch (error) {
      faceApiError("enroll-camera:permission-request:failed", { error });
      Alert.alert("Error", "Gagal meminta izin kamera.");
      return false;
    }
  }, [hasPermission, requestPermission]);

  const handleCameraReady = useCallback(() => {
    faceApiLog("enroll-camera:ready", {
      device: device
        ? {
            id: device.id,
            name: device.name,
            position: device.position,
          }
        : null,
    });
    AccessibilityInfo.announceForAccessibility(
      "Kamera pendaftaran siap. Posisikan wajah Anda di dalam lingkaran.",
    );
    setIsCameraReady(true);
  }, [device]);

  const handleTakePicture = useCallback(async () => {
    if (!isCameraReady || !cameraRef.current || isCapturing) {
      faceApiWarn("enroll-capture:blocked", {
        isCameraReady,
        hasCameraRef: Boolean(cameraRef.current),
        isCapturing,
        capturedCount: capturedImages.length,
      });
      return;
    }
    if (capturedImages.length >= REQUIRED_IMAGES) {
      faceApiWarn("enroll-capture:max-images-reached", {
        capturedCount: capturedImages.length,
        requiredImages: REQUIRED_IMAGES,
      });
      return;
    }

    setIsCapturing(true);
    const startedAt = startFaceApiTimer();
    faceApiLog("enroll-capture:start", {
      capturedCount: capturedImages.length,
      requiredImages: REQUIRED_IMAGES,
      snapshotQuality: SNAPSHOT_QUALITY,
    });

    try {
      const snapshot = await cameraRef.current.takeSnapshot({
        quality: SNAPSHOT_QUALITY,
      });

      faceApiLog("enroll-capture:snapshot", {
        durationMs: elapsedMs(startedAt),
        hasPath: Boolean(snapshot?.path),
        path: snapshot?.path,
      });

      if (!snapshot?.path) {
        throw new Error("Gagal mengambil foto");
      }

      const photoUri = snapshot.path.startsWith("file://")
        ? snapshot.path
        : `file://${snapshot.path}`;

      const finalPhotoUri = photoUri;

      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(finalPhotoUri);
      if (!fileInfo.exists) {
        throw new Error("File foto tidak ditemukan");
      }

      const fileSizeBytes = fileInfo.size || 0;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);
      faceApiLog("enroll-capture:file-info", {
        uri: finalPhotoUri,
        size: bytesInfo(fileSizeBytes),
      });

      if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
        faceApiWarn("enroll-capture:file-too-large", {
          maxMb: MAX_IMAGE_SIZE_MB,
          size: bytesInfo(fileSizeBytes),
        });
        Alert.alert(
          "Ukuran Foto Terlalu Besar",
          `Foto melebihi ${MAX_IMAGE_SIZE_MB}MB. Coba ambil foto dengan pencahayaan yang lebih baik.`,
        );
        return;
      }

      const newImages = [
        ...capturedImages,
        { uri: finalPhotoUri, size: fileSizeBytes },
      ];
      setCapturedImages(newImages);
      AccessibilityInfo.announceForAccessibility(
        `Foto ke-${newImages.length} dari ${REQUIRED_IMAGES} berhasil diambil.`,
      );
      faceApiLog("enroll-capture:stored", {
        capturedCount: newImages.length,
        requiredImages: REQUIRED_IMAGES,
        totalSize: bytesInfo(
          newImages.reduce((total, item) => total + item.size, 0),
        ),
      });

      // Check if we have enough images
      if (newImages.length >= REQUIRED_IMAGES) {
        AccessibilityInfo.announceForAccessibility(
          "Sepuluh foto berhasil diambil. Siap untuk konfirmasi pendaftaran.",
        );
        faceApiLog("enroll-capture:ready-to-confirm", {
          capturedCount: newImages.length,
        });
        setStep("confirm");
      }
    } catch (error) {
      faceApiError("enroll-capture:failed", {
        durationMs: elapsedMs(startedAt),
        error,
      });
      Alert.alert("Error", getReadableError(error, "Gagal mengambil foto."));
    } finally {
      setIsCapturing(false);
    }
  }, [isCameraReady, isCapturing, capturedImages]);

  const handleRetryCapture = useCallback(() => {
    faceApiLog("enroll-capture:retry", {
      capturedCount: capturedImages.length,
      files: capturedImages.map((img, index) => ({
        index,
        uri: img.uri,
        size: bytesInfo(img.size),
      })),
    });
    // Clean up temporary files
    capturedImages.forEach((img) => {
      FileSystem.deleteAsync(img.uri, { idempotent: true }).catch(() => {});
    });
    setCapturedImages([]);
    setStep("capture");
    setErrorMessage("");
  }, [capturedImages]);

  const handleEnroll = useCallback(async () => {
    const startedAt = startFaceApiTimer();
    faceApiLog("enroll-upload:start", {
      capturedCount: capturedImages.length,
      requiredImages: REQUIRED_IMAGES,
      totalSize: bytesInfo(
        capturedImages.reduce((total, item) => total + item.size, 0),
      ),
      files: capturedImages.map((img, index) => ({
        index,
        uri: img.uri,
        size: bytesInfo(img.size),
      })),
    });

    if (capturedImages.length < REQUIRED_IMAGES) {
      faceApiWarn("enroll-upload:not-enough-images", {
        capturedCount: capturedImages.length,
        requiredImages: REQUIRED_IMAGES,
      });
      Alert.alert(
        "Error",
        `Diperlukan ${REQUIRED_IMAGES} foto untuk enrollment.`,
      );
      return;
    }

    setStep("uploading");
    setUploadMessage("Mempersiapkan foto...");

    try {
      const runtime = await fetchFaceApiRuntimeStatus();
      setFaceApiRuntime(runtime);
      if (runtime.state !== "healthy") {
        setErrorMessage(runtime.message);
        setStep("error");
        return;
      }

      faceApiLog("enroll-upload:request-prep", {
        method: "POST",
        url: "/v1/mobile/face/enrollment",
        headers: {
          Authorization: "[redacted bearer]",
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadMessage("Mengunggah foto ke server...");

      const files: FormDataFilePart[] = capturedImages.map((img, index) => ({
        uri: img.uri,
        type: "image/jpeg",
        name: `face_${index}.jpg`,
      }));

      for (let i = 0; i < files.length; i++) {
        const filePart = files[i];
        if (!filePart) continue;
        faceApiLog("enroll-upload:file-ready", {
          field: "files",
          name: filePart.name,
          type: filePart.type,
          uri: filePart.uri,
          size: bytesInfo(capturedImages[i]?.size ?? 0),
        });
      }

      faceApiLog("enroll-upload:formdata-ready", {
        fileCount: capturedImages.length,
        files: capturedImages.map((img, index) => ({
          field: "files",
          name: `face_${index}.jpg`,
          type: "image/jpeg",
          uri: img.uri,
          size: bytesInfo(img.size),
        })),
      });

      setUploadMessage(`Mendaftarkan ${capturedImages.length} foto wajah...`);

      const response = await submitEnrollment(files);

      faceApiLog("enroll-upload:response", {
        durationMs: elapsedMs(startedAt),
        data: response,
      });
      setSuccessResponse({
        status: "success",
        message: "Enrollment wajah berhasil.",
        student_id: "",
        images_processed: response.imagesProcessed,
        images_failed: response.imagesFailed,
        total_embeddings: response.totalEmbeddings,
      });
      AccessibilityInfo.announceForAccessibility(
        "Pendaftaran wajah berhasil disimpan.",
      );
      setStep("success");
    } catch (error) {
      faceApiError("enroll-upload:failed", {
        durationMs: elapsedMs(startedAt),
        error,
      });
      const errText = getReadableError(error, "Gagal mendaftarkan wajah.");
      AccessibilityInfo.announceForAccessibility(
        `Pendaftaran wajah gagal: ${errText}`,
      );
      setErrorMessage(errText);
      setStep("error");
    } finally {
      faceApiLog("enroll-upload:cleanup-temp-files", {
        capturedCount: capturedImages.length,
      });
      // Clean up temporary files
      capturedImages.forEach((img) => {
        FileSystem.deleteAsync(img.uri, { idempotent: true }).catch(() => {});
      });
    }
  }, [capturedImages]);

  const handleDone = useCallback(() => {
    router.back();
  }, [router]);

  const handleBackPress = useCallback(() => {
    if (step === "uploading") {
      Alert.alert(
        "Proses Sedang Berlangsung",
        "Enrollment sedang diproses. Apakah Anda yakin ingin membatalkan?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Ya, Batalkan",
            style: "destructive",
            onPress: () => {
              faceApiWarn("enroll-upload:abort-from-back", {
                capturedCount: capturedImages.length,
              });
              router.back();
            },
          },
        ],
      );
      return true;
    }

    if (capturedImages.length > 0 && step === "capture") {
      Alert.alert(
        "Batalkan Enrollment?",
        `Anda sudah mengambil ${capturedImages.length} foto. Yakin ingin membatalkan?`,
        [
          { text: "Lanjutkan", style: "cancel" },
          {
            text: "Ya, Batalkan",
            style: "destructive",
            onPress: () => {
              faceApiWarn("enroll-capture:cancel-from-back", {
                capturedCount: capturedImages.length,
              });
              // Clean up temporary files
              capturedImages.forEach((img) => {
                FileSystem.deleteAsync(img.uri, { idempotent: true }).catch(
                  () => {},
                );
              });
              router.back();
            },
          },
        ],
      );
      return true;
    }

    return false;
  }, [step, capturedImages, router]);

  // --- EFFECTS ---
  useEffect(() => {
    void refreshFaceApiRuntime();
  }, [refreshFaceApiRuntime]);

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

  // --- RENDER ---
  // Success screen
  if (step === "success" && successResponse) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <SuccessScreen response={successResponse} onDone={handleDone} />
      </>
    );
  }

  // Error screen
  if (step === "error") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <ErrorScreen
          errorMessage={errorMessage}
          onRetry={handleRetryCapture}
          onBack={handleDone}
        />
      </>
    );
  }

  // Uploading screen (shown on top of confirm)
  if (step === "uploading") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <ConfirmationScreen
          onConfirm={handleEnroll}
          onRetry={handleRetryCapture}
          isUploading={true}
        />
        <UploadingOverlay
          message={uploadMessage}
          spinnerStyle={spinnerAnimatedStyle}
        />
      </>
    );
  }

  // Confirmation screen
  if (step === "confirm") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <ConfirmationScreen
          onConfirm={handleEnroll}
          onRetry={handleRetryCapture}
          isUploading={false}
        />
      </>
    );
  }

  if (isCheckingFaceApi || faceApiRuntime?.state !== "healthy") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <FaceApiStatusScreen
          status={faceApiRuntime}
          isLoading={isCheckingFaceApi}
          onRetry={refreshFaceApiRuntime}
          onBack={handleDone}
        />
      </>
    );
  }

  // Permission check
  const permissionResolved = hasPermission === true || hasPermission === false;

  if (!permissionResolved) {
    return (
      <SafeAreaView
        className="flex-1 bg-black"
        edges={["top", "left", "right"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color="#0066FF" />
          <Text variant="large" className="text-white text-center mt-4">
            Memeriksa izin kamera...
          </Text>
        </View>
      </SafeAreaView>
    );
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
            className="w-12 h-12 rounded-full bg-neutral-800 justify-center items-center shadow-lg"
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            accessibilityHint="Ketuk dua kali untuk kembali ke menu sebelumnya"
          >
            <Icon as={ArrowLeft} className="size-6 text-white" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-10">
          <Icon as={CameraIcon} className="size-20 text-[#0066FF]" />
          <Text variant="h2" className="text-white text-center mt-4 mb-2">
            Izinkan akses kamera
          </Text>
          <Text variant="default" className="text-white/80 text-center mb-8">
            Kami membutuhkan izin kamera untuk mengambil foto wajah Anda.
          </Text>
          <TouchableOpacity
            className="bg-[#0066FF] px-8 py-4 rounded-lg flex-row items-center mb-3 w-full justify-center min-h-[48px]"
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
            className="bg-neutral-800 px-8 py-4 rounded-lg flex-row items-center w-full justify-center min-h-[48px]"
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
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView
        className="flex-1 bg-black"
        edges={["top", "left", "right"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color="#0066FF" />
          <Text variant="large" className="text-white text-center mt-4">
            Menyiapkan kamera...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Camera capture screen
  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={step === "capture"}
        photo
        onInitialized={handleCameraReady}
      />

      <View className="absolute inset-0" pointerEvents="box-none">
        <SafeAreaView
          className="absolute inset-0"
          edges={["top", "left", "right"]}
          pointerEvents="box-none"
        >
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-4">
              <TouchableOpacity
                className="w-12 h-12 rounded-full bg-black/50 justify-center items-center"
                onPress={() => handleBackPress() || router.back()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Kembali"
                accessibilityHint="Ketuk dua kali untuk kembali ke menu sebelumnya"
                activeOpacity={0.7}
              >
                <Icon as={ArrowLeft} className="size-6 text-white" />
              </TouchableOpacity>

              <ProgressCounter
                current={capturedImages.length}
                total={REQUIRED_IMAGES}
              />

              <View className="w-10" />
            </View>

            {/* Instructions */}
            <View className="items-center mt-4 px-4">
              <View className="bg-black/60 px-4 py-2 rounded-lg">
                <Text variant="default" className="text-white text-center">
                  Posisikan wajah di tengah dan ambil {REQUIRED_IMAGES} foto
                </Text>
              </View>
            </View>

            {/* Face guide oval */}
            <View className="flex-1 items-center justify-center">
              <View
                className="w-64 h-80 border-2 border-white/50 rounded-[160px]"
                style={{ borderStyle: "dashed" }}
              />
            </View>

            {/* Capture button */}
            <View
              className="items-center"
              style={{ paddingBottom: Math.max(24, insets.bottom + 12) }}
            >
              <CaptureButton
                isCapturing={isCapturing}
                isReady={isCameraReady}
                onPress={handleTakePicture}
                disabled={capturedImages.length >= REQUIRED_IMAGES}
              />
              {capturedImages.length >= REQUIRED_IMAGES && (
                <Text variant="small" className="text-white mt-2">
                  Maksimal {REQUIRED_IMAGES} foto tercapai
                </Text>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Camera not ready overlay */}
      {!isCameraReady && (
        <View className="absolute inset-0 bg-black/70 justify-center items-center">
          <ActivityIndicator size="large" color="#0066FF" />
          <Text variant="default" className="text-white mt-3">
            Menyiapkan kamera...
          </Text>
        </View>
      )}
    </View>
  );
};

export default FaceEnrollment;
