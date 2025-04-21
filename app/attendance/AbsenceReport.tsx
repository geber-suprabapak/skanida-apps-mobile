// --- NECESSARY IMPORTS ---
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
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
      <View className="flex-1 items-center justify-center p-5 bg-primary-50">
        <ActivityIndicator size="large" color="#eab308" className="mb-4" />
        <Text className="text-base text-primary-800">
          {permissionDenied
            ? "Checking user data..."
            : "Checking location and user data..."}
        </Text>
        <TouchableOpacity
          onPress={handleRetryLocation}
          disabled={loading}
          className={`mt-4 py-3 px-6 rounded-lg ${loading ? 'bg-gray-400' : 'bg-primary-500'}`}
        >
          <Text className="text-white font-bold">
            {loading ? "Refreshing..." : "Refresh Location"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View className="flex-1 items-center justify-center p-5 bg-primary-50">
        <Text className="text-lg font-bold text-red-600 mb-2">Location Permission Denied</Text>
        <Text className="text-base text-primary-800 text-center mb-4">
          Attendance requires location access. Please grant permission in your device settings.
        </Text>
        <TouchableOpacity onPress={handleRetryLocation} className="bg-primary-500 py-3 px-6 rounded-lg">
          <Text className="text-white font-bold">Check Permission Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isWithinRange === false) {
    return (
      <View className="flex-1 items-center justify-center p-5 bg-primary-50">
        <Text className="text-lg font-bold text-red-600 mb-2">You are outside the allowed range.</Text>
        <Text className="text-base text-primary-800 text-center mb-4">
          Move closer to the target location ({MAX_DISTANCE}m range).
        </Text>
        {location?.coords && (
          <Text className="text-sm italic text-primary-700 mb-4">
            Your location: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </Text>
        )}
        <TouchableOpacity
          onPress={handleRetryLocation}
          disabled={loading}
          className={`py-3 px-6 rounded-lg ${loading ? 'bg-gray-400' : 'bg-primary-500'}`}>
          <Text className="text-white font-bold">
            {loading ? "Checking..." : "Check Location Again"}
          </Text>
        </TouchableOpacity>
        {loading && <ActivityIndicator size="small" color="#eab308" className="mt-3" />}
      </View>
    );
  }

  // Default return if within range or hasn't been checked yet
  return (
    <View className="flex-1 items-center justify-center p-5 bg-primary-50">
      <Text className="text-2xl font-bold text-primary-900 mb-2">Location Verified</Text>
      <Text className="text-lg text-primary-600 mb-4 text-center">You are within the allowed range.</Text>
      <Text className="text-base text-primary-800 text-center mb-4">
        Press the button below to record your location and proceed to take a picture.
      </Text>
      {location?.coords && (
        <Text className="text-sm italic text-primary-700 mb-4">
          Your location: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
        </Text>
      )}
      <TouchableOpacity
        onPress={handleSubmitLocationAndDate}
        disabled={loading}
        className={`py-4 px-8 rounded-lg ${loading ? 'bg-gray-400' : 'bg-primary-600'}`}>
        <Text className="text-white font-bold text-lg">
          {loading ? "Submitting..." : "Submit Location & Proceed"}
        </Text>
      </TouchableOpacity>
      {loading && <ActivityIndicator size="small" color="#eab308" className="mt-5" />}
    </View>
  );
};

export default AbsenceReport;