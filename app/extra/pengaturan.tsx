import { useIsFocused } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Clipboard,
  InteractionManager,
  BackHandler,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";
import { Card } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  User,
  Key,
  Bell,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react-native";

function Pengaturan() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const isFocused = useIsFocused();
  const { theme, setTheme } = useThemeStore();

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
  const [isDarkMode, setIsDarkMode] = useState(theme === "dark");

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
  // Optimized profile data fetching without any local caching
  const fetchProfileDataAndUpdateState = useCallback(async () => {
    if (!user) {
      setProfileFullName("Pengguna Skanida");
      setProfileAvatarUrl(null);
      setIsDataLoaded(true);
      return;
    }

    // Immediate fallback to user metadata for quick render (no caching)
    const fallbackName =
      user.user_metadata?.name || user.email || "Pengguna Skanida";
    const fallbackAvatar = user.user_metadata?.avatar_url || null;
    setProfileFullName(fallbackName);
    setProfileAvatarUrl(fallbackAvatar);
    setIsDataLoaded(true);

    // Fetch fresh data directly from Supabase
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
          return;
        }

        if (userProfile) {
          const updatedName = userProfile.full_name || fallbackName;
          const updatedAvatar = userProfile.avatar_url || fallbackAvatar;

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
              await supabase.auth.signOut();

              // Remove only general storage clearing; no profile cache clearing helper
              await AsyncStorage.clear();

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

  // Toggle theme handler
  const toggleTheme = useCallback(() => {
    const newTheme = isDarkMode ? "light" : "dark";
    setIsDarkMode(!isDarkMode);
    setTheme(newTheme);
    colorScheme.set(newTheme);
  }, [isDarkMode, setTheme]);

  // Effect to sync theme state with store
  useEffect(() => {
    setIsDarkMode(theme === "dark");
    if (isDataLoaded) {
      // We could potentially save user theme preference to backend here
    }
  }, [theme, isDataLoaded]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-border bg-card">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Icon as={ChevronLeft} className="size-6 text-foreground" />
        </TouchableOpacity>

        <Text className="text-lg font-bold flex-1 text-foreground">
          Pengaturan
        </Text>
      </View>

      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Profile Section */}
        <View className="px-6 pt-4 pb-3">
          <Card className="p-4 bg-card border-border">
            <Text className="text-lg font-semibold mb-3 text-foreground">
              Profil Pengguna
            </Text>

            {/* Profile Header */}
            <View className="flex-row items-center mb-4">
              {profileAvatarUrl ? (
                <View
                  style={{
                    // removed shadowColor hardcode
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
                    }}
                    className="w-16 h-16 rounded-full"
                  />
                </View>
              ) : (
                <View
                  className="w-16 h-16 rounded-full bg-primary justify-center items-center"
                  style={{
                    // removed shadowColor hardcode
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  <Text className="text-xl font-bold text-primary-foreground">
                    {(profileFullName || user?.email)
                      ?.charAt(0)
                      .toUpperCase() || "U"}
                  </Text>
                </View>
              )}

              <View className="flex-1 ml-4">
                <Text className="text-lg font-bold text-foreground">
                  {profileFullName || user?.email?.split("@")[0] || "Pengguna"}
                </Text>
                <Text className="text-sm mt-1 text-muted-foreground">
                  {user?.email || "Tidak ada email"}
                </Text>

                <TouchableOpacity
                  onPress={handleCopyId}
                  className={`self-start mt-2 px-3 py-1.5 rounded-full ${
                    copiedId ? "bg-accent" : "bg-muted"
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-xs font-medium ${
                      copiedId
                        ? "text-accent-foreground"
                        : "text-muted-foreground"
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
          <Card className="p-4 bg-card border-border">
            <Text className="text-lg font-semibold mb-3 text-foreground">
              Pengaturan Akun
            </Text>

            <View className="space-y-0">
              <TouchableOpacity
                className="flex-row items-center p-3 rounded-t-lg border-b border-border"
                onPress={navigateToEditProfile}
                activeOpacity={0.7}
              >
                <View className="w-8 h-8 rounded-lg bg-primary/10 justify-center items-center mr-3">
                  <Icon as={User} className="size-4 text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground">
                    Edit Profil
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Ubah nama dan foto profil
                  </Text>
                </View>
                <Icon
                  as={ChevronRight}
                  className="size-5 text-muted-foreground"
                />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center p-3 rounded-b-lg"
                onPress={navigateToChangePassword}
                activeOpacity={0.7}
              >
                <View className="w-8 h-8 rounded-lg bg-primary/10 justify-center items-center mr-3">
                  <Icon as={Key} className="size-4 text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground">
                    Ubah Password
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Perbarui kata sandi akun
                  </Text>
                </View>
                <Icon
                  as={ChevronRight}
                  className="size-5 text-muted-foreground"
                />
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Preferences Section */}
        <View className="px-6 mb-3">
          <Card className="p-4 bg-card border-border">
            <Text className="text-lg font-semibold text-foreground">
              Lain-Lain
            </Text>

            <View className="space-y-0">
              {/* Dark Mode Toggle */}
              <TouchableOpacity
                className="flex-row items-center p-3 rounded-lg border-b border-border"
                activeOpacity={0.7}
              >
                <View className="w-8 h-8 rounded-lg bg-primary/10 justify-center items-center mr-3">
                  <Icon
                    as={isDarkMode ? Sun : Moon}
                    className="size-4 text-primary"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground">
                    Mode Gelap
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {isDarkMode ? "Aktif" : "Tidak Aktif"}
                  </Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: "#767577", true: "#4A5568" }}
                  thumbColor={isDarkMode ? "#38B2AC" : "#f4f3f4"}
                />
              </TouchableOpacity>

              {/* Error Testing Button */}
              <TouchableOpacity
                className="flex-row items-center p-3 rounded-lg"
                onPress={() => {
                  Alert.alert(
                    "Test Error",
                    "Mengirim error ke Sentry untuk testing",
                  );
                  throw new Error("Hello, again, Sentry!");
                }}
                activeOpacity={0.7}
              >
                <View className="w-8 h-8 rounded-lg bg-primary/10 justify-center items-center mr-3">
                  <Icon as={Bell} className="size-4 text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground">
                    Test Error Reporting
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Kirim error ke Sentry untuk testing
                  </Text>
                </View>
                <Icon
                  as={ChevronRight}
                  className="size-5 text-muted-foreground"
                />
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Logout Section */}
        <View className="px-6 mb-3">
          <Card className="p-4 bg-card border-border">
            <Text className="text-lg font-semibold mb-3 text-foreground">
              Akun
            </Text>

            <Button size="default" variant="destructive" onPress={handleLogout}>
              <View className="flex-row items-center">
                <Icon
                  as={LogOut}
                  className="size-5 mr-2 text-destructive-foreground"
                />
                <Text className="font-medium">Keluar dari Akun</Text>
              </View>
            </Button>
          </Card>
        </View>

        {/* App Info Section */}
        <View className="px-6">
          <Card className="p-4 bg-card border-border">
            <Text className="text-lg font-semibold mb-3 text-foreground">
              Informasi Aplikasi
            </Text>

            <View className="space-y-3">
              <View>
                <Text className="text-sm font-medium text-muted-foreground">
                  Versi Aplikasi
                </Text>
                <Text className="text-base text-foreground">
                  Version 1.6.2-internal.1
                </Text>
              </View>

              <View className="pt-3 border-t border-border">
                <Text className="text-sm text-muted-foreground">
                  © 2025 Skanida Apps
                </Text>
                <Text className="text-sm text-muted-foreground">
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
