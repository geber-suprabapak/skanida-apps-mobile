import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { supabase } from "~/utils/supabase";

const CameraAttendance = () => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const router = useRouter();

  // Get location data passed from AbsenceReport screen
  const params = useLocalSearchParams();
  const locationData = {
    latitude: parseFloat(params.latitude as string) || 0,
    longitude: parseFloat(params.longitude as string) || 0,
    timestamp: (params.timestamp as string) || new Date().toISOString(),
    userId: (params.userId as string) || "",
  };

  useEffect(() => {
    if (!permission) {
      return;
    }
    if (!permission.granted) {
      console.log("Requesting camera permission...");
      requestPermission();
    }

    // Validate location data
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

  // Utility: convert base64 string to Uint8Array
  function base64ToUint8Array(base64: string) {
    const binaryString = globalThis.atob
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
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
      const fileName = `${Date.now()}_${locationData.userId}.png`;

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
    } else if (isTakingPicture) {
      console.log("Capture in progress...");
    } else {
      Alert.alert("Error", "Camera reference not available.");
    }
  };

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.messageText}>Loading permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        {/* Location info overlay */}
        <View style={styles.locationOverlay}>
          <Text style={styles.locationText}>
            Location: {locationData.latitude.toFixed(4)},{" "}
            {locationData.longitude.toFixed(4)}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleCameraFacing}
          >
            <Text style={styles.flipButtonText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.captureButton,
              isTakingPicture ? styles.captureButtonDisabled : {},
            ]}
            onPress={takePicture}
            disabled={isTakingPicture}
          >
            {isTakingPicture ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
          <View style={styles.flipButtonPlaceholder} />
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  camera: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  captureButtonDisabled: {
    backgroundColor: "#a0a0a0",
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ff0000",
  },
  flipButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  flipButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  flipButtonText: {
    fontSize: 24,
    color: "#fff",
  },
  permissionText: {
    textAlign: "center",
    fontSize: 18,
    marginBottom: 20,
    color: "#333",
  },
  messageText: {
    marginTop: 10,
    color: "#555",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  locationOverlay: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
  },
  locationText: {
    color: "white",
    textAlign: "center",
    fontSize: 12,
  },
});

export default CameraAttendance;
