import {
  Camera,
  PhotoFile,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
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
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { Blob as ExpoBlob } from "expo-blob";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import {
  Camera as CameraIcon,
  SwitchCamera,
  ArrowLeft,
  Loader2,
} from "lucide-react-native";
import { Buffer } from "buffer";
import { timeSync } from "~/utils/timeSync";
import useAuthStore from "~/store/authStore";

// --- CONSTANTS ---
const IMAGE_CONFIG = {
  RESIZE_WIDTH: 800,
  FORMAT: SaveFormat.JPEG,
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB max
  QUALITY_STEPS: [0.85, 0.7, 0.55, 0.4],
} as const;

const UPLOAD_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  STORAGE_BUCKET: "attendance-photos",
  TIMEOUT_MS: 30000,
  SIGNED_URL_EXPIRES_IN: 60 * 60 * 24 * 30, // 30 days
} as const;

// --- TYPES AND INTERFACES ---
type CameraFacing = "front" | "back";
type UploadStage = "processing" | "uploading" | "saving";
type Coordinates = {
  latitude: number;
  longitude: number;
};

type ExpoBlobInstance = InstanceType<typeof ExpoBlob>;

// --- MEMOIZED COMPONENTS ---
const ProgressBar = memo<{ percentage: number }>(({ percentage }) => (
  <View className="w-full h-2 bg-gray-700 rounded-full">
    <View
      className="h-full bg-[#0066FF] rounded-full"
      style={{ width: `${percentage}%` }}
    />
  </View>
));
ProgressBar.displayName = "ProgressBar";

const CaptureButton = memo<{
  isCapturing: boolean;
  isReady: boolean;
  isUploading: boolean;
  onPress: () => void;
}>(({ isCapturing, isReady, isUploading, onPress }) => (
  <Animated.View className="w-24 h-24 rounded-full bg-white/30 justify-center items-center">
    <TouchableOpacity
      className="w-20 h-20 rounded-full bg-white justify-center items-center"
      onPress={onPress}
      disabled={isCapturing || !isReady || isUploading}
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

const UploadOverlay = memo<{
  message: string;
  percentage: number;
}>(({ message, percentage }) => (
  <View className="absolute inset-0 bg-black/80 justify-center items-center px-8">
    <Animated.View className="items-center justify-center w-full">
      <Icon as={Loader2} className="size-8 text-[#0066FF]" />
      <Text variant="h2" className="text-white mt-4 mb-2">
        Menyimpan absensi...
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
UploadOverlay.displayName = "UploadOverlay";

const CameraReadyOverlay = memo(() => (
  <View className="absolute inset-0 bg-black/70 justify-center items-center">
    <ActivityIndicator size="large" color="#0066FF" />
    <Text variant="default" className="text-white mt-3">
      Menyiapkan kamera...
    </Text>
  </View>
));
CameraReadyOverlay.displayName = "CameraReadyOverlay";

interface UploadProgress {
  stage: UploadStage;
  percentage: number;
  message: string;
}

interface CompressionResult {
  base64: string;
  size: number;
  quality: number;
}

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

const base64ToBlob = (base64: string): ExpoBlobInstance => {
  if (!base64) throw new Error("Invalid base64 string");
  const buffer = Buffer.from(base64, "base64");
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );

  return new ExpoBlob([arrayBuffer], { type: "image/jpeg" });
};

const compressImage = async (imageUri: string): Promise<CompressionResult> => {
  for (const quality of IMAGE_CONFIG.QUALITY_STEPS) {
    const manipulationContext = ImageManipulator.manipulate(imageUri);
    manipulationContext.resize({ width: IMAGE_CONFIG.RESIZE_WIDTH });

    const renderedImage = await manipulationContext.renderAsync();
    const savedImage = await renderedImage.saveAsync({
      base64: true,
      compress: quality,
      format: IMAGE_CONFIG.FORMAT,
    });

    const base64Input = savedImage.base64 ?? null;
    if (!base64Input) {
      continue;
    }

    let base64Payload: string | null = base64Input;

    if (base64Payload && base64Payload.includes(",")) {
      const [, payload] = base64Payload.split(",", 2);
      base64Payload = payload ?? null;
    }

    if (!base64Payload) {
      continue;
    }

    const fileSize = (base64Payload.length * 3) / 4;
    if (fileSize <= IMAGE_CONFIG.MAX_FILE_SIZE) {
      return { base64: base64Payload, size: fileSize, quality };
    }
  }

  throw new Error("Gagal mengompresi gambar");
};

// --- UTILITY FUNCTIONS ---

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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: "processing",
    percentage: 0,
    message: "Menunggu proses...",
  });
  const [isUploading, setIsUploading] = useState(false);

  // --- STORE & PARAMS ---
  const { user } = useAuthStore();
  const userId = user?.id ?? null;

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

  const generateFileName = useCallback(() => {
    if (!userId) {
      throw new Error("ID pengguna tidak valid.");
    }

    const now = timeSync.getSyncedTime();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const filename = `${day}${month}${year}_${now.getTime()}.jpg`;
    return `${userId}/${filename}`;
  }, [userId]);

  const uploadToStorage = useCallback(
    async (fileName: string, fileBlob: ExpoBlobInstance): Promise<string> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        try {
          const fileArrayBuffer = await fileBlob.arrayBuffer();
          const fileBytes = new Uint8Array(fileArrayBuffer);

          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from(UPLOAD_CONFIG.STORAGE_BUCKET)
              .upload(fileName, fileBytes, {
                contentType: "image/jpeg",
                upsert: true,
              });

          if (uploadError) {
            throw new Error(
              getReadableError(uploadError, "Gagal mengunggah foto."),
            );
          }

          const { data: signedDownload, error: signedDownloadError } =
            await supabase.storage
              .from(UPLOAD_CONFIG.STORAGE_BUCKET)
              .createSignedUrl(
                uploadData?.path ?? fileName,
                UPLOAD_CONFIG.SIGNED_URL_EXPIRES_IN,
              );

          if (signedDownloadError) {
            throw new Error(
              getReadableError(
                signedDownloadError,
                "Gagal membuat signed URL unduhan.",
              ),
            );
          }

          const signedUrl = signedDownload?.signedUrl ?? null;

          if (!signedUrl) {
            throw new Error("Gagal mendapatkan signed URL unduhan.");
          }

          return signedUrl;
        } catch (error: any) {
          lastError = new Error(
            getReadableError(error, "Gagal memproses unggahan."),
          );

          if (attempt < UPLOAD_CONFIG.MAX_RETRIES) {
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1),
              ),
            );
          }
        }
      }

      throw lastError || new Error("Upload gagal setelah beberapa percobaan");
    },
    [],
  );

  const processAndUploadPhoto = useCallback(
    async (compressed: CompressionResult): Promise<void> => {
      if (!user) {
        Alert.alert("Error", "Sesi pengguna tidak valid.");
        return;
      }

      if (!actionType) {
        Alert.alert("Error", "Data absensi tidak valid.");
        return;
      }

      setIsUploading(true);
      const startTime = Date.now();

      try {
        setUploadProgress({
          stage: "uploading",
          percentage: 30,
          message: "Mengunggah foto...",
        });
        const fileBlob = base64ToBlob(compressed.base64);
        const fileName = generateFileName();
        const photoUrl = await uploadToStorage(fileName, fileBlob);

        setUploadProgress({
          stage: "saving",
          percentage: 80,
          message: "Menyimpan data...",
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
            p_photo_path: photoUrl,
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

        setUploadProgress({
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
          getReadableError(error, "Gagal menyimpan absensi."),
        );
      } finally {
        setIsUploading(false);
      }
    },
    [
      user,
      actionType,
      generateFileName,
      uploadToStorage,
      router,
      preFetchedLocation,
    ],
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
      isUploading
    ) {
      return;
    }

    setIsCapturingPhoto(true);

    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto();

      if (!photo?.path) {
        throw new Error("Failed to capture photo - no file path returned");
      }

      const photoUri = photo.path.startsWith("file://")
        ? photo.path
        : `file://${photo.path}`;

      const compressed = await compressImage(photoUri);
      await processAndUploadPhoto(compressed);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengambil foto. Silakan coba lagi.",
      );
    } finally {
      setIsCapturingPhoto(false);
    }
  }, [isCameraReady, isCapturingPhoto, processAndUploadPhoto, isUploading]);

  const handleToggleCameraFacing = useCallback(() => {
    setCameraFacing((current) => (current === "front" ? "back" : "front"));
  }, []);

  const handleBackPress = useCallback(() => {
    if (isUploading) {
      Alert.alert(
        "Upload Sedang Berlangsung",
        "Foto sedang diunggah. Apakah Anda yakin ingin kembali?",
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
  }, [isUploading, router]);

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
        isActive={!isUploading}
        enableLocation={true}
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
                disabled={isUploading}
              >
                <Icon as={ArrowLeft} className="size-6 text-white" />
              </TouchableOpacity>
            </View>

            <View className="absolute bottom-12 left-0 right-0 flex-row justify-around items-center px-5">
              <TouchableOpacity
                className="w-16 h-16 rounded-full bg-black/50 justify-center items-center"
                onPress={handleToggleCameraFacing}
                activeOpacity={0.7}
                disabled={isUploading}
              >
                <Icon as={SwitchCamera} className="size-7 text-white" />
              </TouchableOpacity>

              <CaptureButton
                isCapturing={isCapturingPhoto}
                isReady={isCameraReady}
                isUploading={isUploading}
                onPress={handleTakePicture}
              />

              <View className="w-16 h-16" />
            </View>
          </View>
        </SafeAreaView>
      </View>

      {!isCameraReady && <CameraReadyOverlay />}

      {isUploading && (
        <UploadOverlay
          message={uploadProgress.message}
          percentage={uploadProgress.percentage}
        />
      )}
    </View>
  );
};

export default CameraAttendance;
