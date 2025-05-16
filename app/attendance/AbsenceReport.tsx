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

// Import NetInfo with better type handling
interface NetInfoState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

interface NetInfoType {
  addEventListener: (callback: (state: NetInfoState) => void) => { remove: () => void };
  fetch: () => Promise<NetInfoState>;
}

let NetInfo: NetInfoType;
try {
  NetInfo = require("@react-native-community/netinfo").default;
} catch (error) {
  console.warn("Failed to import NetInfo:", error);
  // Provide a fallback implementation with proper typing
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
  const [currentAbsenceType, setCurrentAbsenceType] = useState<"present" | "home" | null>(null);
  const [canProceed, setCanProceed] = useState<boolean>(false);
  const [morningAbsenceDoneDate, setMorningAbsenceDoneDate] = useState<string | null>(null); // Added state

  // Auto-navigate to camera when location is verified and conditions met
  useEffect(() => {
    if (isWithinRange === true && location && !loading && canProceed && currentAbsenceType) {
      // If we are proceeding with a "present" type absence, mark it as done for today.
      if (currentAbsenceType === "present") {
        const todayString = new Date().toISOString().split("T")[0];
        setMorningAbsenceDoneDate(todayString);
      }

      const timer = setTimeout(() => {
        navigateToCameraWithLocation();
      }, 1500); // 1.5 seconds delay

      return () => clearTimeout(timer);
    }
  }, [isWithinRange, location, loading, canProceed, currentAbsenceType]);

  // --- LOCATION CHECKING LOGIC ---
  useEffect(() => {
    // Wrap async logic in a function
    const initialize = async () => {
      await checkCurrentUserAndThenLocation();
    };
    initialize();
  }, []); // Removed userId from dependency array to avoid re-triggering on userId set by checkCurrentUser

  const checkCurrentUserAndThenLocation = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        // Call requestAndCheckLocation only after userId is confirmed
        await requestAndCheckLocation(data.user.id);
      } else {
        Alert.alert(
          "Error",
          "Pengguna tidak ditemukan. Silakan login kembali.",
        );
        setLoading(false);
        router.replace("/auth/Login");
      }
    } catch (error) {
      console.error("Error getting user:", error);
      Alert.alert("Error", "Gagal mendapatkan data pengguna");
      setLoading(false);
    }
  };

  const requestAndCheckLocation = async (currentUserId: string) => {
    // Reset state before re-checking
    setLoading(true);
    setLocation(null);
    setIsWithinRange(null);
    // setCurrentAbsenceType(null); // Keep currentAbsenceType until it's re-determined
    setCanProceed(false);
    setStatusMessage("Memeriksa koneksi, status absensi, dan lokasi..."); // Initial message

    let determinedAbsenceTypeThisCheck: "present" | "home" | null = null;
    let expectedAbsenceType: "present" | "home";
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // --- LOCAL STATE CHECK FIRST ---
    let effectiveMorningAbsenceDoneDate = morningAbsenceDoneDate;
    if (effectiveMorningAbsenceDoneDate && effectiveMorningAbsenceDoneDate !== today) {
      setMorningAbsenceDoneDate(null); // Reset for next render
      effectiveMorningAbsenceDoneDate = null; // Use null for this execution
    }

    if (effectiveMorningAbsenceDoneDate === today) {
      expectedAbsenceType = "home";
      setStatusMessage("Absen pagi telah dilakukan. Mempersiapkan absen pulang...");
    } else {
      // --- Supabase Check ---
      // Check network connectivity first (can be inside this block or outside if preferred)
      const netInfoState = await NetInfo.fetch();
      if (!netInfoState.isConnected || !netInfoState.isInternetReachable) {
        setStatusMessage("Tidak ada koneksi internet. Silakan periksa koneksi Anda.");
        setLoading(false);
        return;
      }

      const { data: lastAbsenceData, error: lastAbsenceError } = await supabase
        .from("absences")
        .select("status")
        .eq("user_id", currentUserId)
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastAbsenceError && lastAbsenceError.code !== "PGRST116") { // PGRST116: No rows found
        console.error("Error fetching last absence:", lastAbsenceError.message);
        setStatusMessage(`Gagal memeriksa status absensi terakhir: ${lastAbsenceError.message}`);
        setLoading(false);
        return;
      }

      if (lastAbsenceData && lastAbsenceData.status === "Hadir") {
        expectedAbsenceType = "home";
      } else if (lastAbsenceData && lastAbsenceData.status === "Pulang") {
        setStatusMessage("Anda sudah menyelesaikan absensi (Hadir dan Pulang) untuk hari ini.");
        setCanProceed(false); // Ensure canProceed is false
        setCurrentAbsenceType(null); // No further absence type
        setLoading(false);
        return;
      } else if (!lastAbsenceData) {
        expectedAbsenceType = "present";
      } else {
        console.warn(`[AbsenceReport] Unexpected lastAbsenceData.status: '${lastAbsenceData.status}'. Defaulting to present.`);
        expectedAbsenceType = "present";
      }
    }
    // --- End of Supabase Check / Local State decision ---

    // At this point, expectedAbsenceType should be defined.
    // If it's not (e.g. logic error), we should handle it.
    if (!expectedAbsenceType) {
        setStatusMessage("Tidak dapat menentukan tipe absensi. Silakan coba lagi.");
        setLoading(false);
        return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (expectedAbsenceType === "present") {
      if (currentHour === 7 && currentMinute >= 0 && currentMinute <= 30) {
        determinedAbsenceTypeThisCheck = "present";
        setCurrentAbsenceType("present");
        setCanProceed(true);
        setStatusMessage("Waktu absen masuk valid. Memeriksa lokasi...");
      } else {
        setStatusMessage("Absen masuk hanya bisa dilakukan antara pukul 07:00 - 07:30.");
        setCurrentAbsenceType("present"); // Reflect the intent for clearer messaging
        setCanProceed(false);
        setLoading(false);
        return;
      }
    } else { // expectedAbsenceType === "home"
      if (currentHour >= 15) {
        determinedAbsenceTypeThisCheck = "home";
        setCurrentAbsenceType("home");
        setCanProceed(true);
        setStatusMessage("Waktu absen pulang valid. Memeriksa lokasi...");
      } else {
        setStatusMessage("Absen pulang hanya bisa dilakukan setelah pukul 15:00.");
        setCurrentAbsenceType("home"); // Reflect the intent for clearer messaging
        setCanProceed(false);
        setLoading(false);
        return;
      }
    }

    const { status: locationPermissionStatus } = await Location.requestForegroundPermissionsAsync();
    if (locationPermissionStatus !== "granted") {
      setStatusMessage("Izin lokasi ditolak. Aktifkan izin lokasi untuk melanjutkan.");
      setLoading(false);
      return;
    }

    setStatusMessage("Mendapatkan lokasi saat ini...");
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Location request timed out")),
        15000,
      ),
    );

    const currentLocation = (await Promise.race([
      locationPromise,
      timeoutPromise,
    ])) as Location.LocationObject;

    setLocation(currentLocation);

    // SMKN 2 Magelang coordinates
    const schoolLatitude = -7.4503;
    const schoolLongitude = 110.2241;
    const maxDistanceInMeters = 500; // Increased range for testing, adjust as needed

    const distance = calculateDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      schoolLatitude,
      schoolLongitude,
    );

    const withinRange = distance <= maxDistanceInMeters;
    setIsWithinRange(withinRange);

    if (withinRange) {
      // Use the locally determined type for this message to ensure consistency within this check
      setStatusMessage(
        determinedAbsenceTypeThisCheck === "present"
          ? `Absen Masuk: Anda berada dalam jangkauan (${Math.round(distance)}m).`
          : determinedAbsenceTypeThisCheck === "home"
            ? `Absen Pulang: Anda berada dalam jangkauan (${Math.round(distance)}m).`
            : `Anda berada dalam jangkauan (${Math.round(distance)}m).` // Fallback if type is somehow null
      );
    } else {
      setStatusMessage(
        `Anda berada di luar jangkauan (${Math.round(distance)}m). Tidak dapat melanjutkan absensi.`
      );
      setIsWithinRange(false); // Explicitly set to false
      setCanProceed(false); // User cannot proceed if out of range
    }
    setLoading(false); // Ensure loading is set to false after all checks
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

  const navigateToCameraWithLocation = () => {
    if (location && userId && currentAbsenceType && canProceed) {
      router.push({
        pathname: "/attendance/CameraAttendance",
        params: {
          latitude: location.coords.latitude.toString(),
          longitude: location.coords.longitude.toString(),
          userId,
          absenceType: currentAbsenceType, // Pass the absence type
        },
      });
    } else {
      Alert.alert("Error", "Tidak dapat melanjutkan, data tidak lengkap atau kondisi tidak terpenuhi.");
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
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? "white" : "black"}
          />
        </TouchableOpacity>
        <Text className={`text-xl font-semibold ml-2 ${isDarkMode ? "text-white" : "text-black"}`}>
          Lapor Absensi
        </Text>
      </View>

      {/* Main Content */}
      <View
        className={`flex-1 px-5 py-6 ${isDarkMode ? "bg-gray-900" : "bg-white"} justify-center items-center`}
      >
        {loading ? (
          <ActivityIndicator size="large" color={isDarkMode ? "white" : "black"} />
        ) : (
          <>
            <MaterialIcons
              name={
                isWithinRange === true && canProceed
                  ? "location-on"
                  : isWithinRange === false
                    ? "location-off"
                    : "location-searching"
              }
              size={80}
              color={
                isWithinRange === true && canProceed
                  ? (isDarkMode ? "rgb(34, 197, 94)" : "green") // Tailwind green-500
                  : isWithinRange === false
                    ? (isDarkMode ? "rgb(239, 68, 68)" : "red") // Tailwind red-500
                    : (isDarkMode ? "rgb(209, 213, 219)" : "gray") // Tailwind gray-400
              }
              className="mb-4"
            />
            <Text className={`text-lg text-center mb-6 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              {statusMessage}
            </Text>
            {isWithinRange === true && location && canProceed && currentAbsenceType && (
              <Text className={`text-md font-bold text-center mb-6 ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
                {currentAbsenceType === "present" ? "Siap untuk Absen Masuk" : "Siap untuk Absen Pulang"}
              </Text>
            )}
          </>
        )}
        <Button
          variant="outline"
          className={`mt-8 w-full ${isDarkMode ? "border-sky-500" : "border-blue-500"}`}
          onPress={() => checkCurrentUserAndThenLocation()} // Re-check everything
          disabled={loading}
        >
          <Text className={`${isDarkMode ? "text-sky-500" : "text-blue-500"}`}>
            {loading ? "Memeriksa..." : "Coba Lagi / Segarkan Status"}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default AbsenceReport;
