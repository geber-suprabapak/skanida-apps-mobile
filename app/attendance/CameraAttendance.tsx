import {
  Camera,
  PhotoFile,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import * as ImageManipulator from "expo-image-manipulator";
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
import NetInfo from "@react-native-community/netinfo";

import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import {
  Camera as CameraIcon,
  SwitchCamera,
  ArrowLeft,
  Loader2,
} from "lucide-react-native";
import { Buffer } from "buffer";
import { formatDateWIB } from "~/lib/utils";
import { timeSync } from "~/utils/timeSync";

// --- CONSTANTS ---
const IMAGE_CONFIG = {
  RESIZE_WIDTH: 800,
  FORMAT: ImageManipulator.SaveFormat.JPEG,
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB max
  QUALITY_STEPS: [0.85, 0.7, 0.55, 0.4],
} as const;

const UPLOAD_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  STORAGE_BUCKET: "attendance-photos",
  TIMEOUT_MS: 30000, // 30 seconds
} as const;

// --- TYPES AND INTERFACES ---
type CameraFacing = "front" | "back";
type AbsenceType = "present" | "home";
type UploadStage = "processing" | "uploading" | "saving";
type AttendanceStatus = "Hadir" | "Terlambat" | "Pulang" | "Alpha";

const ALLOWED_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "Hadir",
  "Terlambat",
  "Pulang",
  "Alpha",
];

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

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  userId: string | null;
  absenceType: AbsenceType;
  status: AttendanceStatus | null;
}

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

// --- UTILITY FUNCTIONS ---

const CameraAttendance = () => {
  // --- HOOKS ---
  const router = useRouter();
  const params = useLocalSearchParams();
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
    message: "Initializing...",
  });
  const [isUploading, setIsUploading] = useState(false);

  // --- MEMOIZED VALUES ---
  const locationData: LocationData = useMemo(() => {
    const latitude = parseFloat(params.latitude as string);
    const longitude = parseFloat(params.longitude as string);
    const rawStatus = params.attendanceStatus as string | undefined;

    const normalizedStatus =
      typeof rawStatus === "string" &&
      ALLOWED_ATTENDANCE_STATUSES.includes(rawStatus as AttendanceStatus)
        ? (rawStatus as AttendanceStatus)
        : null;

    const data: LocationData = {
      latitude: Number.isNaN(latitude) ? null : latitude,
      longitude: Number.isNaN(longitude) ? null : longitude,
      userId: (params.userId as string) || null,
      absenceType: (params.absenceType as AbsenceType) || "present",
      status: normalizedStatus,
    };

    return data;
  }, [params]);

  const isLocationDataValid = useMemo(() => {
    const statusValid =
      locationData.absenceType === "present"
        ? locationData.status === "Hadir" || locationData.status === "Terlambat"
        : locationData.status === "Pulang";

    return (
      locationData.userId !== null &&
      locationData.latitude !== null &&
      locationData.longitude !== null &&
      statusValid
    );
  }, [locationData]);

  const currentDateTime = useMemo(() => {
    const now = timeSync.getSyncedTime(); // UTC from server, auto-displays in device timezone

    // Extract date components (will be in device timezone = WIB)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return {
      date: formatDateWIB(now), // WIB date for database (YYYY-MM-DD)
      formattedDate: `${day}${month}${year}`, // DDMMYYYY for filename
      timestamp: now.getTime(), // epoch ms for uniqueness
      displayTime: now.toLocaleString("id-ID", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
  }, []);

  // --- UTILITY FUNCTIONS (HOOKED) ---
  const base64ToUint8Array = useCallback((base64: string): Uint8Array => {
    if (!base64) throw new Error("Invalid base64 string");
    return Buffer.from(base64, "base64");
  }, []);

  const generateFileName = useCallback(
    () =>
      `${currentDateTime.formattedDate}_${currentDateTime.timestamp}_${locationData.userId}.jpg`,
    [currentDateTime, locationData.userId],
  );

  const compressImage = useCallback(
    async (imageUri: string): Promise<CompressionResult> => {
      for (const quality of IMAGE_CONFIG.QUALITY_STEPS) {
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: IMAGE_CONFIG.RESIZE_WIDTH } }],
          { compress: quality, format: IMAGE_CONFIG.FORMAT, base64: true },
        );

        if (!result.base64) continue;

        const fileSize = (result.base64.length * 3) / 4;
        if (fileSize <= IMAGE_CONFIG.MAX_FILE_SIZE) {
          return { base64: result.base64, size: fileSize, quality };
        }
      }

      throw new Error("Gagal mengompresi gambar");
    },
    [],
  );

  const uploadToStorage = useCallback(
    async (fileName: string, fileBuffer: Uint8Array): Promise<string> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        try {
          // Upload file
          const uploadPromise = supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .upload(fileName, fileBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Upload timeout")),
              UPLOAD_CONFIG.TIMEOUT_MS,
            ),
          );

          const { error } = await Promise.race([uploadPromise, timeoutPromise]);
          if (error) throw error;

          // Get signed URL
          const { data, error: urlError } = await supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .createSignedUrl(fileName, 60 * 60 * 24);

          if (urlError || !data?.signedUrl)
            throw urlError || new Error("Failed to get URL");

          return data.signedUrl;
        } catch (error: any) {
          lastError = error;

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

      throw lastError || new Error("Upload gagal setelah 3 percobaan");
    },
    [],
  );

  const saveAttendanceRecord = useCallback(
    async (photoUrl: string): Promise<void> => {
      let status: AttendanceStatus;

      if (locationData.absenceType === "home") {
        status = "Pulang";
      } else if (
        locationData.status === "Hadir" ||
        locationData.status === "Terlambat"
      ) {
        status = locationData.status;
      } else if (locationData.status === "Alpha") {
        throw new Error(
          "Status Alpha tidak dapat diproses melalui absensi mandiri.",
        );
      } else {
        console.warn(
          "Status absensi tidak tersedia di parameter kamera. Menggunakan status default 'Hadir'.",
        );
        status = "Hadir";
      }

      const attendanceData = {
        user_id: locationData.userId,
        date: currentDateTime.date,
        photo_url: photoUrl,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        status,
      };

      const { error } = await supabase
        .from("absences")
        .insert([attendanceData]);

      if (error) {
        throw new Error(`Gagal menyimpan data absensi: ${error.message}`);
      }
    },
    [locationData, currentDateTime],
  );

  const processAndUploadPhoto = useCallback(
    async (compressed: CompressionResult): Promise<void> => {
      setIsUploading(true);
      const startTime = Date.now();

      try {
        // Check connection
        setUploadProgress({
          stage: "processing",
          percentage: 10,
          message: "Memeriksa koneksi...",
        });
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          throw new Error("Tidak ada koneksi internet");
        }

        // Prepare file
        setUploadProgress({
          stage: "processing",
          percentage: 30,
          message: "Memproses foto...",
        });
        const fileBuffer = base64ToUint8Array(compressed.base64);
        const fileName = generateFileName();

        // Upload
        setUploadProgress({
          stage: "uploading",
          percentage: 50,
          message: "Mengunggah foto...",
        });
        const photoUrl = await uploadToStorage(fileName, fileBuffer);

        // Save to database
        setUploadProgress({
          stage: "saving",
          percentage: 80,
          message: "Menyimpan data...",
        });
        await saveAttendanceRecord(photoUrl);

        // Success
        setUploadProgress({
          stage: "saving",
          percentage: 100,
          message: "Berhasil!",
        });

        const totalTime = Date.now() - startTime;

        // Get current time (auto-displays in device timezone)
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
            attendanceType: locationData.absenceType,
            successTime: currentTime,
            processingTime: totalTime.toString(),
          },
        });
      } catch (error: any) {
        const errorMessage = error?.message?.includes("timeout")
          ? "Upload timeout. Cek koneksi internet Anda"
          : error?.message?.includes("koneksi")
            ? error.message
            : "Gagal menyimpan absensi";

        Alert.alert("Error", error?.message || errorMessage);
      } finally {
        setIsUploading(false);
      }
    },
    [
      locationData,
      base64ToUint8Array,
      generateFileName,
      uploadToStorage,
      saveAttendanceRecord,
      router,
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
    if (!isCameraReady || !cameraRef.current || isCapturingPhoto) {
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
  }, [isCameraReady, isCapturingPhoto, compressImage, processAndUploadPhoto]);

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
    if (!isLocationDataValid) {
      const reason = !locationData.status
        ? "Status absensi tidak valid. Silakan ulangi proses dari awal."
        : "Data absensi tidak lengkap. Silakan kembali dan coba lagi.";
      Alert.alert("Error", reason, [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [isLocationDataValid, router, locationData.status]);

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
