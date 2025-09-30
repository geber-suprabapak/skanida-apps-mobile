import {
  Camera,
  PhotoFile,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
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

// --- CONSTANTS ---
const IMAGE_CONFIG = {
  RESIZE_WIDTH: 800,
  FORMAT: ImageManipulator.SaveFormat.JPEG, // JPEG keeps quality with smaller size
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB max
  QUALITY_STEPS: [0.85, 0.7, 0.55, 0.4],
} as const;

const UPLOAD_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  STORAGE_BUCKET: "attendance-photos",
  // Timeout 30 detik diperlukan karena:
  // 1. Foto attendance biasanya berukuran besar (high quality untuk verifikasi)
  // 2. Koneksi mobile bisa tidak stabil, membutuhkan waktu lebih lama
  // 3. Supabase storage perlu waktu untuk memproses dan generate public URL
  // 4. Mencegah abort upload yang sebenarnya masih berlangsung
  // 5. Memberikan buffer untuk retry mechanism jika ada gangguan sementara
  TIMEOUT_MS: 30000, // 30 seconds timeout
} as const;

// --- TYPES AND INTERFACES ---
type CameraFacing = "front" | "back";
type AbsenceType = "present" | "home";
type UploadStage = "processing" | "uploading" | "saving";

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  userId: string | null;
  absenceType: AbsenceType;
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
  uri: string;
}

interface UploadMetrics {
  startTime: number;
  fileSize: number;
  compressionTime: number;
  uploadTime: number;
  totalTime: number;
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

    const data: LocationData = {
      latitude: Number.isNaN(latitude) ? null : latitude,
      longitude: Number.isNaN(longitude) ? null : longitude,
      userId: (params.userId as string) || null,
      absenceType: (params.absenceType as AbsenceType) || "present",
    };

    return data;
  }, [params]);

  const isLocationDataValid = useMemo(() => {
    const isValid =
      locationData.userId !== null &&
      locationData.latitude !== null &&
      locationData.longitude !== null;

    if (!isValid) {
    }

    return isValid;
  }, [locationData]);

  const currentDateTime = useMemo(() => {
    const now = new Date();
    return {
      date: now.toISOString().split("T")[0],
      formattedDate: now.toISOString().split("T")[0].replace(/-/g, ""),
      timestamp: Date.now(),
      displayTime: now.toLocaleString(),
    };
  }, []);

  // --- UTILITY FUNCTIONS (HOOKED) ---
  const base64ToUint8Array = useCallback((base64: string): Uint8Array => {
    if (!base64) {
      throw new Error("Invalid base64 string provided");
    }

    try {
      const buffer = Buffer.from(base64, "base64");
      return buffer;
    } catch {
      throw new Error("Failed to process image data");
    }
  }, []);

  const generateFileName = useCallback((): string => {
    const fileName = `${currentDateTime.formattedDate}_${currentDateTime.timestamp}_${locationData.userId}.png`;
    return fileName;
  }, [currentDateTime, locationData.userId]);

  const getOptimalImageCompression = useCallback(
    async (
      imageUri: string,
      targetSize: number = IMAGE_CONFIG.MAX_FILE_SIZE,
    ): Promise<CompressionResult> => {
      for (const quality of IMAGE_CONFIG.QUALITY_STEPS) {
        try {
          const result = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ resize: { width: IMAGE_CONFIG.RESIZE_WIDTH } }],
            {
              compress: quality,
              format: IMAGE_CONFIG.FORMAT,
              base64: true,
            },
          );

          if (!result.base64) {
            throw new Error(`Compression failed at quality ${quality}`);
          }

          const fileSize = (result.base64.length * 3) / 4; // Approximate size

          if (fileSize <= targetSize) {
            return {
              base64: result.base64,
              size: fileSize,
              quality,
              uri: result.uri,
            };
          }
        } catch {
          // Continue with next quality level if compression fails
        }
      }

      throw new Error("Unable to compress image to target size");
    },
    [],
  );

  const uploadDirectWithRetry = useCallback(
    async (
      fileName: string,
      fileBuffer: Uint8Array,
      onProgress?: (progress: number) => void,
      metrics?: Partial<UploadMetrics>,
    ): Promise<string> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        try {
          onProgress?.(15 + (attempt - 1) * 10);

          const uploadStartTime = Date.now();
          const uploadPromise = supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .upload(fileName, fileBuffer, {
              contentType:
                IMAGE_CONFIG.FORMAT === ImageManipulator.SaveFormat.JPEG
                  ? "image/jpeg"
                  : "image/png",
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

          const uploadTime = Date.now() - uploadStartTime;
          if (metrics) metrics.uploadTime = uploadTime;

          onProgress?.(85);

          const { data: signedData, error: signedErr } = await supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .createSignedUrl(fileName, 60 * 60 * 24);

          if (signedErr) throw signedErr;
          if (!signedData?.signedUrl) {
            throw new Error("Failed to generate signed URL");
          }

          onProgress?.(100);

          if (metrics) {
            metrics.totalTime = Date.now() - metrics.startTime!;
          }

          return signedData.signedUrl;
        } catch (error: any) {
          lastError = error;

          if (attempt < UPLOAD_CONFIG.MAX_RETRIES) {
            const delay =
              UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            onProgress?.(20 + attempt * 10);
          }
        }
      }

      throw lastError || new Error("Upload failed after multiple attempts");
    },
    [],
  );

  const uploadWithRetry = useCallback(
    async (
      fileName: string,
      fileBuffer: Uint8Array,
      onProgress?: (progress: number) => void,
    ): Promise<string> => {
      const metrics: Partial<UploadMetrics> = {
        startTime: Date.now(),
        fileSize: fileBuffer.length,
      };

      return uploadDirectWithRetry(fileName, fileBuffer, onProgress, metrics);
    },
    [uploadDirectWithRetry],
  );

  const processImageWithOptimization = useCallback(
    async (
      imageUri: string,
      onProgress?: (progress: number) => void,
    ): Promise<CompressionResult> => {
      onProgress?.(10);

      try {
        const compressionResult = await getOptimalImageCompression(imageUri);

        onProgress?.(55);

        onProgress?.(100);

        return compressionResult;
      } catch {
        throw new Error("Failed to optimize image for upload");
      }
    },
    [getOptimalImageCompression],
  );

  const saveAttendanceRecord = useCallback(
    async (photoUrl: string): Promise<void> => {
      const status =
        locationData.absenceType === "present" ? "Hadir" : "Pulang";

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
    async (optimizedResult: CompressionResult): Promise<void> => {
      setIsUploading(true);
      const startTime = Date.now();

      try {
        setUploadProgress({
          stage: "processing",
          percentage: 5,
          message: "Memeriksa koneksi...",
        });

        try {
          const netInfo = await NetInfo.fetch();
          if (!netInfo.isConnected) {
            throw new Error(
              "Tidak ada koneksi internet. Silakan cek koneksi Anda.",
            );
          }
        } catch (netErr) {
          console.warn("NetInfo check failed, continuing anyway", netErr);
        }

        setUploadProgress({
          stage: "processing",
          percentage: 20,
          message: "Menyiapkan file untuk diunggah...",
        });

        const fileBuffer = base64ToUint8Array(optimizedResult.base64);
        if (fileBuffer.length > IMAGE_CONFIG.MAX_FILE_SIZE) {
          throw new Error(
            "Image file terlalu besar setelah optimasi. Coba ambil foto lagi.",
          );
        }

        const fileName = generateFileName();

        setUploadProgress({
          stage: "uploading",
          percentage: 35,
          message: "Mengunggah foto...",
        });

        const photoUrl = await uploadWithRetry(
          fileName,
          fileBuffer,
          (progress: number) => {
            const stageProgress = 35 + (progress / 100) * 45;
            setUploadProgress({
              stage: "uploading",
              percentage: Math.round(stageProgress),
              message:
                progress === 100
                  ? "Foto berhasil diunggah!"
                  : `Mengunggah... ${Math.round(progress)}%`,
            });
          },
        );

        setUploadProgress({
          stage: "saving",
          percentage: 85,
          message: "Memverifikasi unggahan...",
        });

        try {
          const response = await fetch(photoUrl, { method: "HEAD" });
          if (!response.ok) {
            throw new Error("Uploaded file validation failed");
          }
        } catch (validationError) {
          console.warn(
            "Upload validation failed, continuing anyway",
            validationError,
          );
        }

        await saveAttendanceRecord(photoUrl);

        setUploadProgress({
          stage: "saving",
          percentage: 100,
          message: "Absensi berhasil disimpan!",
        });

        const totalTime = Date.now() - startTime;

        const currentTime = new Date().toLocaleTimeString("id-ID", {
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
        try {
          const fileName = generateFileName();
          await supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .remove([fileName]);
        } catch (cleanupError) {
          console.warn("Failed to cleanup file after error", cleanupError);
        }

        let errorMessage = "Gagal menyimpan data absensi. Silakan coba lagi.";

        if (error?.message?.includes("timeout")) {
          errorMessage =
            "Upload timeout. Periksa koneksi internet dan coba lagi.";
        } else if (error?.message?.includes("network")) {
          errorMessage =
            "Masalah koneksi jaringan. Pastikan koneksi internet stabil.";
        } else if (error?.message?.includes("terlalu besar")) {
          errorMessage = "Ukuran file terlalu besar. Coba ambil foto lagi.";
        }

        Alert.alert("Error", error?.message || errorMessage);
      } finally {
        setIsUploading(false);
      }
    },
    [
      locationData,
      base64ToUint8Array,
      generateFileName,
      uploadWithRetry,
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

      const optimizationResult = await processImageWithOptimization(photoUri);

      await processAndUploadPhoto(optimizationResult);
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
  }, [
    cameraFacing,
    isCameraReady,
    isCapturingPhoto,
    processImageWithOptimization,
    processAndUploadPhoto,
  ]);

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
      Alert.alert(
        "Error",
        "Data absensi tidak lengkap. Silakan kembali dan coba lagi.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    }

    return () => {};
  }, [isLocationDataValid, router]);

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
  const renderFullScreenMessage = useCallback(
    (message: string) => (
      <SafeAreaView
        className="flex-1 bg-black"
        edges={["top", "left", "right"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color="#0066FF" />
          <Text variant="large" className="text-white text-center mt-4">
            {message}
          </Text>
        </View>
      </SafeAreaView>
    ),
    [],
  );

  // --- MAIN RENDER ---
  const permissionResolved = typeof hasPermission === "boolean";

  if (!permissionResolved) {
    return renderFullScreenMessage("Memeriksa izin kamera...");
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
    return renderFullScreenMessage("Menyiapkan kamera perangkat...");
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
          className="flex-1"
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

              <Animated.View className="w-24 h-24 rounded-full bg-white/30 justify-center items-center">
                <TouchableOpacity
                  className="w-20 h-20 rounded-full bg-white justify-center items-center"
                  onPress={handleTakePicture}
                  disabled={isCapturingPhoto || !isCameraReady || isUploading}
                  activeOpacity={0.8}
                >
                  {isCapturingPhoto ? (
                    <ActivityIndicator size="large" color="#0066FF" />
                  ) : (
                    <View className="w-16 h-16 rounded-full bg-[#0066FF]" />
                  )}
                </TouchableOpacity>
              </Animated.View>

              <View className="w-16 h-16" />
            </View>
          </View>
        </SafeAreaView>
      </View>

      {!isCameraReady && (
        <View className="absolute inset-0 bg-black/70 justify-center items-center">
          <ActivityIndicator size="large" color="#0066FF" />
          <Text variant="default" className="text-white mt-3">
            Menyiapkan kamera...
          </Text>
        </View>
      )}

      {isUploading && (
        <View className="absolute inset-0 bg-black/80 justify-center items-center px-8">
          <Animated.View className="items-center justify-center w-full">
            <Icon as={Loader2} className="size-8 text-[#0066FF]" />
            <Text variant="h2" className="text-white mt-4 mb-2">
              Menyimpan absensi...
            </Text>
            <Text variant="default" className="text-white/70 text-center mb-8">
              {uploadProgress.message}
            </Text>
            <View className="w-full h-2 bg-gray-700 rounded-full">
              <View
                className="h-full bg-[#0066FF] rounded-full"
                style={{ width: `${uploadProgress.percentage}%` }}
              />
            </View>
            <Text variant="small" className="text-white/70 mt-2">
              {uploadProgress.percentage}%
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

export default CameraAttendance;
