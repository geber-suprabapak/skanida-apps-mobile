import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera as ExpoCamera } from "expo-camera";
import { CameraType } from "expo-camera/build/Camera.types";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSequence
} from "react-native-reanimated";

import { supabase } from "~/utils/supabase";

const { width, height } = Dimensions.get("window");

const CameraAttendance = () => {
  const cameraRef = useRef<ExpoCamera>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState(CameraType.back);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
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
    transform: [{ scale: buttonScale.value }]
  }));

  // Function to animate button press
  const animateCameraButton = () => {
    buttonScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withTiming(1, { duration: 200 })
    );
  };

  useEffect(() => {
    // Request camera permissions immediately
    (async () => {
      try {
        if (!permission?.granted) {
          const permissionResult = await requestPermission();
          console.log("Camera permission result:", permissionResult.granted);
          
          if (!permissionResult.granted) {
            Alert.alert(
              "Camera Permission Required",
              "Please grant camera permission to take attendance photos."
            );
          }
        }
      } catch (err) {
        console.error("Error requesting camera permission:", err);
        setCameraError("Failed to request camera permissions");
      }
    })();

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
  }, []);

  // Handle camera ready state
  const onCameraReady = () => {
    console.log("Camera is ready!");
    setIsCameraReady(true);
  };

  // Handle camera errors
  const onCameraError = (error: any) => {
    console.error("Camera error:", error);
    setCameraError(typeof error === 'string' ? error : error.message || "Failed to initialize camera");
  };

  // Utility: convert base64 string to Uint8Array
  function base64ToUint8Array(base64: string) {
    let binaryString: string;
    if (typeof atob !== 'undefined') {
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
  }

  const saveAttendanceToSupabase = async (base64Data: string) => {
    try {
      console.log("Saving attendance data to Supabase...");

      // Get current date in YYYY-MM-DD format for the attendance record
      const currentDate = new Date().toISOString().split("T")[0];

      // Create a reason for the attendance (could be customized based on your needs)
      const reason = "Present";

      // First upload the photo to Supabase Storage
      console.log("Uploading base64 PNG photo data...");

      // Create a unique file name using timestamp and userId with .png extension
      const currentTimestamp = Date.now();
      const formattedDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const fileName = `${formattedDate}_${currentTimestamp}_${locationData.userId}.png`;
      console.log("Generated filename for storage:", fileName);

      if (!base64Data) {
        throw new Error("Received empty base64 data for upload");
      }
      console.log(`Base64 data received, length: ${base64Data.length}`);

      // Convert base64 to Uint8Array (buffer)
      const fileBuffer = base64ToUint8Array(base64Data);

      // Upload the buffer to Supabase storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (storageError) {
        console.error("Error uploading photo:", storageError);
        if (storageError.message) {
          console.error(
            "Supabase storage error message:",
            storageError.message,
          );
        }
        throw new Error("Failed to upload photo");
      }

      // Get the public URL of the uploaded photo
      const { data: urlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(fileName);

      const photoUrl = urlData?.publicUrl;
      console.log("Photo uploaded successfully. URL:", photoUrl);

      // Save attendance record with location, photo URL and other data
      const { data, error } = await supabase
        .from("absences")
        .insert([
          {
            user_id: locationData.userId,
            date: currentDate,
            reason,
            created_at: new Date().toISOString(),
            photo_url: photoUrl,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          },
        ])
        .select();

      if (error) {
        console.error("Error saving attendance record:", error);
        throw new Error("Failed to save attendance record");
      }

      return data;
    } catch (error) {
      console.error("Error in saveAttendanceToSupabase:", error);
      throw error; // Re-throw the error to be caught by takePicture
    }
  };

  const takePicture = async () => {
    if (!isCameraReady) {
      Alert.alert("Camera not ready", "Please wait for the camera to initialize.");
      return;
    }
    
    if (cameraRef.current && !isTakingPicture) {
      setIsTakingPicture(true);
      animateCameraButton();
      
      try {
        console.log("Attempting to take picture...");
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
          exif: false,
        });

        console.log("Photo taken:", photo ? "success" : "failed");
        
        if (photo && photo.uri) {
          console.log("Photo URI:", photo.uri);
          
          // Process the image
          const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 800 } }],
            { format: ImageManipulator.SaveFormat.PNG, base64: true, compress: 0.7 }
          );
          
          if (manipResult && manipResult.base64) {
            await saveAttendanceToSupabase(manipResult.base64);
            
            Alert.alert("Success", "Attendance recorded successfully!", [
              { text: "OK", onPress: () => router.replace("/Dashboard") }
            ]);
          } else {
            throw new Error("Image manipulation failed");
          }
        } else {
          throw new Error("No photo data returned");
        }
      } catch (error: unknown) {
        console.error("Error taking picture:", error);
        Alert.alert(
          "Error",
          `Failed to take picture: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      } finally {
        setIsTakingPicture(false);
      }
    }
  };

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing(current => current === CameraType.back ? CameraType.front : CameraType.back);
  };

  // Show loading state while requesting permission
  if (!permission) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <Stack.Screen options={{ title: "Camera Attendance" }} />
        <ActivityIndicator size="large" color="#E600FF" />
        <Text className="text-white text-lg text-center mx-5 mb-5">Requesting camera permission...</Text>
      </View>
    );
  }

  // Show permission request UI if not granted
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <Stack.Screen options={{ title: "Camera Permission" }} />
        <Text className="text-white text-lg text-center mx-5 mb-5">
          We need your permission to use the camera
        </Text>
        <TouchableOpacity
          className="bg-[#E600FF] px-8 py-4 rounded-lg mt-5"
          onPress={requestPermission}
        >
          <Text className="text-white text-base font-bold">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show error message if camera had an error
  if (cameraError) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <Stack.Screen options={{ title: "Camera Error" }} />
        <Text className="text-red-400 text-lg text-center mx-5 mb-5">{cameraError}</Text>
        <TouchableOpacity
          className="bg-[#E600FF] px-8 py-4 rounded-lg mt-5"
          onPress={() => router.back()}
        >
          <Text className="text-white text-base font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main camera view
  return (
    <View className="flex-1 bg-black">
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Camera Attendance",
          headerStyle: {
            backgroundColor: "#E600FF",
          },
          headerTintColor: "#fff",
        }}
      />
      
      {/* Camera component */}
      <CameraView
        ref={cameraRef}
        className="flex-1 w-full"
        type={facing}
        onCameraReady={onCameraReady}
        onError={onCameraError}
      >
        {/* Camera UI Overlay */}
        {isCameraReady ? (
          <>
            {/* Location info */}
            <View className="absolute top-3 left-0 right-0 bg-black/60 p-2 items-center">
              <Text className="text-white text-sm">
                <Ionicons name="location" size={14} color="#fff" />
                {' '}Location: {locationData.latitude.toFixed(4)}, {locationData.longitude.toFixed(4)}
              </Text>
            </View>

            {/* Camera Controls */}
            <View className="absolute bottom-8 left-0 right-0 flex-row justify-around items-center px-5">
              {/* Flip camera button */}
              <TouchableOpacity
                className="w-15 h-15 rounded-full bg-black/50 justify-center items-center p-3"
                onPress={toggleCameraFacing}
              >
                <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
              </TouchableOpacity>
              
              {/* Capture button */}
              <Animated.View
                style={animatedButtonStyle}
                className="w-20 h-20 rounded-full bg-white/30 justify-center items-center"
              >
                <TouchableOpacity
                  className="w-[70px] h-[70px] rounded-full bg-white justify-center items-center"
                  onPress={takePicture}
                  disabled={isTakingPicture || !isCameraReady}
                >
                  {isTakingPicture ? (
                    <ActivityIndicator size="large" color="#E600FF" />
                  ) : (
                    <View className="w-[60px] h-[60px] rounded-full bg-[#E600FF]" />
                  )}
                </TouchableOpacity>
              </Animated.View>
              
              {/* Back button */}
              <TouchableOpacity
                className="w-15 h-15 rounded-full bg-black/50 justify-center items-center p-3"
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="flex-1 justify-center items-center bg-black/70">
            <ActivityIndicator size="large" color="#E600FF" />
            <Text className="text-white mt-3">Initializing camera...</Text>
          </View>
        )}
      </CameraView>
    </View>
  );
};

export default CameraAttendance;
