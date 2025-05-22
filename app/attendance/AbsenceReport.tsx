// --- NECESSARY IMPORTS ---
import { Ionicons, MaterialIcons } from "@expo/vector-icons"; // Import icons
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, Alert, TouchableOpacity, ActivityIndicator } from "react-native"; // Added ActivityIndicator
import { SafeAreaView } from "react-native-safe-area-context"; // Import SafeAreaView

import { Button } from "~/components/ui/button"; // Use the new button
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"; // Import Card components
import { Text } from "~/components/ui/text"; // Import Text from ui
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

// Import NetInfo with better type handling
interface NetInfoState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

interface NetInfoType {
  addEventListener: (callback: (state: NetInfoState) => void) => {
    remove: () => void;
  };
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
  const [currentAbsenceType, setCurrentAbsenceType] = useState<
    "present" | "home" | null
  >(null);
  const [canProceed, setCanProceed] = useState<boolean>(false);
  const [morningAbsenceDoneDate, setMorningAbsenceDoneDate] = useState<
    string | null
  >(null); // Added state

  // Auto-navigate to camera when location is verified and conditions met
  useEffect(() => {
    if (
      isWithinRange === true &&
      location &&
      !loading &&
      canProceed &&
      currentAbsenceType
    ) {
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
    setCanProceed(false);
    setStatusMessage("Memeriksa status absensi dan lokasi..."); // Updated initial message

    let determinedAbsenceTypeThisCheck: "present" | "home" | null = null;
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // --- LOCAL STATE CHECK FIRST ---
    let effectiveMorningAbsenceDoneDate = morningAbsenceDoneDate;
    if (
      effectiveMorningAbsenceDoneDate &&
      effectiveMorningAbsenceDoneDate !== today
    ) {
      // If morningAbsenceDoneDate is for a previous day, reset it.
      setMorningAbsenceDoneDate(null);
      effectiveMorningAbsenceDoneDate = null;
    }

    if (effectiveMorningAbsenceDoneDate === today) {
      determinedAbsenceTypeThisCheck = "home";
      setCurrentAbsenceType("home");
      setStatusMessage(
        "Absen pagi telah dilakukan. Mempersiapkan absen pulang...",
      );
      setCanProceed(true); // Can proceed to location check for "Pulang"
    } else {
      // --- Supabase Check ---
      const netInfoState = await NetInfo.fetch();
      if (!netInfoState.isConnected || !netInfoState.isInternetReachable) {
        setStatusMessage(
          "Tidak ada koneksi internet. Silakan periksa koneksi Anda.",
        );
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

      if (lastAbsenceError && lastAbsenceError.code !== "PGRST116") {
        // PGRST116: No rows found
        console.error("Error fetching last absence:", lastAbsenceError.message);
        setStatusMessage(
          `Gagal memeriksa status absensi terakhir: ${lastAbsenceError.message}`,
        );
        setLoading(false);
        return;
      }

      if (lastAbsenceData && lastAbsenceData.status === "Hadir") {
        determinedAbsenceTypeThisCheck = "home";
        setCurrentAbsenceType("home");
        setStatusMessage(
          "Absen pagi telah terdeteksi dari server. Mempersiapkan absen pulang...",
        );
        setCanProceed(true); // Can proceed to location check for "Pulang"
      } else if (lastAbsenceData && lastAbsenceData.status === "Pulang") {
        setStatusMessage(
          "Anda sudah menyelesaikan absensi (Hadir dan Pulang) untuk hari ini.",
        );
        setCanProceed(false);
        setCurrentAbsenceType(null);
        setLoading(false);
        return;
      } else {
        // No absence yet today, or last one was not "Hadir" (e.g. incomplete)
        determinedAbsenceTypeThisCheck = "present";
        setCurrentAbsenceType("present");
        setStatusMessage("Mempersiapkan absen masuk...");
        setCanProceed(true); // Can proceed to location check for "Hadir"
      }
    }
    // --- End of Absence Type Determination ---

    if (!determinedAbsenceTypeThisCheck) {
      // If, after all checks, the absence type is not determined, stop.
      // This might happen if "Pulang" was already done (which includes a return),
      // or an error occurred preventing type determination.
      // Status message should already be set by the logic above.
      setLoading(false);
      return;
    }

    // --- Location Permission and Check ---
    const { status: locationPermissionStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (locationPermissionStatus !== "granted") {
      setStatusMessage(
        "Izin lokasi ditolak. Aktifkan izin lokasi untuk melanjutkan.",
      );
      setCanProceed(false); // Cannot proceed without location permission
      setLoading(false);
      return;
    }

    setStatusMessage(
      `Mendapatkan lokasi untuk ${determinedAbsenceTypeThisCheck === "present" ? "absen masuk" : "absen pulang"}...`,
    );

    let currentLocation: Location.LocationObject;
    try {
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Location request timed out")),
          15000,
        ),
      );

      currentLocation = await Promise.race([locationPromise, timeoutPromise]);
      setLocation(currentLocation);
    } catch (error: any) {
      console.error("Error getting location:", error);
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        error.message === "Location request timed out"
      ) {
        setStatusMessage("Gagal mendapatkan lokasi: Waktu habis.");
      } else {
        setStatusMessage("Gagal mendapatkan lokasi. Coba lagi.");
      }
      setLocation(null);
      setIsWithinRange(null);
      setCanProceed(false); // Cannot proceed if location fails
      setLoading(false);
      return;
    }

    // SMKN 2 Magelang coordinates
    const schoolLatitude = -7.4503;
    const schoolLongitude = 110.2241;
    const maxDistanceInMeters = 500;

    const distance = calculateDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      schoolLatitude,
      schoolLongitude,
    );

    const withinRange = distance <= maxDistanceInMeters;
    setIsWithinRange(withinRange);

    if (withinRange) {
      setStatusMessage(
        determinedAbsenceTypeThisCheck === "present"
          ? `Absen Masuk: Anda berada dalam jangkauan (${Math.round(distance)}m). Lanjut ke kamera.`
          : `Absen Pulang: Anda berada dalam jangkauan (${Math.round(distance)}m). Lanjut ke kamera.`,
      );
      // setCanProceed(true) is already set if we reached here and type is determined
    } else {
      setStatusMessage(
        `Anda berada di luar jangkauan (${Math.round(distance)}m). Tidak dapat melanjutkan absensi.`,
      );
      setCanProceed(false); // User cannot proceed if out of range
    }
    setLoading(false);
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
      Alert.alert(
        "Error",
        "Tidak dapat melanjutkan, data tidak lengkap atau kondisi tidak terpenuhi.",
      );
    }
  };

  // --- RENDER UI ---
  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-gray-950" : "bg-gray-100"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false, // Hide the default header
        }}
      />

      {/* Custom Header */}
      <View
        className={`flex-row items-center p-4 border-b ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-gray-300 bg-white"}`}
      >
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? "white" : "black"}
          />
        </TouchableOpacity>
        <Text
          className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-black"}`}
        >
          Lapor Absensi
        </Text>
      </View>

      {/* Main Content */}
      <View
        className={`flex-1 px-4 py-6 justify-center items-center ${isDarkMode ? "bg-gray-950" : "bg-gray-100"}`}
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color={isDarkMode ? "white" : "black"}
          />
        ) : (
          <Card
            className={`w-full max-w-md ${isDarkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-300"}`}
          >
            <CardHeader className="items-center">
              <MaterialIcons
                name={
                  isWithinRange === true && canProceed
                    ? "location-on"
                    : isWithinRange === false
                      ? "location-off"
                      : "help-outline" // More neutral icon when status is undetermined
                }
                size={72} // Slightly smaller for card context
                color={
                  isWithinRange === true && canProceed
                    ? isDarkMode
                      ? "rgb(34, 197, 94)"
                      : "rgb(22, 163, 74)" // green-500 / green-600
                    : isWithinRange === false
                      ? isDarkMode
                        ? "rgb(239, 68, 68)"
                        : "rgb(220, 38, 38)" // red-500 / red-600
                      : isDarkMode
                        ? "rgb(156, 163, 175)"
                        : "rgb(107, 114, 128)" // gray-400 / gray-500
                }
              />
            </CardHeader>
            <CardContent className="items-center">
              <CardTitle
                className={`text-xl text-center mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}
              >
                Status Absensi
              </CardTitle>
              <CardDescription
                className={`text-base text-center mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                {statusMessage}
              </CardDescription>
              {isWithinRange === true &&
                location &&
                canProceed &&
                currentAbsenceType && (
                  <View
                    className={`p-3 rounded-md ${isDarkMode ? "bg-green-700" : "bg-green-100"} w-full items-center`}
                  >
                    <Text
                      className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-green-700"}`}
                    >
                      {currentAbsenceType === "present"
                        ? "Siap untuk Absen Masuk"
                        : "Siap untuk Absen Pulang"}
                    </Text>
                    <Text
                      className={`text-sm ${isDarkMode ? "text-green-200" : "text-green-600"}`}
                    >
                      Anda akan diarahkan ke kamera.
                    </Text>
                  </View>
                )}
              {isWithinRange === false && (
                <View
                  className={`p-3 rounded-md ${isDarkMode ? "bg-red-700" : "bg-red-100"} w-full items-center`}
                >
                  <Text
                    className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-red-700"}`}
                  >
                    Tidak Dapat Melanjutkan
                  </Text>
                  <Text
                    className={`text-sm ${isDarkMode ? "text-red-200" : "text-red-600"}`}
                  >
                    Anda berada di luar jangkauan atau kondisi lain tidak
                    terpenuhi.
                  </Text>
                </View>
              )}
              {!canProceed &&
                !loading &&
                !(isWithinRange === true && currentAbsenceType) &&
                statusMessage.includes("Anda sudah menyelesaikan absensi") && (
                  <View
                    className={`p-3 rounded-md ${isDarkMode ? "bg-sky-700" : "bg-sky-100"} w-full items-center`}
                  >
                    <Text
                      className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-sky-700"}`}
                    >
                      Absensi Selesai
                    </Text>
                    <Text
                      className={`text-sm ${isDarkMode ? "text-sky-200" : "text-sky-600"}`}
                    >
                      Tidak ada tindakan lebih lanjut untuk hari ini.
                    </Text>
                  </View>
                )}
            </CardContent>
          </Card>
        )}
        <Button
          variant="outline"
          className={`mt-8 w-full max-w-md ${isDarkMode ? "border-sky-600 bg-gray-800 hover:bg-gray-700" : "border-sky-500 bg-white hover:bg-gray-50"}`}
          onPress={() => checkCurrentUserAndThenLocation()} // Re-check everything
          disabled={loading}
        >
          <Ionicons
            name={loading ? "hourglass-outline" : "refresh-outline"}
            size={20}
            color={isDarkMode ? "#38bdf8" : "#0ea5e9"}
            style={{ marginRight: 8 }}
          />
          <Text
            className={`${isDarkMode ? "text-sky-400" : "text-sky-600"} font-medium`}
          >
            {loading ? "Memeriksa..." : "Segarkan Status"}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default AbsenceReport;
