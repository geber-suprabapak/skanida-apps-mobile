import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  BackHandler,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  FadeIn,
  SlideInDown,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "~/utils/supabase";

// Import NetInfo with proper error handling
let NetInfo: any;
try {
  NetInfo = require("@react-native-community/netinfo").default;
} catch (error) {
  console.warn("Failed to import NetInfo:", error);
  // Provide a fallback implementation
  NetInfo = {
    addEventListener: () => ({ remove: () => {} }),
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
  };
}

Dimensions.get("window");

const CameraAttendance = () => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  // Use string literal type for facing state
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  // Get location data passed from AbsenceReport screen
  const params = useLocalSearchParams();
  const locationData = {
    latitude: parseFloat(params.latitude as string) || 0,
    longitude: parseFloat(params.longitude as string) || 0,
    timestamp: (params.timestamp as string) || new Date().toISOString(),
    userId: (params.userId as string) || "",
  };

  // Animation for camera button press
  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Function to animate button press

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isUploading) {
          Alert.alert(
            "Upload in Progress",
            "An upload is in progress. Are you sure you want to go back? This will cancel the upload.",
            [
              { text: "Cancel", style: "cancel", onPress: () => {} },
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
      },
    );

    return () => backHandler.remove();
  }, [isUploading]);

  // Log component mount and unmount
  useEffect(() => {
    return () => {
      setIsCameraReady(false);
    };
  }, []);

  // Initialize camera and permissions
  useEffect(() => {
    // Request camera permissions immediately
    const initializeCamera = async () => {
      try {
        if (permission && !permission.granted) {
          const permissionResult = await requestPermission();

          if (!permissionResult.granted) {
            Alert.alert(
              "Camera Permission Required",
              "Please grant camera permission to take attendance photos.",
            );
          }
        } else if (!permission) {
          const permissionResult = await requestPermission();
          if (!permissionResult.granted) {
            Alert.alert(
              "Camera Permission Required",
              "Please grant camera permission to take attendance photos.",
            );
          }
        }
      } catch (err) {
        console.error("Error requesting permission:", err); // Keep error log
        setCameraError("Failed to request camera permissions");
      }
    };

    initializeCamera();

    // Check location data
    if (
      !locationData.userId ||
      !locationData.latitude ||
      !locationData.longitude
    ) {
      Alert.alert(
        "Error",
        "Location data is missing. Please go back and try again.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    }
  }, [permission, requestPermission]);

  // Handle camera ready state
  const onCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  // Utility: convert base64 string to Uint8Array safely
  const base64ToUint8Array = useCallback((base64: string) => {
    if (!base64) {
      throw new Error("Invalid base64 string");
    }

    try {
      let binaryString: string;
      if (typeof atob !== "undefined") {
        binaryString = atob(base64);
      } else {
        binaryString = Buffer.from(base64, "base64").toString("binary");
      }

      const len = binaryString.length;
      const bytes = new Uint8Array(len);

      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return bytes;
    } catch (error) {
      console.error("Error converting base64 to Uint8Array:", error); // Keep error log
      throw new Error("Failed to process image data");
    }
  }, []);

  // Save attendance data to Supabase
  const saveAttendanceToSupabase = async (base64Data: string) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(10);

      // Check for network connectivity first
      try {
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          throw new Error(
            "Tidak ada koneksi internet. Silakan cek koneksi Anda.",
          );
        }
      } catch {
        // Continue even if NetInfo fails
      }

      setUploadProgress(20);

      // Get current date and time information
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];
      const formattedDate = currentDate.replace(/-/g, "");
      const currentTimestamp = Date.now();

      // Create a reason for the attendance (could be customized based on your needs)
      const reason = "Present";

      setUploadProgress(30);

      // Prepare file for upload
      if (!base64Data) {
        throw new Error("Received empty base64 data for upload");
      }

      // Generate unique filename
      const fileName = `${formattedDate}_${currentTimestamp}_${locationData.userId}.png`;

      setUploadProgress(40);

      // Convert base64 to Uint8Array (buffer)
      const fileBuffer = base64ToUint8Array(base64Data);

      setUploadProgress(50);

      // Upload the buffer to Supabase storage with retry logic
      let uploadAttempt = 0;
      let lastError: Error | null = null; // Store the last error

      while (uploadAttempt < 3) {
        try {
          const { error: storageError } = await supabase.storage
            .from("attendance-photos")
            .upload(fileName, fileBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (storageError) {
            lastError = storageError; // Store the error
            uploadAttempt++;
            console.warn(
              `Upload attempt ${uploadAttempt} failed:`,
              storageError.message,
            ); // Keep warning for failed attempts
            if (uploadAttempt < 3) {
              // Wait before retry (exponential backoff)
              const delay = Math.pow(2, uploadAttempt) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } else {
            lastError = null; // Clear error on success
            break; // Exit loop on success
          }
        } catch (err: any) {
          lastError = err; // Store the error
          uploadAttempt++;
          console.warn(
            `Upload attempt ${uploadAttempt} failed with exception:`,
            err.message,
          ); // Keep warning for failed attempts
          if (uploadAttempt < 3) {
            const delay = Math.pow(2, uploadAttempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // If all attempts failed, throw the last encountered error
      if (lastError) {
        console.error("Upload failed after multiple attempts."); // Keep error log
        throw lastError;
      }

      setUploadProgress(70);

      // Get public URL for the uploaded photo
      const { data: publicUrlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData?.publicUrl;

      setUploadProgress(85);

      // Get current date (without time) for date filtering
      const currentDateOnly = now.toISOString().split("T")[0];
      // Check if this is the first attendance today (Pagi - Masuk) or second (Sore - Pulang)
      const { data: todayAttendances, error: queryError } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", locationData.userId)
        .gte("timestamp", `${currentDateOnly}T00:00:00`)
        .lte("timestamp", `${currentDateOnly}T23:59:59`)
        .order("timestamp", { ascending: true });

      if (queryError) {
        throw new Error(
          `Failed to check existing attendance: ${queryError.message}`,
        );
      }

      // Determine if this is morning (Datang) or afternoon (Pulang) attendance
      const isPulang = todayAttendances && todayAttendances.length > 0;
      const attendanceStatus = isPulang ? "Pulang" : "Datang"; // Insert attendance record with the photo URL
      const { error: attendanceError } = await supabase
        .from("attendance")
        .insert({
          user_id: locationData.userId,
          timestamp: new Date().toISOString(),
          date: currentDateOnly, // Store date without time for easier filtering
          status: attendanceStatus, // "Datang" or "Pulang"
          location_latitude: locationData.latitude,
          location_longitude: locationData.longitude,
          photo_url: photoUrl || null,
          reason,
        });

      if (attendanceError) {
        throw new Error(
          `Failed to save attendance: ${attendanceError.message}`,
        );
      }

      setUploadProgress(100);

      // Show success message and navigate back
      Alert.alert(
        "Success",
        `Absen ${isPulang ? "Pulang" : "Datang"} telah berhasil dicatat.`,
        [
          {
            text: "OK",
            onPress: () => {
              router.back(); // Go back to previous screen
            },
          },
        ],
      );
    } catch (error: any) {
      // Handle errors
      let errorMessage = "An unknown error occurred.";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Check for network-related errors
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("internet") ||
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("offline")
      ) {
        errorMessage =
          "Network issue detected. Please check your internet connection and try again.";
      }

      console.error("Attendance submission error:", error);
      Alert.alert("Error", errorMessage, [
        {
          text: "Try Again",
          style: "cancel",
        },
        {
          text: "Go Back",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  // Take a picture
  const takePicture = async () => {
    if (isTakingPicture || isUploading || !isCameraReady) return;

    setIsTakingPicture(true);

    try {
      // Take the picture
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (!photo) {
        throw new Error("Failed to capture photo");
      }

      // Process the image
      let processedPhoto = photo;

      // Use ImageManipulator to resize and compress if needed
      if (photo.uri) {
        processedPhoto = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 800 } }], // Resize to reasonable dimensions
          {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
      }

      // Upload to Supabase
      if (processedPhoto.base64) {
        await saveAttendanceToSupabase(processedPhoto.base64);
      } else {
        throw new Error("Processed photo missing base64 data");
      }
    } catch (error: any) {
      console.error("Error taking picture:", error);
      Alert.alert(
        "Camera Error",
        `Failed to take picture: ${error.message || "Unknown error"}`,
      );
    } finally {
      setIsTakingPicture(false);
    }
  };

  // Flip camera between front and back
  const flipCamera = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  // Check if there's any error to display
  const hasError = cameraError !== "";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-black">
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Camera View */}
        {!hasError && (
          <CameraView
            ref={cameraRef}
            className="flex-1"
            facing={facing}
            onCameraReady={onCameraReady}
            onMountError={(errorMsg) => {
              setCameraError(errorMsg.toString());
              console.error("Camera error:", errorMsg);
            }}
          />
        )}

        {/* Error Display */}
        {hasError && (
          <View className="flex-1 justify-center items-center bg-black p-6">
            <Text className="text-white text-lg text-center mb-4">
              Camera Error: {cameraError}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setCameraError("");
                router.back();
              }}
              className="bg-white py-3 px-6 rounded-lg"
            >
              <Text className="text-black font-medium">Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading Overlay */}
        {isUploading && (
          <Animated.View
            entering={FadeIn}
            className="absolute inset-0 bg-black/80 justify-center items-center"
          >
            <ActivityIndicator size="large" color="#fff" />
            <Text className="text-white mt-4 text-lg font-medium">
              Uploading... {uploadProgress}%
            </Text>
            {uploadProgress > 0 && (
              <View className="w-4/5 h-2 bg-gray-700 rounded-full mt-4">
                <View
                  className="h-full bg-white rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </View>
            )}
          </Animated.View>
        )}

        {/* Controls Overlay */}
        {!hasError && !isUploading && (
          <View className="absolute inset-0 pointer-events-none">
            {/* Header Area */}
            <View className="flex-row justify-between items-center p-4 pointer-events-auto">
              <TouchableOpacity
                onPress={() => router.back()}
                className="p-2 bg-black/50 rounded-full"
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={flipCamera}
                className="p-2 bg-black/50 rounded-full"
              >
                <Ionicons name="camera-reverse" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Bottom Area */}
            <View className="flex-1 justify-end">
              <View className="bg-black/30 pb-10">
                {/* Camera Button */}
                <Animated.View
                  style={animatedButtonStyle}
                  className="items-center py-8"
                >
                  <TouchableOpacity
                    onPress={takePicture}
                    disabled={isTakingPicture || !isCameraReady}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
                    activeOpacity={0.8}
                  >
                    {" "}
                    <View
                      className={`w-16 h-16 rounded-full bg-white ${
                        isTakingPicture ? "opacity-50" : ""
                      }`}
                    />
                  </TouchableOpacity>
                </Animated.View>

                {/* Take Photo Text */}
                <Animated.Text
                  entering={SlideInDown.delay(300)}
                  className="text-white text-center text-lg font-medium"
                >
                  Take Photo
                </Animated.Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
};

export default CameraAttendance;
