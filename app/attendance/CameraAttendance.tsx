import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
// Remove CameraFacing import
// import { CameraFacing } from "expo-camera";
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
    // console.log("[CameraAttendance] CameraAttendance component mounted");
    return () => {
      // console.log("[CameraAttendance] CameraAttendance component unmounted");
      setIsCameraReady(false);
    };
  }, []);

  // Initialize camera and permissions
  useEffect(() => {
    // Request camera permissions immediately
    const initializeCamera = async () => {
      // console.log("[CameraAttendance] Initializing camera and permissions...");
      try {
        // console.log(`[CameraAttendance] Initial permission status: ${permission ? permission.granted : 'null'}`);
        if (permission && !permission.granted) {
          // console.log("[CameraAttendance] Requesting camera permission...");
          const permissionResult = await requestPermission();
          // console.log(`[CameraAttendance] Permission result: ${permissionResult.granted}`);

          if (!permissionResult.granted) {
            Alert.alert(
              "Camera Permission Required",
              "Please grant camera permission to take attendance photos.",
            );
          }
        } else if (!permission) {
          // console.log("[CameraAttendance] Requesting initial camera permission...");
          const permissionResult = await requestPermission();
          // console.log(`[CameraAttendance] Initial camera permission result: ${permissionResult.granted}`);
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
    // console.log("CameraView onCameraReady fired!");
    // console.log("Camera is ready!");
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
      // console.log("Saving attendance data to Supabase...");
      setUploadProgress(10);

      // Check for network connectivity first
      try {
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          throw new Error(
            "Tidak ada koneksi internet. Silakan cek koneksi Anda.",
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (netErr) {
        // console.warn("NetInfo error (continuing anyway):", netErr);
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
      // console.log("Processing image data...");
      if (!base64Data) {
        throw new Error("Received empty base64 data for upload");
      }

      // Generate unique filename
      const fileName = `${formattedDate}_${currentTimestamp}_${locationData.userId}.png`;
      // console.log("Generated filename for storage:", fileName);

      setUploadProgress(40);

      // Convert base64 to Uint8Array (buffer)
      const fileBuffer = base64ToUint8Array(base64Data);

      setUploadProgress(50);

      // Upload the buffer to Supabase storage with retry logic
      // console.log("Uploading photo to storage...");
      let uploadAttempt = 0;
      let storageResult = null;
      let lastError: Error | null = null; // Store the last error

      while (uploadAttempt < 3) {
        try {
          const { data: storageData, error: storageError } =
            await supabase.storage
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
              // console.log(`Retrying upload in ${delay / 1000} seconds...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            storageResult = storageData;
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
            // console.log(`Retrying upload in ${delay / 1000} seconds...`);
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

      // Get the public URL of the uploaded photo
      const { data: urlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(fileName);

      const photoUrl = urlData?.publicUrl;
      if (!photoUrl) {
        throw new Error("Failed to get photo URL");
      }

      // console.log("Photo uploaded successfully. URL:", photoUrl);

      setUploadProgress(80);

      // Save attendance record with location, photo URL and other data
      // console.log("Saving attendance record to database...");
      const { data, error } = await supabase
        .from("absences")
        .insert([
          {
            user_id: locationData.userId,
            date: currentDate,
            reason,
            created_at: now.toISOString(),
            photo_url: photoUrl,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          },
        ])
        .select();

      if (error) {
        console.error("Error saving attendance record:", error); // Keep error log
        throw error;
      }

      setUploadProgress(100);
      // console.log("Attendance record saved successfully:", data);

      return data;
    } catch (error: any) {
      console.error("Error in saveAttendanceToSupabase:", error); // Keep error log
      throw new Error(error?.message || "Failed to save attendance data");
    } finally {
      setIsUploading(false);
    }
  };

  // Take a picture
  const takePicture = async () => {
    if (!isCameraReady) {
      Alert.alert(
        "Camera not ready",
        "Please wait for the camera to initialize.",
      );
      return;
    }

    if (cameraRef.current && !isTakingPicture) {
      setIsTakingPicture(true);
      try {
        const options = { quality: 0.7, base64: false, skipProcessing: true }; // Keep original capture quality high initially
        const photo = await cameraRef.current.takePictureAsync(options);

        if (photo && photo.uri) {
          console.log("Original Photo URI:", photo.uri);

          // Manipulate the image: resize, compress (still applies quality to PNG), AND get base64 directly
          console.log("Manipulating image to PNG and getting base64...");
          const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 800 } }], // Resize width to 800px
            {
              compress: 0.7,
              format: ImageManipulator.SaveFormat.PNG,
              base64: true,
            }, // Compress (quality for PNG), save as PNG, GET BASE64
          );
          console.log("Image manipulation complete.");

          // Check if base64 data exists
          if (!manipResult.base64) {
            throw new Error("Image manipulation did not return base64 data.");
          }

          // Save attendance data using the BASE64 data from manipulation result
          await saveAttendanceToSupabase(manipResult.base64);

          Alert.alert("Success", "Attendance recorded successfully!", [
            {
              text: "OK",
              onPress: () => {
                console.log("Navigating to Home...");
                router.replace("/Home");
              },
            },
          ]);
        } else {
          Alert.alert("Error", "Failed to capture photo (no data returned).");
        }
      } catch (err) {
        console.error("Error taking picture or saving data:", err);
        // Check if the error came from saveAttendanceToSupabase or manipulation
        if (
          err instanceof Error &&
          (err.message === "Failed to upload photo" ||
            err.message === "Failed to save attendance record" ||
            err.message.includes("base64"))
        ) {
          Alert.alert(
            "Error",
            `Failed to process or save attendance: ${err.message}`,
          );
        } else {
          Alert.alert("Error", "Failed to capture photo or process image.");
        }
      } finally {
        setIsTakingPicture(false);
      }
    }
  };

  // Toggle between front and back camera
  const toggleCameraFacing = useCallback(() => {
    // Use string literal type for 'current'
    setFacing((current: "front" | "back") =>
      current === "back" ? "front" : "back",
    );
  }, []);

  // Show loading state while requesting permission
  if (!permission) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Stack.Screen
          options={{ title: "Camera Attendance", headerShown: false }}
        />
        <ActivityIndicator size="large" color="#0066FF" />
        <Text className="text-white text-lg text-center mx-5 mt-4">
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  // Show permission request UI if not granted
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Stack.Screen
          options={{ title: "Camera Permission", headerShown: false }}
        />
        <Animated.View
          entering={FadeIn.duration(500)}
          className="items-center justify-center"
        >
          <Ionicons name="camera-outline" size={80} color="#0066FF" />
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
            <Text className="text-white text-base font-bold">
              Grant Permission
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // Show error message if camera had an error
  if (cameraError) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Stack.Screen options={{ title: "Camera Error", headerShown: false }} />
        <Animated.View
          entering={FadeIn.duration(500)}
          className="items-center justify-center"
        >
          <Ionicons name="alert-circle-outline" size={80} color="#ff4d4f" />
          <Text className="text-red-400 text-2xl font-bold text-center mt-4 mb-2">
            Camera Error
          </Text>
          <Text className="text-white/80 text-base text-center mx-10 mb-8">
            {cameraError}
          </Text>
          <TouchableOpacity
            className="bg-[#0066FF] px-8 py-4 rounded-lg"
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Text className="text-white text-base font-bold">Go Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // Show upload status if uploading
  if (isUploading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Stack.Screen options={{ title: "Uploading", headerShown: false }} />
        <Animated.View
          entering={FadeIn.duration(400)}
          className="items-center justify-center w-4/5"
        >
          <ActivityIndicator size="large" color="#0066FF" />
          <Text className="text-white text-xl font-semibold mt-4 mb-2">
            Saving Attendance...
          </Text>
          <Text className="text-white/70 text-base text-center mb-8">
            {uploadProgress < 50
              ? "Processing image..."
              : uploadProgress < 80
                ? "Uploading to server..."
                : "Saving attendance record..."}
          </Text>
          <View className="w-full h-2 bg-gray-700 rounded-full">
            <View
              className="h-full bg-[#0066FF] rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </View>
          <Text className="text-white/70 text-sm mt-2">{uploadProgress}%</Text>
        </Animated.View>
      </View>
    );
  }

  // Main camera view
  return (
    <View className="flex-1 bg-black">
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
        translucent
      />
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Camera Attendance",
          headerStyle: {
            backgroundColor: "#0066FF",
          },
          headerTintColor: "#fff",
        }}
      />

      {/* Camera component */}
      {permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={facing}
          onCameraReady={onCameraReady}
        >
          {/* Camera UI Overlay */}
          {isCameraReady ? (
            <>
              {/* Top info bar */}
              <Animated.View
                entering={SlideInDown.duration(400)}
                className="absolute top-3 left-0 right-0 bg-black/60 py-3 px-4 items-center mx-4 rounded-xl"
              >
                <View className="flex-row items-center">
                  <Ionicons name="location" size={16} color="#0066FF" />
                  <Text className="text-white text-sm ml-1">
                    Location: {locationData.latitude.toFixed(4)},{" "}
                    {locationData.longitude.toFixed(4)}
                  </Text>
                </View>
                <Text className="text-white/70 text-xs mt-1">
                  {new Date().toLocaleString()}
                </Text>
              </Animated.View>

              {/* Camera Controls */}
              <View className="absolute bottom-8 left-0 right-0 flex-row justify-around items-center px-5">
                {/* Flip camera button */}
                <TouchableOpacity
                  className="w-16 h-16 rounded-full bg-black/50 justify-center items-center"
                  onPress={toggleCameraFacing}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="camera-reverse-outline"
                    size={28}
                    color="#fff"
                  />
                </TouchableOpacity>

                {/* Capture button */}
                <Animated.View
                  style={animatedButtonStyle}
                  className="w-24 h-24 rounded-full bg-white/30 justify-center items-center"
                >
                  <TouchableOpacity
                    className="w-20 h-20 rounded-full bg-white justify-center items-center"
                    onPress={takePicture}
                    disabled={isTakingPicture || !isCameraReady}
                    activeOpacity={0.8}
                  >
                    {isTakingPicture ? (
                      <ActivityIndicator size="large" color="#0066FF" />
                    ) : (
                      <View className="w-16 h-16 rounded-full bg-[#0066FF]" />
                    )}
                  </TouchableOpacity>
                </Animated.View>

                {/* Back button */}
                <TouchableOpacity
                  className="w-16 h-16 rounded-full bg-black/50 justify-center items-center"
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View className="flex-1 justify-center items-center bg-black/70">
              <ActivityIndicator size="large" color="#0066FF" />
              <Text className="text-white mt-3">Initializing camera...</Text>
            </View>
          )}
        </CameraView>
      ) : (
        <View className="flex-1 justify-center items-center">
          <Text className="text-white">Camera permission not granted.</Text>
        </View>
      )}
    </View>
  );
};

export default CameraAttendance;
