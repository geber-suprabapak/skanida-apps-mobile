// --- NECESSARY IMPORTS ---
import { Ionicons, MaterialIcons } from "@expo/vector-icons"; // Import icons
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, Alert, TouchableOpacity, ActivityIndicator } from "react-native"; // Added ActivityIndicator
import { SafeAreaView } from "react-native-safe-area-context"; // Import SafeAreaView

import { Button } from "~/components/ui/button"; // Use the new button
import { Text } from "~/components/ui/text"; // Import Text from ui
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

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
} // Import the theme store

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
  const router = useRouter();

  // Auto-navigate to camera when location is verified
  useEffect(() => {
    if (isWithinRange === true && location && !loading) {
      // Delay a bit to show the success message before navigating
      const timer = setTimeout(() => {
        navigateToCameraWithLocation();
      }, 1500); // 1.5 seconds delay

      return () => clearTimeout(timer);
    }
  }, [isWithinRange, location, loading]);

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
        Alert.alert(
          "Error",
          "Pengguna tidak ditemukan. Silakan login kembali.",
        );
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

      const { status } = await Location.requestForegroundPermissionsAsync();

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
        setTimeout(
          () => reject(new Error("Location request timed out")),
          15000,
        ),
      );

      // Race the location request against the timeout
      const currentLocation = (await Promise.race([
        locationPromise,
        timeoutPromise,
      ])) as Location.LocationObject;

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
          : `Anda berada diluar jangkauan SMKN 2 Magelang (${Math.round(distance)}m)`,
      );
    } catch (error: any) {
      console.error("Error getting location:", error);
      if (error && typeof error === "object" && "message" in error && error.message === "Location request timed out") {
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

  const navigateToCameraWithLocation = () => {
    if (location) {
      router.push({
        pathname: "/attendance/CameraAttendance",
        params: {
          latitude: location.coords.latitude.toString(),
          longitude: location.coords.longitude.toString(),
          userId,
        },
      });
    }
  };

  // --- RENDER UI ---
  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false, // Hide the default header
        }}
      />

      {/* Custom Header */}
      <View
        className={`flex-row items-center p-4 border-b ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-border bg-white"}`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons
            name="arrow-back-outline"
            size={24}
            color={isDarkMode ? "#fff" : "hsl(var(--foreground))"}
          />
        </TouchableOpacity>
        <Text
          className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-foreground"}`}
        >
          Absensi Kehadiran
        </Text>
      </View>

      {/* Main Content */}
      <View
        className={`flex-1 px-5 py-6 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
      >
        <View className="mb-6 items-center">
          <Text
            className={`text-center ${isDarkMode ? "text-white" : "text-gray-600"}`}
          >
            Silahkan lakukan absensi kehadiran Anda
          </Text>
        </View>

        {/* Status Card */}
        <View
          className={`w-full rounded-xl p-5 shadow-md mb-6 ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
        >
          {loading ? (
            <View className="items-center py-6">
              <ActivityIndicator
                size="large"
                color={isDarkMode ? "#C0DAFF" : "#0066FF"}
                className="mb-4"
              />
              <Text
                className={`text-lg mt-2 ${isDarkMode ? "text-white" : "text-gray-600"}`}
              >
                Memeriksa lokasi...
              </Text>
            </View>
          ) : (
            <View>
              <View className="flex-row items-center justify-center mb-4">
                {isWithinRange ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={60}
                    color={isDarkMode ? "#34D399" : "#28a745"}
                  />
                ) : (
                  <MaterialIcons
                    name="location-off"
                    size={60}
                    color={isDarkMode ? "#F87171" : "#dc3545"}
                  />
                )}
              </View>
              <Text
                className={`text-lg text-center font-semibold mb-2 ${
                  isWithinRange
                    ? isDarkMode
                      ? "text-green-400"
                      : "text-green-600"
                    : isDarkMode
                      ? "text-red-400"
                      : "text-red-600"
                }`}
              >
                {isWithinRange ? "Lokasi Terverifikasi" : "Di Luar Jangkauan"}
              </Text>
              <Text
                className={`text-center ${isDarkMode ? "text-white" : "text-gray-600"}`}
              >
                {statusMessage}
              </Text>

              {location && (
                <View
                  className={`mt-4 p-3 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}
                >
                  <Text
                    className={`text-center text-sm ${isDarkMode ? "text-white" : "text-gray-500"}`}
                  >
                    Koordinat: {location.coords.latitude.toFixed(6)},{" "}
                    {location.coords.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              {/* Show navigation message when location is verified */}
              {isWithinRange === true && (
                <View className="mt-4 items-center">
                  <Text
                    className={`text-sm italic ${isDarkMode ? "text-blue-300" : "text-blue-600"}`}
                  >
                    Melanjutkan ke kamera dalam beberapa detik...
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action Buttons - only show recheck button now */}
        <View className="w-full space-y-4">
          {isWithinRange === false && !loading && (
            <Button
              variant="secondary"
              size="lg"
              onPress={requestAndCheckLocation}
              disabled={loading}
              className="mt-2"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons
                  name="refresh-outline"
                  size={24}
                  color={isDarkMode ? "white" : "black"}
                  style={{ marginRight: 8 }}
                />
                <Text className={isDarkMode ? "text-white" : "text-black"}>
                  Periksa Lokasi Kembali
                </Text>
              </View>
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AbsenceReport;
