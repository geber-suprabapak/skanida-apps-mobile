// --- NECESSARY IMPORTS ---
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "~/utils/supabase";

// --- Component Definition Starts Here ---
const AbsenceReport = () => {
  // --- HOOKS AND STATE ---
  const [loading, setLoading] = useState(true); // Initialize as true
  const [userId, setUserId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null); // Use null to indicate "not checked yet"
  const [permissionDenied, setPermissionDenied] = useState(false);
  const router = useRouter();

  // --- Configuration ---
  const TARGET_LOCATION = { latitude: -7.4503, longitude: 110.221 };
  const MAX_DISTANCE = 500;

  // --- Function to fetch user data and location ---
  const fetchUserDataAndLocation = async () => {
    setLoading(true);
    setPermissionDenied(false);
    try {
      // Get User
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error("User auth error:", userError?.message);
        Alert.alert("Error", "Failed to retrieve user. Please log in again.");
        router.replace("/auth/Login");
        return;
      }
      setUserId(userData.user.id);

      // Get Location Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Location permission denied");
        setPermissionDenied(true);
        setIsWithinRange(false);
        setLoading(false); // Stop loading here as we can't proceed without permission
        return;
      }

      // Get Current Location
      console.log("Getting current location...");
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(currentLocation);
      console.log("Current location:", currentLocation.coords);

      // Calculate Distance
      if (currentLocation?.coords) {
        const distance = calculateDistance(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          TARGET_LOCATION.latitude,
          TARGET_LOCATION.longitude,
        );
        console.log(`Distance to target: ${distance.toFixed(2)} meters`);
        setIsWithinRange(distance <= MAX_DISTANCE);
      } else {
        console.error("Could not get location coordinates.");
        setIsWithinRange(false);
        Alert.alert("Error", "Failed to get precise location coordinates.");
      }
    } catch (exception: any) {
      console.error("Error fetching data or location:", exception);
      if (exception.message.includes("Location request timed out")) {
        Alert.alert(
          "Error",
          "Could not get location: Request timed out. Please ensure GPS is enabled and try again.",
        );
      } else {
        Alert.alert(
          "Error",
          "An unexpected error occurred while getting location or user data.",
        );
      }
      setIsWithinRange(false);
    } finally {
      setLoading(false);
    }
  };

  // --- useEffect to fetch user data on mount ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true); // Start loading immediately
      try {
        // Get User
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.error("User auth error:", userError?.message);
          Alert.alert("Error", "Failed to retrieve user. Please log in again.");
          router.replace("/auth/Login");
          return;
        }
        setUserId(userData.user.id);

        // Immediately fetch location after user data is fetched
        await fetchUserDataAndLocation();
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert(
          "Error",
          "Failed to retrieve user data. Please try again.",
        );
        setLoading(false); // Ensure loading is set to false in case of error
      } finally {
        // Keep loading as true until location is fetched
        // setLoading(false); // Stop loading after initial user data fetch - REMOVE THIS
      }
    };

    fetchInitialData();
  }, [router]);

  // --- Helper function: calculateDistance ---
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) *
        Math.sin(dLon / 2) *
        Math.cos(lat1Rad) *
        Math.cos(lat2Rad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- Event Handler: handleRetryLocation ---
  const handleRetryLocation = async () => {
    await fetchUserDataAndLocation();
  };

  // --- Event Handler: handleSubmitLocationAndDate ---
  const handleSubmitLocationAndDate = async () => {
    setLoading(true); // Set loading to true when the submit button is pressed
    if (!userId || !location || !location.coords) {
      Alert.alert(
        "Error",
        "User or location coordinate data is missing. Please retry.",
      );
      setLoading(false);
      return;
    }

    if (isWithinRange === false) { // Check if isWithinRange is explicitly false
      Alert.alert(
        "Error",
        "You seem to be outside the allowed range. Please check your location again.",
      );
      setLoading(false);
      return;
    }

    // Navigate to camera screen with location data
    router.push({
      pathname: "/attendance/CameraAttendance",
      params: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        userId: userId,
      },
    });
    setLoading(false);
  };

  // --- Render Logic ---
  if (loading && !permissionDenied) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.infoText}>
          {permissionDenied
            ? "Checking user data..."
            : "Checking location and user data..."}
        </Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Location Permission Denied</Text>
        <Text style={styles.infoText}>
          Attendance requires location access. Please grant permission in your
          device settings.
        </Text>
        <TouchableOpacity onPress={handleRetryLocation} style={styles.button}>
          <Text style={styles.buttonText}>Check Permission Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isWithinRange === false) { // Only show this if we've checked and it's false
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>You are outside the allowed range.</Text>
        <Text style={styles.infoText}>
          Move closer to the target location ({MAX_DISTANCE}m range).
        </Text>
        {location?.coords && (
          <Text style={styles.coordsText}>
            Your location: {location.coords.latitude.toFixed(4)},{" "}
            {location.coords.longitude.toFixed(4)}
          </Text>
        )}
        <TouchableOpacity
          onPress={handleRetryLocation}
          disabled={loading}
          style={[styles.button, loading ? styles.buttonDisabled : {}]}
        >
          <Text style={styles.buttonText}>
            {loading ? "Checking..." : "Check Location Again"}
          </Text>
        </TouchableOpacity>
        {loading && (
          <ActivityIndicator
            size="small"
            color="#007AFF"
            style={{ marginTop: 10 }}
          />
        )}
      </View>
    );
  }

  // Default return if within range or hasn't been checked yet
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>Location Verified</Text>
      <Text style={styles.successText}>You are within the allowed range.</Text>
      <Text style={styles.infoText}>
        Press the button below to record your location and proceed to take a
        picture.
      </Text>
      {location?.coords && (
        <Text style={styles.coordsText}>
          Your location: {location.coords.latitude.toFixed(4)},{" "}
          {location.coords.longitude.toFixed(4)}
        </Text>
      )}
      <TouchableOpacity
        onPress={handleSubmitLocationAndDate}
        disabled={loading}
        style={[styles.submitButton, loading ? styles.buttonDisabled : {}]}
      >
        <Text style={styles.submitButtonText}>
          {loading ? "Submitting..." : "Submit Location & Proceed"}
        </Text>
      </TouchableOpacity>
      {loading && (
        <ActivityIndicator
          size="small"
          color="#007AFF"
          style={{ marginTop: 20 }}
        />
      )}
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  titleText: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  successText: {
    fontSize: 18,
    color: "#28a745",
    marginBottom: 15,
    textAlign: "center",
  },
  errorText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#dc3545",
    marginBottom: 10,
    textAlign: "center",
  },
  infoText: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  coordsText: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 20,
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  submitButton: {
    backgroundColor: "#28a745",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 250,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonDisabled: {
    backgroundColor: "#6c757d",
  },
});

export default AbsenceReport;