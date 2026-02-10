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
} from "react-native";
import axios, { isAxiosError } from "axios";
import { Text } from "~/components/ui/text";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";

import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import { ensureFaceApiConfigured } from "~/utils/secureConfig";
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

interface EnrollmentErrorResponse {
  status: "error";
  error: string;
  message: string;
  detail?: string | { loc: (string | number)[]; msg: string; type: string }[];
}

type FormDataFilePart = {
  uri: string;
  name: string;
  type: string;
};

// --- UTILITY FUNCTIONS ---
const getReadableError = (
  error: unknown,
  fallback = "Terjadi kesalahan.",
): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
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
  <SafeAreaView className="flex-1 bg-gray-900" edges={["top", "bottom"]}>
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
  <SafeAreaView className="flex-1 bg-gray-900" edges={["top", "bottom"]}>
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
  <SafeAreaView className="flex-1 bg-gray-900" edges={["top", "bottom"]}>
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

// --- MAIN COMPONENT ---
const FaceEnrollment = () => {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const permissionAttemptedRef = useRef(false);
  const uploadController = useRef<AbortController | null>(null);

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

  // --- HANDLERS ---
  const requestCameraAccess = useCallback(async () => {
    permissionAttemptedRef.current = true;
    try {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          "Izin Kamera Diperlukan",
          "Izinkan akses kamera untuk melanjutkan enrollment wajah.",
        );
      }
      return granted;
    } catch {
      Alert.alert("Error", "Gagal meminta izin kamera.");
      return false;
    }
  }, [requestPermission]);

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  const handleTakePicture = useCallback(async () => {
    if (!isCameraReady || !cameraRef.current || isCapturing) return;
    if (capturedImages.length >= REQUIRED_IMAGES) return;

    setIsCapturing(true);

    try {
      const snapshot = await cameraRef.current.takeSnapshot({
        quality: SNAPSHOT_QUALITY,
      });

      if (!snapshot?.path) {
        throw new Error("Gagal mengambil foto");
      }

      const photoUri = snapshot.path.startsWith("file://")
        ? snapshot.path
        : `file://${snapshot.path}`;

      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      if (!fileInfo.exists) {
        throw new Error("File foto tidak ditemukan");
      }

      const fileSizeBytes = fileInfo.size || 0;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);

      if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
        Alert.alert(
          "Ukuran Foto Terlalu Besar",
          `Foto melebihi ${MAX_IMAGE_SIZE_MB}MB. Coba ambil foto dengan pencahayaan yang lebih baik.`,
        );
        return;
      }

      const newImages = [
        ...capturedImages,
        { uri: photoUri, size: fileSizeBytes },
      ];
      setCapturedImages(newImages);

      // Check if we have enough images
      if (newImages.length >= REQUIRED_IMAGES) {
        setStep("confirm");
      }
    } catch (error) {
      Alert.alert("Error", getReadableError(error, "Gagal mengambil foto."));
    } finally {
      setIsCapturing(false);
    }
  }, [isCameraReady, isCapturing, capturedImages]);

  const handleRetryCapture = useCallback(() => {
    // Clean up temporary files
    capturedImages.forEach((img) => {
      FileSystem.deleteAsync(img.uri, { idempotent: true }).catch(() => {});
    });
    setCapturedImages([]);
    setStep("capture");
    setErrorMessage("");
  }, [capturedImages]);

  const handleEnroll = useCallback(async () => {
    if (capturedImages.length < REQUIRED_IMAGES) {
      Alert.alert(
        "Error",
        `Diperlukan ${REQUIRED_IMAGES} foto untuk enrollment.`,
      );
      return;
    }

    setStep("uploading");
    setUploadMessage("Mempersiapkan foto...");

    try {
      const controller = new AbortController();
      uploadController.current = controller;

      // Get JWT token
      await ensureSupabaseInitialized();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sesi tidak valid. Silakan login ulang.");
      }

      const faceApiBaseUrl = await ensureFaceApiConfigured();
      const enrollApiUrl = `${faceApiBaseUrl}/v1/enroll`;

      setUploadMessage("Mengunggah foto ke server...");

      // Build FormData
      const formData = new FormData();
      for (let i = 0; i < capturedImages.length; i++) {
        const img = capturedImages[i];
        const filePart: FormDataFilePart = {
          uri: img.uri,
          type: "image/jpeg",
          name: `face_${i}.jpg`,
        };

        formData.append("files", filePart as unknown as Blob);
      }

      setUploadMessage(`Mendaftarkan ${capturedImages.length} foto wajah...`);

      const response = await axios.post<EnrollmentSuccessResponse>(
        enrollApiUrl,
        formData,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "multipart/form-data",
          },
          signal: controller.signal,
        },
      );

      const successData = response.data;
      setSuccessResponse(successData);
      setStep("success");
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.code === "ERR_CANCELED") {
          return;
        }

        const axiosData = error.response?.data as
          | EnrollmentErrorResponse
          | undefined;
        let errorMsg =
          axiosData?.message || error.message || "Gagal mendaftarkan wajah";

        if (axiosData?.detail && Array.isArray(axiosData.detail)) {
          errorMsg = axiosData.detail.map((d) => d.msg).join(", ");
        } else if (axiosData?.detail && typeof axiosData.detail === "string") {
          errorMsg = axiosData.detail;
        }

        setErrorMessage(errorMsg);
        setStep("error");
        return;
      }

      setErrorMessage(getReadableError(error, "Gagal mendaftarkan wajah."));
      setStep("error");
    } finally {
      uploadController.current = null;
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
              uploadController.current?.abort();
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

  // Permission check
  const permissionResolved = typeof hasPermission === "boolean";

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
        <View className="flex-1 items-center justify-center px-10">
          <Icon as={CameraIcon} className="size-20 text-[#0066FF]" />
          <Text variant="h2" className="text-white text-center mt-4 mb-2">
            Izinkan akses kamera
          </Text>
          <Text variant="default" className="text-white/80 text-center mb-8">
            Kami membutuhkan izin kamera untuk mengambil foto wajah Anda.
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
        video={true}
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
                className="w-10 h-10 rounded-full bg-black/50 justify-center items-center"
                onPress={() => handleBackPress() || router.back()}
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
            <View className="items-center pb-12">
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
