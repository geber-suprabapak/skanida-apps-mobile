import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  BackHandler,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  FadeIn,
  SlideInDown,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";

import { supabase } from "~/utils/supabase";
import { Camera } from "~/lib/icons/Camera";
import { CameraSwitch } from "~/lib/icons/CameraSwitch";
import { CameraOff } from "~/lib/icons/CameraOff";
import { Loader2 } from "~/lib/icons/Loader2";
import { AlertCircle } from "~/lib/icons/AlertCircle";

// --- CONSTANTS ---
const IMAGE_CONFIG = {
  RESIZE_WIDTH: 800,
  QUALITY: 0.7,
  FORMAT: ImageManipulator.SaveFormat.JPEG, // Changed to JPEG for better compression
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB max
} as const;

const UPLOAD_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  STORAGE_BUCKET: "attendance-photos",
  CHUNK_SIZE: 512 * 1024, // 512KB chunks for large files
  PROGRESSIVE_QUALITY_STEPS: [0.3, 0.5, 0.7], // Progressive quality fallback
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
const createLogger = (component: string) => ({
  debug: (message: string, data?: any) => {
    console.log(
      `${new Date().toISOString()} 🔍 [${component}] ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  info: (message: string, data?: any) => {
    console.info(
      `${new Date().toISOString()} ℹ️ [${component}] ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  warn: (message: string, data?: any) => {
    console.warn(
      `${new Date().toISOString()} ⚠️ [${component}] ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      `${new Date().toISOString()} ❌ [${component}] ${message}`,
      error,
    );
  },
});

const logger = createLogger("CameraAttendance");

// --- MAIN COMPONENT ---
const CameraAttendance = () => {
  // --- HOOKS ---
  const router = useRouter();
  const params = useLocalSearchParams();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // --- STATE ---
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("back");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: "processing",
    percentage: 0,
    message: "Initializing...",
  });
  const [isUploading, setIsUploading] = useState(false);

  // --- ANIMATION VALUES ---
  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // --- MEMOIZED VALUES ---
  const locationData: LocationData = useMemo(() => {
    const latitude = parseFloat(params.latitude as string);
    const longitude = parseFloat(params.longitude as string);

    const data = {
      latitude: isNaN(latitude) ? null : latitude,
      longitude: isNaN(longitude) ? null : longitude,
      userId: (params.userId as string) || null,
      absenceType: (params.absenceType as AbsenceType) || "present",
    };

    logger.debug("Location data parsed", data);
    return data;
  }, [params]);

  const isLocationDataValid = useMemo(() => {
    const isValid =
      locationData.userId !== null &&
      locationData.latitude !== null &&
      locationData.longitude !== null;

    if (!isValid) {
      logger.error("Invalid location data detected", locationData);
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

  // --- UTILITY FUNCTIONS ---
  const base64ToUint8Array = useCallback((base64: string): Uint8Array => {
    if (!base64) {
      throw new Error("Invalid base64 string provided");
    }

    try {
      let binaryString: string;
      if (typeof atob !== "undefined") {
        binaryString = atob(base64);
      } else {
        binaryString = Buffer.from(base64, "base64").toString("binary");
      }

      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      logger.debug("Base64 conversion successful", {
        originalLength: base64.length,
        arrayLength: bytes.length,
      });
      return bytes;
    } catch (error) {
      logger.error("Base64 conversion failed", error);
      throw new Error("Failed to process image data");
    }
  }, []);

  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3; // Earth radius in meters
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    },
    [],
  );

  const generateFileName = useCallback((): string => {
    const fileName = `${currentDateTime.formattedDate}_${currentDateTime.timestamp}_${locationData.userId}.png`;
    logger.debug("Generated filename", { fileName });
    return fileName;
  }, [currentDateTime, locationData.userId]);

  // --- ENHANCED UTILITY FUNCTIONS ---
  const getOptimalImageCompression = useCallback(
    async (
      imageUri: string,
      targetSize: number = IMAGE_CONFIG.MAX_FILE_SIZE,
    ): Promise<CompressionResult> => {
      logger.debug("Starting optimal compression", { imageUri, targetSize });

      for (const quality of UPLOAD_CONFIG.PROGRESSIVE_QUALITY_STEPS) {
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

          // Calculate file size from base64
          const fileSize = (result.base64.length * 3) / 4; // Approximate size

          logger.debug("Compression result", {
            quality,
            fileSize,
            targetSize,
            ratio: fileSize / targetSize,
          });

          if (fileSize <= targetSize) {
            return {
              base64: result.base64,
              size: fileSize,
              quality,
              uri: result.uri,
            };
          }
        } catch (error) {
          logger.warn(`Compression failed at quality ${quality}`, error);
          continue;
        }
      }

      throw new Error("Unable to compress image to target size");
    },
    [],
  );

  const uploadWithProgressiveRetry = useCallback(
    async (
      fileName: string,
      fileBuffer: Uint8Array,
      onProgress?: (progress: number) => void,
    ): Promise<string> => {
      const metrics: Partial<UploadMetrics> = {
        startTime: Date.now(),
        fileSize: fileBuffer.length,
      };

      logger.info("Starting progressive retry upload", {
        fileName,
        fileSize: fileBuffer.length,
        chunks: Math.ceil(fileBuffer.length / UPLOAD_CONFIG.CHUNK_SIZE),
      });

      // Strategy 1: Direct upload for small files
      if (fileBuffer.length <= UPLOAD_CONFIG.CHUNK_SIZE) {
        return await uploadDirectWithRetry(
          fileName,
          fileBuffer,
          onProgress,
          metrics,
        );
      }

      // Strategy 2: Chunked upload for large files
      try {
        return await uploadChunkedWithRetry(
          fileName,
          fileBuffer,
          onProgress,
          metrics,
        );
      } catch (chunkedError) {
        logger.warn(
          "Chunked upload failed, falling back to direct upload",
          chunkedError,
        );
        return await uploadDirectWithRetry(
          fileName,
          fileBuffer,
          onProgress,
          metrics,
        );
      }
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
          logger.debug(
            `Direct upload attempt ${attempt}/${UPLOAD_CONFIG.MAX_RETRIES}`,
            { fileName },
          );

          onProgress?.(20 + (attempt - 1) * 20);

          const uploadStartTime = Date.now();

          // Create upload promise with timeout
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

          logger.info("Direct upload successful", {
            fileName,
            attempt,
            uploadTime,
            fileSize: fileBuffer.length,
            throughput:
              (fileBuffer.length / 1024 / (uploadTime / 1000)).toFixed(2) +
              " KB/s",
          });

          onProgress?.(80);

          // Get signed URL (private bucket)
          const { data: signedData, error: signedErr } = await supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .createSignedUrl(fileName, 60 * 60 * 24); // 24 hours

          if (signedErr) throw signedErr;
          if (!signedData?.signedUrl) {
            throw new Error("Failed to generate signed URL");
          }

          onProgress?.(100);

          if (metrics) {
            metrics.totalTime = Date.now() - metrics.startTime!;
            logger.info("Upload metrics", metrics);
          }

          return signedData.signedUrl;
        } catch (error: any) {
          lastError = error;
          logger.warn(`Direct upload attempt ${attempt} failed`, {
            error: error.message,
            fileName,
            fileSize: fileBuffer.length,
          });

          if (attempt < UPLOAD_CONFIG.MAX_RETRIES) {
            const delay =
              UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
            logger.debug(`Retrying in ${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            onProgress?.(10 * attempt);
          }
        }
      }

      logger.error("All direct upload attempts failed", lastError);
      throw lastError || new Error("Upload failed after multiple attempts");
    },
    [],
  );

  const uploadChunkedWithRetry = useCallback(
    async (
      fileName: string,
      fileBuffer: Uint8Array,
      onProgress?: (progress: number) => void,
      metrics?: Partial<UploadMetrics>,
    ): Promise<string> => {
      const chunks = Math.ceil(fileBuffer.length / UPLOAD_CONFIG.CHUNK_SIZE);
      logger.info("Starting chunked upload", {
        fileName,
        chunks,
        totalSize: fileBuffer.length,
      });

      // For Supabase, we'll simulate chunked upload by splitting into smaller files
      // and then combining them (this is a workaround since Supabase doesn't natively support chunked uploads)
      try {
        const chunkPromises: Promise<string>[] = [];
        const chunkFileNames: string[] = [];

        for (let i = 0; i < chunks; i++) {
          const start = i * UPLOAD_CONFIG.CHUNK_SIZE;
          const end = Math.min(
            start + UPLOAD_CONFIG.CHUNK_SIZE,
            fileBuffer.length,
          );
          const chunk = fileBuffer.slice(start, end);
          const chunkFileName = `${fileName}_chunk_${i}`;

          chunkFileNames.push(chunkFileName);

          const chunkPromise = uploadDirectWithRetry(
            chunkFileName,
            chunk,
            (chunkProgress) => {
              const totalProgress =
                20 + ((i + chunkProgress / 100) / chunks) * 60;
              onProgress?.(totalProgress);
            },
          );

          chunkPromises.push(chunkPromise);
        }

        // Wait for all chunks to upload
        await Promise.all(chunkPromises);

        onProgress?.(85);

        // For simplicity, we'll upload the original file directly since Supabase doesn't have native chunked upload
        // In a real implementation, you'd combine chunks on the server
        const finalUrl = await uploadDirectWithRetry(
          fileName,
          fileBuffer,
          undefined,
          metrics,
        );

        // Cleanup chunk files
        try {
          await supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .remove(chunkFileNames);
          logger.debug("Cleaned up chunk files", {
            count: chunkFileNames.length,
          });
        } catch (cleanupError) {
          logger.warn("Failed to cleanup chunk files", cleanupError);
        }

        return finalUrl;
      } catch (error) {
        logger.error("Chunked upload failed", error);
        throw error;
      }
    },
    [uploadDirectWithRetry],
  );

  const processImageWithOptimization = useCallback(
    async (
      imageUri: string,
      onProgress?: (progress: number) => void,
    ): Promise<CompressionResult> => {
      logger.info("Starting image optimization", { imageUri });
      const startTime = Date.now();

      onProgress?.(10);

      try {
        // Step 1: Get optimal compression
        const compressionResult = await getOptimalImageCompression(imageUri);

        onProgress?.(50);

        const compressionTime = Date.now() - startTime;
        logger.info("Image optimization completed", {
          originalUri: imageUri,
          finalSize: compressionResult.size,
          quality: compressionResult.quality,
          compressionTime,
          compressionRatio:
            (
              (compressionResult.size / IMAGE_CONFIG.MAX_FILE_SIZE) *
              100
            ).toFixed(1) + "%",
        });

        onProgress?.(100);

        return compressionResult;
      } catch (error) {
        logger.error("Image optimization failed", error);
        throw new Error("Failed to optimize image for upload");
      }
    },
    [getOptimalImageCompression],
  );

  const saveAttendanceRecord = useCallback(
    async (photoUrl: string): Promise<void> => {

      // --- TIME-BASED REASON LOGIC ---
      let status = locationData.absenceType === "present" ? "Hadir" : "Pulang";
      let reason = "";
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (locationData.absenceType === "present") {
        // 06:00–07:00 normal, >07:00 late
        if (currentMinutes > 420) {
          reason = "Terlambat";
        }
      } else if (locationData.absenceType === "home") {
        // 15:15–21:00 normal, <15:15 or >21:00 not valid
        if (currentMinutes < 915 || currentMinutes > 1260) {
          reason = "Tidak absen pulang";
        }
      }

      const attendanceData = {
        user_id: locationData.userId,
        date: currentDateTime.date,
        reason,
        photo_url: photoUrl,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        status,
      };

      logger.debug("Saving attendance record", attendanceData);

      const { error } = await supabase
        .from("absences")
        .insert([attendanceData]);

      if (error) {
        logger.error("Failed to save attendance record", error);
        throw new Error(`Gagal menyimpan data absensi: ${error.message}`);
      }

      logger.info("Attendance record saved successfully", { reason });
    },
    [locationData, currentDateTime],
  );

  // Check if user has submitted perizinan today
  const checkTodayPerizinan = useCallback(
    async (userId: string | null): Promise<boolean> => {
      if (!userId) return false;
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data, error } = await supabase
          .from("perizinan")
          .select("id, tanggal")
          .eq("user_id", userId)
          .gte("tanggal", `${today}T00:00:00`)
          .lte("tanggal", `${today}T23:59:59.999`);

        if (error) {
          logger.error("Error checking today's perizinan", error);
          return false;
        }

        return !!(data && data.length > 0);
      } catch (err) {
        logger.error("Unexpected error checking today's perizinan", err);
        return false;
      }
    },
    [],
  );

  const processAndUploadPhoto = useCallback(
    async (base64Data: string): Promise<void> => {
      setIsUploading(true);
      const startTime = Date.now();

      try {
        // Stage 1: Enhanced Processing with optimization
        setUploadProgress({
          stage: "processing",
          percentage: 5,
          message: "Optimizing image quality...",
        });

        // Check network connectivity with enhanced detection
        try {
          const netInfo = await NetInfo.fetch();
          if (!netInfo.isConnected) {
            throw new Error(
              "Tidak ada koneksi internet. Silakan cek koneksi Anda.",
            );
          }

          // Log network quality for debugging
          logger.debug("Network status", {
            isConnected: netInfo.isConnected,
            type: netInfo.type,
            isInternetReachable: netInfo.isInternetReachable,
          });
        } catch (netErr) {
          logger.warn("NetInfo check failed, continuing anyway", netErr);
        }

        setUploadProgress({
          stage: "processing",
          percentage: 15,
          message: "Converting and compressing image...",
        });

        // Convert base64 to file buffer with size optimization
        const fileBuffer = base64ToUint8Array(base64Data);
        logger.info("Initial file buffer created", { size: fileBuffer.length });

        // If file is too large, we need to re-compress
        if (fileBuffer.length > IMAGE_CONFIG.MAX_FILE_SIZE) {
          logger.warn("File too large, attempting recompression", {
            currentSize: fileBuffer.length,
            maxSize: IMAGE_CONFIG.MAX_FILE_SIZE,
          });

          // This would require re-processing from original image
          throw new Error(
            "Image file too large after compression. Please try again.",
          );
        }

        const fileName = generateFileName();

        setUploadProgress({
          stage: "processing",
          percentage: 25,
          message: "Preparing upload strategy...",
        });

        // Stage 2: Enhanced Uploading with progressive retry
        setUploadProgress({
          stage: "uploading",
          percentage: 30,
          message: "Uploading photo with optimal strategy...",
        });

        const photoUrl = await uploadWithProgressiveRetry(
          fileName,
          fileBuffer,
          (uploadProgress) => {
            const stageProgress = 30 + (uploadProgress / 100) * 50; // 30-80% range
            setUploadProgress({
              stage: "uploading",
              percentage: Math.round(stageProgress),
              message:
                uploadProgress === 100
                  ? "Upload completed successfully!"
                  : `Uploading... ${Math.round(uploadProgress)}%`,
            });
          },
        );

        // Stage 3: Saving with validation
        setUploadProgress({
          stage: "saving",
          percentage: 85,
          message: "Validating upload and saving record...",
        });

        // Validate uploaded file before saving record
        try {
          const response = await fetch(photoUrl, { method: "HEAD" });
          if (!response.ok) {
            throw new Error("Uploaded file validation failed");
          }
          logger.info("Upload validation successful", {
            url: photoUrl,
            status: response.status,
            contentLength: response.headers.get("content-length"),
          });
        } catch (validationError) {
          logger.warn(
            "Upload validation failed, continuing anyway",
            validationError,
          );
        }

        // If the user submitted perizinan today, block any attendance (present or pulang)
        const hasPerizinan = await checkTodayPerizinan(locationData.userId);
        if (hasPerizinan) {
          logger.warn("Blocking attendance because perizinan exists today", {
            userId: locationData.userId,
          });
          Alert.alert(
            "Tidak dapat melakukan absensi",
            "Anda telah mengajukan izin hari ini sehingga tidak dapat melakukan absensi (masuk atau pulang).",
          );
          setIsUploading(false);
          return;
        }
  // Removed strict time blocking per updated requirement.
  // Reason for late / invalid time is now handled inside saveAttendanceRecord()

        await saveAttendanceRecord(photoUrl);

        setUploadProgress({
          stage: "saving",
          percentage: 100,
          message: "Attendance saved successfully!",
        });

        const totalTime = Date.now() - startTime;
        const reason =
          locationData.absenceType === "present" ? "Hadir" : "Pulang";

        logger.info("Complete attendance process finished", {
          reason,
          totalTime,
          fileSize: fileBuffer.length,
          fileName,
          photoUrl,
        });

        // Navigate back to dashboard with success parameters
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
        logger.error("Enhanced photo processing and upload failed", error);

        // Enhanced cleanup with retry
        try {
          const fileName = generateFileName();
          await supabase.storage
            .from(UPLOAD_CONFIG.STORAGE_BUCKET)
            .remove([fileName]);
          logger.debug("Cleaned up failed upload file");
        } catch (cleanupError) {
          logger.warn("Failed to cleanup file after error", cleanupError);
        }

        // More specific error messages based on error type
        let errorMessage = "Gagal menyimpan data absensi. Silakan coba lagi.";

        if (error?.message?.includes("timeout")) {
          errorMessage =
            "Upload timeout. Periksa koneksi internet dan coba lagi.";
        } else if (error?.message?.includes("network")) {
          errorMessage =
            "Masalah koneksi jaringan. Pastikan koneksi internet stabil.";
        } else if (error?.message?.includes("too large")) {
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
      uploadWithProgressiveRetry,
      saveAttendanceRecord,
      router,
    ],
  );

  // --- EVENT HANDLERS ---
  const handleCameraReady = useCallback(() => {
    logger.debug("Camera ready");
    setIsCameraReady(true);
  }, []);

  const handleTakePicture = useCallback(async () => {
    if (!isCameraReady || !cameraRef.current || isCapturingPhoto) {
      logger.warn(
        "Cannot take picture - camera not ready or already capturing",
      );
      return;
    }

    setIsCapturingPhoto(true);
    buttonScale.value = withSpring(0.9);

    try {
      logger.debug("Starting enhanced photo capture");

      const captureOptions = {
        quality: 0.9,
        base64: false,
        skipProcessing: true,
        exif: false,
      };

      const photo = await cameraRef.current.takePictureAsync(captureOptions);

      if (!photo?.uri) {
        throw new Error("Failed to capture photo - no data returned");
      }

      logger.info("Photo captured successfully", {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });

      logger.debug("Starting enhanced image optimization");

      const optimizationResult = await processImageWithOptimization(
        photo.uri,
        (progress) => {
          logger.debug("Image processing progress", { progress });
        },
      );

      logger.info("Enhanced image processing completed", {
        originalUri: photo.uri,
        optimizedSize: optimizationResult.size,
        quality: optimizationResult.quality,
        base64Length: optimizationResult.base64.length,
      });

      await processAndUploadPhoto(optimizationResult.base64);
    } catch (error) {
      logger.error("Enhanced photo capture/processing failed", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengambil foto. Silakan coba lagi.",
      );
    } finally {
      setIsCapturingPhoto(false);
      buttonScale.value = withSpring(1);
    }
  }, [
    isCameraReady,
    isCapturingPhoto,
    buttonScale,
    processImageWithOptimization,
    processAndUploadPhoto,
  ]);

  const handleToggleCameraFacing = useCallback(() => {
    setCameraFacing((current) => {
      const newFacing = current === "back" ? "front" : "back";
      logger.debug("Camera facing toggled", { from: current, to: newFacing });
      return newFacing;
    });
  }, []);

  const handleBackPress = useCallback(() => {
    if (isUploading) {
      Alert.alert(
        "Upload in Progress",
        "An upload is in progress. Are you sure you want to go back?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Go Back",
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
    logger.info("CameraAttendance component mounted");

    // Validate location data on mount
    if (!isLocationDataValid) {
      Alert.alert(
        "Error",
        "Data absensi tidak lengkap. Silakan kembali dan coba lagi.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    }

    return () => {
      logger.info("CameraAttendance component unmounted");
    };
  }, [isLocationDataValid, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  useEffect(() => {
    const initializeCamera = async () => {
      if (!permission?.granted) {
        logger.debug("Requesting camera permission");
        const result = await requestPermission();
        if (!result.granted) {
          logger.warn("Camera permission denied");
          Alert.alert(
            "Camera Permission Required",
            "Please grant camera permission to take attendance photos.",
          );
        }
      }
    };

    initializeCamera();
  }, [permission, requestPermission]);

  // --- RENDER COMPONENTS ---
  const renderLoadingState = (message: string) => (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0066FF" />
        <Text className="text-white text-lg text-center mx-5 mt-4">
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );

  const renderPermissionRequest = () => (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 justify-center items-center">
        <Animated.View
          entering={FadeIn.duration(500)}
          className="items-center justify-center"
        >
          <Camera size={80} color="#0066FF" />
          <Text className="text-white text-2xl font-bold text-center mt-4 mb-2">
            Camera Access Needed
          </Text>
          <Text className="text-white/80 text-base text-center mx-10 mb-8">
            We need your permission to use the camera for attendance
          </Text>
          <TouchableOpacity
            className="bg-[#0066FF] px-8 py-4 rounded-lg"
            activeOpacity={0.7}
            onPress={requestPermission}
          >
            <Camera size={24} color="white" />
            <Text className="text-white text-base font-bold ml-2">
              Grant Permission
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );

  const renderErrorState = () => (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 justify-center items-center">
        <Animated.View
          entering={FadeIn.duration(500)}
          className="items-center justify-center"
        >
          <AlertCircle size={80} color="#ff4d4f" />
          <Text className="text-red-400 text-2xl font-bold text-center mt-4 mb-2">
            Camera Error
          </Text>
          <Text className="text-white/80 text-base text-center mx-10 mb-8">
            Terjadi kesalahan pada kamera. Silakan coba lagi.
          </Text>
          <TouchableOpacity
            className="bg-[#0066FF] px-8 py-4 rounded-lg"
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <CameraOff size={24} color="white" />
            <Text className="text-white text-base font-bold ml-2">Kembali</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );

  const renderUploadProgress = () => (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 justify-center items-center">
        <Animated.View
          entering={FadeIn.duration(400)}
          className="items-center justify-center w-4/5"
        >
          <Loader2 size={32} color="#0066FF" className="animate-spin" />
          <Text className="text-white text-xl font-semibold mt-4 mb-2">
            Saving Attendance...
          </Text>
          <Text className="text-white/70 text-base text-center mb-8">
            {uploadProgress.message}
          </Text>
          <View className="w-full h-2 bg-gray-700 rounded-full">
            <View
              className="h-full bg-[#0066FF] rounded-full"
              style={{ width: `${uploadProgress.percentage}%` }}
            />
          </View>
          <Text className="text-white/70 text-sm mt-2">
            {uploadProgress.percentage}%
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );

  // --- MAIN RENDER ---
  if (!permission) {
    return renderLoadingState("Requesting camera permission...");
  }

  if (!permission.granted) {
    return renderPermissionRequest();
  }

  if (isUploading) {
    return renderUploadProgress();
  }

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-1">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={cameraFacing}
          onCameraReady={handleCameraReady}
        >
          {isCameraReady ? (
            <>
              {/* Status bar safe area */}
              <View className="w-full h-10" />

              {/* Top bar */}
              <View className="flex-row items-center justify-between px-4">
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-[#0066FF] justify-center items-center shadow-lg"
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                >
                  <CameraOff size={24} color="white" />
                </TouchableOpacity>

                <Animated.View
                  entering={SlideInDown.duration(400)}
                  className="flex-1 mx-3 bg-black/60 py-2 px-3 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Camera size={16} color="#0066FF" />
                    <Text className="text-white text-sm ml-1">
                      {locationData.latitude?.toFixed(4)},{" "}
                      {locationData.longitude?.toFixed(4)}
                    </Text>
                  </View>
                  <Text className="text-white/70 text-xs">
                    {currentDateTime.displayTime}
                  </Text>
                </Animated.View>
              </View>

              {/* Camera Controls */}
              <View className="absolute bottom-12 left-0 right-0 flex-row justify-around items-center px-5">
                <TouchableOpacity
                  className="w-16 h-16 rounded-full bg-black/50 justify-center items-center"
                  onPress={handleToggleCameraFacing}
                  activeOpacity={0.7}
                >
                  <CameraSwitch size={28} color="white" />
                </TouchableOpacity>

                <Animated.View
                  style={animatedButtonStyle}
                  className="w-24 h-24 rounded-full bg-white/30 justify-center items-center"
                >
                  <TouchableOpacity
                    className="w-20 h-20 rounded-full bg-white justify-center items-center"
                    onPress={handleTakePicture}
                    disabled={isCapturingPhoto || !isCameraReady}
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
            </>
          ) : (
            <View className="flex-1 justify-center items-center bg-black/70">
              <ActivityIndicator size="large" color="#0066FF" />
              <Text className="text-white mt-3">Initializing camera...</Text>
            </View>
          )}
        </CameraView>
      </View>
    </View>
  );
};

export default CameraAttendance;
