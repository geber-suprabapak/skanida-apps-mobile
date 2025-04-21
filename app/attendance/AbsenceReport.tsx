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

// --- Component Definition Starts Here ---
const AbsenceReport = () => {
  // --- HOOKS AND STATE ---
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const router = useRouter();

  // Animation values
  const pulseValue = useSharedValue(1);
  const rotateValue = useSharedValue(0);

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
    <View className="flex-1 bg-white p-6 items-center justify-center">
      <Animated.View 
        entering={ZoomIn.duration(600)} 
        className="mb-6 items-center"
      >
        <Text className="text-2xl font-bold text-brand-purple mb-2">
          Absensi Kehadiran
        </Text>
        <Text className="text-gray-600 text-center">
          Silahkan lakukan absensi kehadiran Anda
        </Text>
      </Animated.View>

      {/* Status Card */}
      <Animated.View 
        entering={FadeInUp.delay(300).duration(600)}
        className="w-full bg-white rounded-xl p-5 shadow-md mb-6"
      >
        {loading ? (
          <View className="items-center py-6">
            <Animated.View style={rotateAnimationStyle}>
              <MaterialIcons name="location-searching" size={60} color="#E600FF" />
            </Animated.View>
            <Text className="text-lg mt-4 text-gray-600">Memeriksa lokasi...</Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)}>
            <View className="flex-row items-center justify-center mb-4">
              {isWithinRange ? (
                <Animated.View style={pulseAnimationStyle}>
                  <Ionicons name="checkmark-circle" size={60} color="#28a745" />
                </Animated.View>
              ) : (
                <MaterialIcons name="location-off" size={60} color="#dc3545" />
              )}
            </View>
            <Text className={`text-lg text-center font-semibold mb-2 ${
              isWithinRange ? "text-green-600" : "text-red-600"
            }`}>
              {isWithinRange ? "Lokasi Terverifikasi" : "Di Luar Jangkauan"}
            </Text>
            <Text className="text-gray-600 text-center">{statusMessage}</Text>
            
            {location && (
              <View className="mt-4 bg-gray-50 p-3 rounded-lg">
                <Text className="text-gray-500 text-center text-sm">
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

        {/* Show Recheck button only when NOT in range and location check is finished */}
        {isWithinRange === false && !loading && (
           <Button
              variant="secondary"
              size="large"
              onPress={requestAndCheckLocation}
              disabled={loading} 
              leftIcon={<Ionicons name="refresh-outline" size={24} color="#444" />}
            >
              Periksa Lokasi Kembali
            </Button>
        )}
        
        {/* Always show the Back button */}
        <Button
          variant="outline"
          size="large"
          onPress={() => router.back()}
          leftIcon={<Ionicons name="arrow-back-outline" size={24} color="#E600FF" />}
        >
          Kembali
        </Button>
      </Animated.View> 
    </View>
  );
};

export default AbsenceReport;