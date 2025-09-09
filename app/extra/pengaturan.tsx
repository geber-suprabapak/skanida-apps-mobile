import { useIsFocused } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Image,
  Clipboard,
  InteractionManager,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { useColorScheme } from "~/lib/useColorScheme";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { User } from "~/lib/icons/User";
import { Key } from "~/lib/icons/Key";
import { Moon } from "~/lib/icons/Moon";
import { Bell } from "~/lib/icons/Bell";
import { LogOut } from "~/lib/icons/LogOut";
import { ChevronRight } from "~/lib/icons/ChevronRight";
import { Settings } from "~/lib/icons/Settings";
import { Card } from "~/components/ui/card";

// Performance optimization utilities
const prefetchProfileData = async (userId: string) => {
  try {
    // Prefetch user profile data in background
    const { data } = await supabase
      .from("user_profiles")
      .select("full_name, avatar_url")
      .eq("user_id", userId)
      .single();
    return data;
  } catch (error) {
    console.log("Prefetch failed silently:", error);
    return null;
  }
};

// Local storage utilities for caching profile data
const PROFILE_CACHE_KEY = "user_profile_cache";
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

interface CachedProfileData {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  timestamp: number;
}

const saveProfileToCache = async (
  userId: string,
  fullName: string,
  avatarUrl: string | null,
) => {
  try {
    const cacheData: CachedProfileData = {
      userId,
      fullName,
      avatarUrl,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.log("Failed to save profile to cache:", error);
  }
};

const getProfileFromCache = async (
  userId: string,
): Promise<CachedProfileData | null> => {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;

    const cacheData: CachedProfileData = JSON.parse(cached);

    // Check if cache is for the same user and not expired
    if (cacheData.userId !== userId) return null;

    const hoursSinceCache =
      (Date.now() - cacheData.timestamp) / (1000 * 60 * 60);
    if (hoursSinceCache > CACHE_EXPIRY_HOURS) {
      // Cache expired, remove it
      await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }

    return cacheData;
  } catch (error) {
    console.log("Failed to get profile from cache:", error);
    return null;
  }
};

const clearProfileCache = async () => {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (error) {
    console.log("Failed to clear profile cache:", error);
  }
};

// Debounce utility for performance
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

function Pengaturan() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const isFocused = useIsFocused();

  const { isDarkColorScheme, setColorScheme } = useColorScheme();

  // Memoize initial profile data to avoid recalculations
  const initialProfileData = useMemo(
    () => ({
      name: user?.user_metadata?.name || user?.email || "Pengguna Skanida",
      avatar: user?.user_metadata?.avatar_url || null,
    }),
    [user?.user_metadata?.name, user?.email, user?.user_metadata?.avatar_url],
  );

  const [profileFullName, setProfileFullName] = useState(
    initialProfileData.name,
  );
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(
    initialProfileData.avatar,
  );
  const [copiedId, setCopiedId] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Optimized color scheme toggle with useCallback
  const toggleColorScheme = useCallback((): void => {
    const newTheme: "light" | "dark" = isDarkColorScheme ? "light" : "dark";
    setColorScheme(newTheme);
  }, [isDarkColorScheme, setColorScheme]);

  // Optimized navigation handlers with useCallback
  const navigateToEditProfile = useCallback(() => {
    // Preload the destination with a slight delay to improve perceived performance
    requestAnimationFrame(() => {
      router.push("/profile/EditProfile");
    });
  }, [router]);
  const navigateToChangePassword = useCallback(() => {
    requestAnimationFrame(() => {
      router.push("/profile/ChangePassword");
    });
  }, [router]);

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
  // Optimized profile data fetching with local cache
  const fetchProfileDataAndUpdateState = useCallback(async () => {
    if (!user) {
      setProfileFullName("Pengguna Skanida");
      setProfileAvatarUrl(null);
      setIsDataLoaded(true);
      return;
    }

    // First, try to load from cache for immediate display
    const cachedProfile = await getProfileFromCache(user.id);
    if (cachedProfile) {
      setProfileFullName(cachedProfile.fullName);
      setProfileAvatarUrl(cachedProfile.avatarUrl);
      setIsDataLoaded(true);
    } else {
      // Use user metadata as fallback if no cache
      const fallbackName =
        user.user_metadata?.name || user.email || "Pengguna Skanida";
      const fallbackAvatar = user.user_metadata?.avatar_url || null;
      setProfileFullName(fallbackName);
      setProfileAvatarUrl(fallbackAvatar);
      setIsDataLoaded(true);
    }

    // Fetch fresh data in background using InteractionManager
    InteractionManager.runAfterInteractions(async () => {
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from("user_profiles")
          .select("full_name, avatar_url")
          .eq("user_id", user.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          console.error(
            "Pengaturan: Error fetching from user_profiles:",
            profileError.message,
          );
        } else if (userProfile) {
          const updatedName =
            userProfile.full_name ||
            user.user_metadata?.name ||
            user.email ||
            "Pengguna Skanida";
          const updatedAvatar =
            userProfile.avatar_url || user.user_metadata?.avatar_url || null;

          // Update cache with fresh data
          await saveProfileToCache(user.id, updatedName, updatedAvatar);

          // Only update state if data actually changed to avoid unnecessary re-renders
          if (updatedName !== profileFullName) {
            setProfileFullName(updatedName);
          }
          if (updatedAvatar !== profileAvatarUrl) {
            setProfileAvatarUrl(updatedAvatar);
          }
        }
      } catch (err) {
        console.error("Pengaturan: Unexpected error fetching profile:", err);
      }
    });
  }, [user, profileFullName, profileAvatarUrl]);

  // Optimized useEffect with proper dependency management
  useEffect(() => {
    if (isFocused && user) {
      fetchProfileDataAndUpdateState();
    } else if (!user) {
      setProfileFullName("Pengguna Skanida");
      setProfileAvatarUrl(null);
      setIsDataLoaded(true);
    }
  }, [user, isFocused, fetchProfileDataAndUpdateState]);

  // Corrected logout handler
  const handleLogout = useCallback(async () => {
    Alert.alert(
      "Logout",
      "Apakah Anda yakin ingin keluar?",
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Ya, Keluar",
          style: "destructive",
          onPress: async () => {
            try {
              // Sign out from Supabase
              await supabase.auth.signOut();

              // Clear all local data for a clean logout
              await clearProfileCache();
              await AsyncStorage.clear();

              // Update state and redirect
              setUser(null);
              router.replace("/auth/AuthSelector");
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert(
                "Error",
                "Gagal melakukan logout. Silakan coba lagi.",
              );
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [setUser, router]);

  // Optimized copy ID handler with useCallback
  const handleCopyId = useCallback(async () => {
    if (user?.id) {
      Clipboard.setString(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000); // Reset after 2 seconds
    }
  }, [user?.id]);

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-gray-50"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        className={`flex-row items-center p-4 border-b ${
          isDarkColorScheme
            ? "border-gray-700 bg-gray-900"
            : "border-gray-200 bg-white"
        }`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft
            size={24}
            color={isDarkColorScheme ? "#ffffff" : "#000000"}
          />
        </TouchableOpacity>

        <Text
          className={`text-lg font-bold flex-1 ${
            isDarkColorScheme ? "text-white" : "text-gray-900"
          }`}
        >
          Pengaturan
        </Text>
      </View>

      <ScrollView
        className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Profile Section */}
        <View className="px-6 pt-4 pb-3">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-semibold mb-3 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Profil Pengguna
            </Text>

            {/* Profile Header */}
            <View className="flex-row items-center mb-4">
              {profileAvatarUrl ? (
                <View
                  style={{
                    shadowColor: "#000000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                    borderRadius: 32,
                  }}
                >
                  <Image
                    source={{
                      uri: profileAvatarUrl,
                      cache: "force-cache",
                    }}
                    className="w-16 h-16 rounded-full"
                  />
                </View>
              ) : (
                <View
                  className={`w-16 h-16 rounded-full ${
                    isDarkColorScheme ? "bg-blue-600" : "bg-blue-500"
                  } justify-center items-center`}
                  style={{
                    shadowColor: "#3B82F6",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  <Text className="text-xl font-bold text-white">
                    {(profileFullName || user?.email)
                      ?.charAt(0)
                      .toUpperCase() || "U"}
                  </Text>
                </View>
              )}

              <View className="flex-1 ml-4">
                <Text
                  className={`text-lg font-bold ${
                    isDarkColorScheme ? "text-white" : "text-gray-900"
                  }`}
                >
                  {profileFullName || user?.email?.split("@")[0] || "Pengguna"}
                </Text>
                <Text
                  className={`text-sm mt-1 ${
                    isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {user?.email || "Tidak ada email"}
                </Text>

                <TouchableOpacity
                  onPress={handleCopyId}
                  className={`self-start mt-2 px-3 py-1.5 rounded-full ${
                    copiedId
                      ? "bg-green-500"
                      : isDarkColorScheme
                        ? "bg-gray-700"
                        : "bg-gray-100"
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-xs font-medium ${
                      copiedId
                        ? "text-white"
                        : isDarkColorScheme
                          ? "text-gray-300"
                          : "text-gray-600"
                    }`}
                  >
                    {copiedId
                      ? "✓ ID Tersalin!"
                      : `ID: ${user?.id?.substring(0, 8) || "Unknown"}...`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </View>

        {/* Account Settings Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-semibold mb-3 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Pengaturan Akun
            </Text>

            <View className="space-y-0">
              <TouchableOpacity
                className={`flex-row items-center p-3 rounded-t-lg border-b ${
                  isDarkColorScheme
                    ? "hover:bg-gray-700 active:bg-gray-700 border-gray-700"
                    : "hover:bg-gray-50 active:bg-gray-50 border-gray-100"
                }`}
                onPress={navigateToEditProfile}
                activeOpacity={0.7}
              >
                <View
                  className={`w-8 h-8 rounded-lg ${
                    isDarkColorScheme ? "bg-blue-600" : "bg-blue-100"
                  } justify-center items-center mr-3`}
                >
                  <User
                    size={16}
                    color={isDarkColorScheme ? "#ffffff" : "#3b82f6"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-medium ${
                      isDarkColorScheme ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Edit Profil
                  </Text>
                  <Text
                    className={`text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Ubah nama dan foto profil
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-row items-center p-3 rounded-b-lg ${
                  isDarkColorScheme
                    ? "hover:bg-gray-700 active:bg-gray-700"
                    : "hover:bg-gray-50 active:bg-gray-50"
                }`}
                onPress={navigateToChangePassword}
                activeOpacity={0.7}
              >
                <View
                  className={`w-8 h-8 rounded-lg ${
                    isDarkColorScheme ? "bg-green-600" : "bg-green-100"
                  } justify-center items-center mr-3`}
                >
                  <Key
                    size={16}
                    color={isDarkColorScheme ? "#ffffff" : "#16a34a"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-medium ${
                      isDarkColorScheme ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Ubah Password
                  </Text>
                  <Text
                    className={`text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Perbarui kata sandi akun
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Preferences Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-semibold mb-3 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Lain-Lain
            </Text>

            <View className="space-y-0">
              <View
                className={`flex-row items-center p-3 rounded-t-lg border-b ${
                  isDarkColorScheme
                    ? "bg-gray-700/30 border-gray-700"
                    : "bg-gray-50 border-gray-100"
                }`}
              >
                <View
                  className={`w-8 h-8 rounded-lg ${
                    isDarkColorScheme ? "bg-purple-600" : "bg-purple-100"
                  } justify-center items-center mr-3`}
                >
                  <Moon
                    size={16}
                    color={isDarkColorScheme ? "#ffffff" : "#7c3aed"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-medium ${
                      isDarkColorScheme ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Mode Gelap
                  </Text>
                  <Text
                    className={`text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Tampilan gelap untuk kenyamanan mata
                  </Text>
                </View>
                <Switch
                  value={isDarkColorScheme}
                  onValueChange={toggleColorScheme}
                  trackColor={{
                    false: isDarkColorScheme ? "#374151" : "#e5e7eb",
                    true: "#3b82f6",
                  }}
                  thumbColor={isDarkColorScheme ? "#fff" : "#f9fafb"}
                />
              </View>

              <TouchableOpacity
                className={`flex-row items-center p-3 rounded-b-lg ${
                  isDarkColorScheme
                    ? "hover:bg-gray-700 active:bg-gray-700"
                    : "hover:bg-gray-50 active:bg-gray-50"
                }`}
                onPress={() => {
                  Alert.alert(
                    "Test Error",
                    "Mengirim error ke Sentry untuk testing",
                  );
                  throw new Error("Hello, again, Sentry!");
                }}
                activeOpacity={0.7}
              >
                <View
                  className={`w-8 h-8 rounded-lg ${
                    isDarkColorScheme ? "bg-orange-600" : "bg-orange-100"
                  } justify-center items-center mr-3`}
                >
                  <Bell
                    size={16}
                    color={isDarkColorScheme ? "#ffffff" : "#ea580c"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-medium ${
                      isDarkColorScheme ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Test Error Reporting
                  </Text>
                  <Text
                    className={`text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Kirim error ke Sentry untuk testing
                  </Text>
                </View>
                <ChevronRight
                  size={18}
                  color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Logout Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-semibold mb-3 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Akun
            </Text>

            <Button
              size="default"
              onPress={handleLogout}
              className="w-full bg-red-500 hover:bg-red-600"
              style={{
                shadowColor: "#ef4444",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center">
                <LogOut size={18} color="#ffffff" className="mr-2" />
                <Text className="text-white font-medium">Keluar dari Akun</Text>
              </View>
            </Button>
          </Card>
        </View>

        {/* App Info Section */}
        <View className="px-6">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-semibold mb-3 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Informasi Aplikasi
            </Text>

            <View className="space-y-3">
              <View>
                <Text
                  className={`text-sm font-medium ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Versi Aplikasi
                </Text>
                <Text
                  className={`text-base ${
                    isDarkColorScheme ? "text-white" : "text-gray-900"
                  }`}
                >
                  Version 1.6.2-internal.1
                </Text>
              </View>

              <View
                className={`pt-3 border-t ${
                  isDarkColorScheme ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <Text
                  className={`text-sm ${
                    isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  © 2025 Skanida Apps
                </Text>
                <Text
                  className={`text-sm ${
                    isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Semua hak dilindungi undang-undang
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Export the memoized component for better performance
export default memo(Pengaturan);
