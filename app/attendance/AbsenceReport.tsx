// --- NECESSARY IMPORTS ---
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";

// Import NetInfo with error handling
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

import { supabase } from "~/utils/supabase";
import { Button } from "~/components/Button"; // Import the custom Button
import { Ionicons, MaterialIcons } from "@expo/vector-icons"; // Import icons
import Animated, {
  FadeIn,
  FadeInUp,
  SlideInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing
} from "react-native-reanimated";
import useThemeStore from "~/store/themeStore"; // Import the theme store

// --- Component Definition Starts Here ---
const AbsenceReport = () => {
  // --- HOOKS AND STATE ---
  const { isDarkMode } = useThemeStore(); // Get theme state
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const router = useRouter();
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Animation values
  const pulseValue = useSharedValue(1);
  const rotateValue = useSharedValue(0);

  // --- useEffect to fetch data and location ---
  useEffect(() => {
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
  // Animated styles
  const pulseAnimationStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: pulseValue.value },
      ],
    };
  });

  const rotateAnimationStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { 
          rotateZ: `${rotateValue.value}deg` 
        },
      ],
    };
  });

  // Start pulse animation
  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite repeat
      true // Reverse on repeat
    );

    // Animate the location icon rotation when searching
    if (loading) {
      rotateValue.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1 // Infinite repeat
      );
    }
  }, [loading]);

  // --- LOCATION CHECKING LOGIC ---
  useEffect(() => {
    checkCurrentUser();
    requestAndCheckLocation();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
      } else {
        Alert.alert("Error", "Pengguna tidak ditemukan. Silakan login kembali.");
        router.replace("/auth/Login");
      }
    } catch (error) {
      console.error("Error getting user:", error);
      Alert.alert("Error", "Gagal mendapatkan data pengguna");
    }
  };

  const requestAndCheckLocation = async () => {
    // Reset state before re-checking
    setLoading(true);
    setLocation(null);
    setIsWithinRange(null);
    setStatusMessage("Memeriksa koneksi dan lokasi..."); // Initial message

    try {
      // Check network connectivity first
      const netInfoState = await NetInfo.fetch();
      if (!netInfoState.isConnected || !netInfoState.isInternetReachable) {
        setStatusMessage("Tidak ada koneksi internet. Periksa jaringan Anda.");
        setLoading(false);
        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setStatusMessage("Izin lokasi ditolak. Aktifkan di pengaturan.");
        setLoading(false);
        return;
      }

      setStatusMessage("Mendapatkan lokasi saat ini..."); // Update status

      // Add a timeout for location fetching (e.g., 15 seconds)
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Location request timed out")), 15000)
      );

      // Race the location request against the timeout
      let currentLocation = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;

      setLocation(currentLocation);

      // SMKN 2 Magelang coordinates
      const schoolLatitude = -7.4503; // SMKN 2 Magelang latitude
      const schoolLongitude = 110.2241; // SMKN 2 Magelang longitude
      const maxDistanceInMeters = 500; // Maximum allowed distance in meters (500m range)

      // Calculate distance between current location and school
      const distance = calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        schoolLatitude,
        schoolLongitude,
      );

      const withinRange = distance <= maxDistanceInMeters;
      setIsWithinRange(withinRange);
      setStatusMessage(
        withinRange
          ? `Anda berada dalam jangkauan SMKN 2 Magelang (${Math.round(distance)}m)`
          : `Anda berada diluar jangkauan SMKN 2 Magelang (${Math.round(distance)}m)`
      );
    } catch (error: any) {
      console.error("Error getting location:", error);
      if (error.message === "Location request timed out") {
        setStatusMessage("Gagal mendapatkan lokasi: Waktu habis.");
      } else {
        setStatusMessage("Gagal mendapatkan lokasi. Coba lagi.");
      }
      // Ensure state reflects error
      setLocation(null);
      setIsWithinRange(null);
    } finally {
      setLoading(false);
    }
  };

  // Function to calculate distance between two coordinates using Haversine formula
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  };

  // --- PROCEED TO CAMERA ---
  const handleProceedToCamera = () => {
    if (!location) {
      Alert.alert("Error", "Lokasi tidak tersedia");
      return;
    }

    if (!isWithinRange) {
    if (!isWithinRange) {
      Alert.alert(
        "Peringatan",
        "Anda berada di luar jangkauan kantor. Absensi mungkin akan ditolak.",
        [
          {
            text: "Batal",
            style: "cancel",
          },
          {
            text: "Lanjutkan",
            onPress: () => navigateToCameraWithLocation(),
          },
        ],
      );
    } else {
      navigateToCameraWithLocation();
    }
  };

  const navigateToCameraWithLocation = () => {
    if (location) {
      router.push({
        pathname: "/attendance/CameraAttendance",
        params: {
          latitude: location.coords.latitude.toString(),
          longitude: location.coords.longitude.toString(),
          userId: userId,
        },
      });
    }
  };

  // --- RENDER UI ---
  return (
    <View className={`flex-1 p-6 items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <Animated.View 
        entering={ZoomIn.duration(600)} 
        className="mb-6 items-center"
      >
        <Text className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-purple-400' : 'text-brand-purple'}`}>
          Absensi Kehadiran
        </Text>
        <Text className={`text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Silahkan lakukan absensi kehadiran Anda
        </Text>
      </Animated.View>

      {/* Status Card */}
      <Animated.View 
        entering={FadeInUp.delay(300).duration(600)}
        className={`w-full rounded-xl p-5 shadow-md mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
      >
        {loading ? (
          <View className="items-center py-6">
            <Animated.View style={rotateAnimationStyle}>
              <MaterialIcons name="location-searching" size={60} color={isDarkMode ? '#C084FC' : '#E600FF'} />
            </Animated.View>
            <Text className={`text-lg mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Memeriksa lokasi...</Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)}>
            <View className="flex-row items-center justify-center mb-4">
              {isWithinRange ? (
                <Animated.View style={pulseAnimationStyle}>
                  <Ionicons name="checkmark-circle" size={60} color={isDarkMode ? '#34D399' : '#28a745'} />
                </Animated.View>
              ) : (
                <MaterialIcons name="location-off" size={60} color={isDarkMode ? '#F87171' : '#dc3545'} />
              )}
            </View>
            <Text className={`text-lg text-center font-semibold mb-2 ${
              isWithinRange 
                ? (isDarkMode ? 'text-green-400' : 'text-green-600') 
                : (isDarkMode ? 'text-red-400' : 'text-red-600')
            }`}>
              {isWithinRange ? "Lokasi Terverifikasi" : "Di Luar Jangkauan"}
            </Text>
            <Text className={`text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{statusMessage}</Text>
            
            {location && (
              <View className={`mt-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <Text className={`text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Koordinat: {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View 
        entering={SlideInUp.delay(600).duration(500)}
        className="w-full space-y-4"
      >
        {/* Show Camera button only when within range */}
        {isWithinRange === true && (
          <Button
            variant="primary"
            size="large"
            onPress={handleProceedToCamera}
            disabled={loading} 
            leftIcon={<Ionicons name="camera-outline" size={24} color="#fff" />}
          >
            Lanjutkan ke Kamera
          </Button>
        )}
      </View>
    );
  }

  // Default return if within range
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

export default AbsenceReport;
