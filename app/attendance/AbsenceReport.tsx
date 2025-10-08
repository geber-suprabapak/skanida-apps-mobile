// --- NECESSARY IMPORTS ---
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Alert, TouchableOpacity, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import {
  RefreshCw,
  Loader2,
  ChevronLeft,
  MapPin,
  MapPinOff,
  HelpCircle,
} from "lucide-react-native";

// --- TYPES AND INTERFACES ---
type AbsenceType = "present" | "home";
type LocationCheckStatus = "checking" | "verified" | "failed" | "out_of_range";

// --- CONSTANTS ---
const AUTO_NAVIGATE_DELAY_MS = 1000;

// Location optimization constants (removed fast location)
const LOCATION_CONFIG = {
  HIGH_ACCURACY: Location.Accuracy.High,
  // Timeout 10 detik untuk lokasi diperlukan karena:
  // 1. GPS membutuhkan waktu untuk mendapatkan sinyal satelit yang akurat
  // 2. High accuracy mode memerlukan triangulasi dari multiple satellites
  // 3. Dalam ruangan atau area dengan sinyal GPS lemah butuh waktu lebih lama
  // 4. Akurasi lokasi sangat penting untuk validasi absensi di area sekolah
  // 5. Mencegah false negative pada kondisi sinyal GPS yang sedang loading
  HIGH_TIMEOUT: 10000,
} as const;

// --- MAIN COMPONENT ---
const AbsenceReport = () => {
  // --- HOOKS AND STATE ---
  const router = useRouter();

  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationCheckStatus>("checking");
  const [statusMessage, setStatusMessage] = useState("Initializing...");

  // Absence state
  const [currentAbsenceType, setCurrentAbsenceType] =
    useState<AbsenceType | null>(null);
  const [canProceedToCamera, setCanProceedToCamera] = useState(false);
  const [morningAbsenceCompleted, setMorningAbsenceCompleted] = useState<
    string | null
  >(null);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );
    return () => backHandler.remove();
  }, [router]);

  // --- MEMOIZED VALUES ---
  const todayDateString = useMemo(
    () => new Date().toISOString().split("T")[0],
    [],
  );

  // --- UTILITY FUNCTIONS ---
  // Check location via RPC
  const checkLocationViaRpc = useCallback(
    async (location: Location.LocationObject): Promise<boolean> => {
      try {
        setStatusMessage("Memverifikasi lokasi dengan server...");

        const { data, error } = await supabase.rpc("check_nearest_location", {
          user_lat: location.coords.latitude,
          user_lon: location.coords.longitude,
        });

        if (error) {
          setStatusMessage(`Gagal memverifikasi lokasi: ${error.message}`);
          setLocationStatus("failed");
          return false;
        }

        // RPC now returns JSON object directly
        if (!data) {
          setStatusMessage(
            "Tidak ada lokasi aktif yang tersedia. Hubungi administrator.",
          );
          setLocationStatus("failed");
          return false;
        }

        const nearestLocation = data as {
          location_id: number;
          location_name: string;
          distance_m: number;
          is_within_range: boolean;
        };

        if (!nearestLocation.location_id) {
          setStatusMessage(
            "Tidak dapat menemukan lokasi terdekat. Hubungi administrator.",
          );
          setLocationStatus("failed");
          return false;
        }

        if (nearestLocation.is_within_range) {
          setLocationStatus("verified");
          setCanProceedToCamera(true);
          setStatusMessage(
            `Lokasi terverifikasi di ${nearestLocation.location_name} (${Math.round(nearestLocation.distance_m)}m). Lanjut ke kamera.`,
          );
          return true;
        } else {
          setLocationStatus("out_of_range");
          setStatusMessage(
            `Anda berada di luar jangkauan. Lokasi terdekat: ${nearestLocation.location_name} (${Math.round(nearestLocation.distance_m)}m). Tidak dapat melanjutkan absensi.`,
          );
          return false;
        }
      } catch (err: any) {
        setStatusMessage(
          `Terjadi kesalahan saat memverifikasi lokasi: ${err.message || "Unknown error"}`,
        );
        setLocationStatus("failed");
        return false;
      }
    },
    [],
  );

  // Get location with high accuracy only
  const getLocationWithHighAccuracy =
    useCallback(async (): Promise<Location.LocationObject | null> => {
      try {
        setStatusMessage("Mendapatkan lokasi dengan akurasi tinggi...");

        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: LOCATION_CONFIG.HIGH_ACCURACY,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Location timeout")),
            LOCATION_CONFIG.HIGH_TIMEOUT,
          ),
        );

        const location = await Promise.race([locationPromise, timeoutPromise]);

        return location;
      } catch (error: any) {
        if (error?.message?.includes("timeout")) {
          setStatusMessage(
            "Gagal mendapatkan lokasi: Waktu habis. Pastikan GPS aktif.",
          );
        } else {
          setStatusMessage(
            "Gagal mendapatkan lokasi. Pastikan GPS dan izin lokasi aktif.",
          );
        }
        return null;
      }
    }, []);

  const navigateToCamera = useCallback(() => {
    if (
      !currentLocation ||
      !userId ||
      !currentAbsenceType ||
      !canProceedToCamera
    ) {
      Alert.alert(
        "Error",
        "Tidak dapat melanjutkan, data tidak lengkap atau kondisi tidak terpenuhi.",
      );
      return;
    }

    router.push({
      pathname: "/attendance/CameraAttendance",
      params: {
        latitude: currentLocation.coords.latitude.toString(),
        longitude: currentLocation.coords.longitude.toString(),
        userId,
        absenceType: currentAbsenceType,
      },
    });
  }, [currentLocation, userId, currentAbsenceType, canProceedToCamera, router]);

  // --- CORE FUNCTIONS ---
  const checkUserAuthentication = useCallback(async (): Promise<
    string | null
  > => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      if (!data?.user) {
        Alert.alert(
          "Error",
          "Pengguna tidak ditemukan. Silakan login kembali.",
        );
        router.replace("/auth/Login");
        return null;
      }

      return data.user.id;
    } catch (error) {
      Alert.alert("Error", "Gagal mendapatkan data pengguna");
      throw error;
    }
  }, [router]);

  const determineAbsenceType = useCallback(
    async (currentUserId: string): Promise<AbsenceType | null> => {
      // Check local state first for performance
      if (morningAbsenceCompleted === todayDateString) {
        return "home";
      }

      // Reset if date changed
      if (
        morningAbsenceCompleted &&
        morningAbsenceCompleted !== todayDateString
      ) {
        setMorningAbsenceCompleted(null);
      }

      // Check network connectivity
      try {
        const netInfoState = await NetInfo.fetch();
        if (!netInfoState.isConnected || !netInfoState.isInternetReachable) {
          setStatusMessage(
            "Tidak ada koneksi internet. Silakan periksa koneksi Anda.",
          );
          return null;
        }
      } catch {
        // Ignore network info failures; continue without connection status.
      }
      // Query database for today's attendance
      try {
        const { data: lastAbsenceData, error: lastAbsenceError } =
          await supabase
            .from("absences")
            .select("status, created_at")
            .eq("user_id", currentUserId)
            .eq("date", todayDateString)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (lastAbsenceError) {
          if (lastAbsenceError.code === "PGRST116") {
            // No data found for today - check if there's any record from previous days
            // Query for the most recent absence record regardless of date
            const { data: lastAnyAbsenceData, error: lastAnyAbsenceError } =
              await supabase
                .from("absences")
                .select("status, created_at, date")
                .eq("user_id", currentUserId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (
              lastAnyAbsenceError &&
              lastAnyAbsenceError.code !== "PGRST116"
            ) {
              setStatusMessage(
                `Gagal memeriksa riwayat absensi: ${lastAnyAbsenceError.message}`,
              );
              return null;
            }

            if (lastAnyAbsenceData) {
              const lastAbsenceDate = new Date(lastAnyAbsenceData.created_at)
                .toISOString()
                .split("T")[0];

              // If the last record is from a previous day, allow morning attendance
              if (lastAbsenceDate !== todayDateString) {
                return "present";
              }
            }

            // No previous records or same day record, default to morning attendance
            return "present";
          } else {
            setStatusMessage(
              `Gagal memeriksa status absensi: ${lastAbsenceError.message}`,
            );
            return null;
          }
        }

        if (lastAbsenceData) {
          // Check if the record is actually from today by comparing created_at date
          const recordDate = new Date(lastAbsenceData.created_at)
            .toISOString()
            .split("T")[0];

          // If the record is from a previous day, allow morning attendance
          if (recordDate !== todayDateString) {
            return "present";
          }

          // Record is from today, check status
          switch (lastAbsenceData.status) {
            case "Hadir":
              setMorningAbsenceCompleted(todayDateString);
              return "home";
            case "Pulang":
              setStatusMessage(
                "Anda sudah menyelesaikan absensi (Hadir dan Pulang) untuk hari ini.",
              );
              return null;
            default:
              return "present";
          }
        } else {
          // This should not happen after handling PGRST116, but keeping as fallback
          return "present";
        }
      } catch {
        setStatusMessage("Gagal memeriksa status absensi dari database.");
        return null;
      }
    },
    [todayDateString, morningAbsenceCompleted],
  );

  const requestLocationPermissionAndGet =
    useCallback(async (): Promise<Location.LocationObject | null> => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();

        if (status !== "granted") {
          setStatusMessage("Meminta izin lokasi...");

          const result = await Location.requestForegroundPermissionsAsync();
          status = result.status;

          if (status !== "granted") {
            setStatusMessage(
              "Izin lokasi ditolak. Aktifkan izin lokasi untuk melanjutkan.",
            );
            return null;
          }
        }

        return await getLocationWithHighAccuracy();
      } catch {
        setStatusMessage(
          "Gagal mendapatkan izin lokasi atau lokasi tidak tersedia.",
        );
        return null;
      }
    }, [getLocationWithHighAccuracy]);

  const performFullAbsenceCheck = useCallback(async () => {
    setIsLoading(true);
    setLocationStatus("checking");
    setCanProceedToCamera(false);
    setStatusMessage("Memeriksa status absensi dan lokasi...");

    try {
      const [authenticatedUserId, location] = await Promise.all([
        checkUserAuthentication(),
        requestLocationPermissionAndGet(),
      ]);

      if (!authenticatedUserId) {
        setIsLoading(false);
        return;
      }
      setUserId(authenticatedUserId);

      if (!location) {
        setLocationStatus("failed");
        setIsLoading(false);
        return;
      }
      setCurrentLocation(location);

      setStatusMessage("Memeriksa status absensi...");
      const absenceType = await determineAbsenceType(authenticatedUserId);
      if (!absenceType) {
        setIsLoading(false);
        return;
      }
      setCurrentAbsenceType(absenceType);

      const actionText =
        absenceType === "present" ? "absen masuk" : "absen pulang";
      setStatusMessage(`Memverifikasi lokasi untuk ${actionText}...`);

      // Use RPC to check location
      await checkLocationViaRpc(location);
    } catch {
      setLocationStatus("failed");
      setStatusMessage("Terjadi kesalahan saat memeriksa status absensi.");
    } finally {
      setIsLoading(false);
    }
  }, [
    checkUserAuthentication,
    requestLocationPermissionAndGet,
    determineAbsenceType,
    checkLocationViaRpc,
  ]);

  // --- EFFECTS ---
  useEffect(() => {
    performFullAbsenceCheck();
  }, [performFullAbsenceCheck]);

  // Auto-navigate to camera when conditions are met (faster)
  useEffect(() => {
    if (
      locationStatus === "verified" &&
      currentLocation &&
      !isLoading &&
      canProceedToCamera &&
      currentAbsenceType
    ) {
      const timer = setTimeout(navigateToCamera, AUTO_NAVIGATE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [
    locationStatus,
    currentLocation,
    isLoading,
    canProceedToCamera,
    currentAbsenceType,
    navigateToCamera,
  ]);

  // --- RENDER HELPERS ---
  const getStatusColorClass = (): string => {
    if (locationStatus === "verified" && canProceedToCamera) {
      return "text-green-600";
    }
    if (locationStatus === "out_of_range" || locationStatus === "failed") {
      return "text-red-600";
    }
    return "text-gray-500";
  };

  // --- RENDER ---
  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-gray-900">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View className="flex-row items-center p-4 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <Icon
            as={ChevronLeft}
            className="size-6 text-black dark:text-white"
          />
        </TouchableOpacity>
        <Text variant="h2" className="text-black dark:text-white">
          Lapor Absensi
        </Text>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-4 py-6 justify-center items-center bg-background dark:bg-gray-900">
        {isLoading ? (
          <Icon as={Loader2} className="size-8 text-black dark:text-white" />
        ) : (
          <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
            <CardHeader className="items-center">
              {locationStatus === "verified" && canProceedToCamera ? (
                <Icon
                  as={MapPin}
                  className={`size-8 ${getStatusColorClass()}`}
                />
              ) : locationStatus === "out_of_range" ||
                locationStatus === "failed" ? (
                <Icon
                  as={MapPinOff}
                  className={`size-8 ${getStatusColorClass()}`}
                />
              ) : (
                <Icon
                  as={HelpCircle}
                  className={`size-8 ${getStatusColorClass()}`}
                />
              )}
            </CardHeader>
            <CardContent className="items-center">
              <CardTitle className="text-xl text-center mb-2 text-gray-800 dark:text-white">
                Status Absensi
              </CardTitle>
              <CardDescription className="text-base text-center mb-4 text-gray-600 dark:text-gray-300">
                {statusMessage}
              </CardDescription>

              {/* Success State */}
              {locationStatus === "verified" &&
                canProceedToCamera &&
                currentAbsenceType && (
                  <View className="p-3 rounded-md bg-green-100 w-full items-center">
                    <Text variant="h3" className="text-green-700">
                      {currentAbsenceType === "present"
                        ? "Siap untuk Absen Masuk"
                        : "Siap untuk Absen Pulang"}
                    </Text>
                    <Text variant="small" className="text-green-600">
                      Anda akan diarahkan ke kamera.
                    </Text>
                  </View>
                )}

              {/* Error State */}
              {(locationStatus === "out_of_range" ||
                locationStatus === "failed") && (
                <View className="p-3 rounded-md bg-red-100 w-full items-center">
                  <Text variant="h3" className="text-red-700">
                    Tidak Dapat Melanjutkan
                  </Text>
                  <Text variant="small" className="text-red-600">
                    {locationStatus === "out_of_range"
                      ? "Anda berada di luar jangkauan sekolah."
                      : "Terjadi kesalahan saat memverifikasi lokasi."}
                  </Text>
                </View>
              )}

              {/* Completed State */}
              {!canProceedToCamera &&
                !isLoading &&
                statusMessage.includes("sudah menyelesaikan absensi") && (
                  <View className="p-3 rounded-md bg-sky-100 w-full items-center">
                    <Text variant="h3" className="text-sky-700">
                      Absensi Selesai
                    </Text>
                    <Text variant="small" className="text-sky-600">
                      Tidak ada tindakan lebih lanjut untuk hari ini.
                    </Text>
                  </View>
                )}
            </CardContent>
          </Card>
        )}

        {/* Refresh Button */}
        <Button
          variant="outline"
          className="mt-8 w-full max-w-md border-sky-500 dark:border-sky-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          onPress={performFullAbsenceCheck}
          disabled={isLoading}
        >
          <Icon
            as={RefreshCw}
            className="size-5 text-sky-500 dark:text-sky-400 mr-2"
          />
          <Text
            variant="default"
            className="text-sky-600 dark:text-sky-400 font-medium"
          >
            {isLoading ? "Memeriksa..." : "Segarkan Status"}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default AbsenceReport;
