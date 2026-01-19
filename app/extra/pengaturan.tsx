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
  BackHandler,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";
import Constants from "expo-constants";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";
import { Card, CardContent } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  User,
  Key,
  CircleFadingArrowUp,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Settings,
  Shield,
  Smartphone,
} from "lucide-react-native";
import * as Updates from "expo-updates";
import { LinearGradient } from "expo-linear-gradient";

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
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
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

  // Simplified profile data fetching that always gets fresh data from server
  const fetchProfileDataAndUpdateState = useCallback(async () => {
    if (!user) {
      setProfileFullName("Pengguna Skanida");
      setProfileAvatarUrl(null);
      return;
    }

    try {
      // Set initial data from user metadata while fetching
      const initialName =
        user.user_metadata?.name || user.email || "Pengguna Skanida";
      const initialAvatar = user.user_metadata?.avatar_url || null;
      setProfileFullName(initialName);
      setProfileAvatarUrl(initialAvatar);

      // Always fetch fresh data from database
      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user?.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error(
          "Pengaturan: Error fetching from user_profiles:",
          profileError.message,
        );
      } else if (userProfile) {
        console.log("Pengaturan: Profile data found in database:", userProfile);

        // Always update with latest data from server
        const updatedName =
          userProfile.full_name ||
          user.user_metadata?.name ||
          user.email ||
          "Pengguna Skanida";
        const updatedAvatar =
          userProfile.avatar_url || user.user_metadata?.avatar_url || null;

        setProfileFullName(updatedName);
        setProfileAvatarUrl(updatedAvatar);
      }
    } catch (err) {
      console.error("Pengaturan: Unexpected error fetching profile:", err);
    }
  }, [user]);

  // Fetch fresh data whenever the screen is focused
  useEffect(() => {
    if (isFocused) {
      fetchProfileDataAndUpdateState();
    } else if (!user) {
      setProfileFullName("Pengguna Skanida");
      setProfileAvatarUrl(null);
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
      setTimeout(() => setCopiedId(false), 2000);
    }
  }, [user?.id]);

  // Toggle theme handler
  const toggleTheme = useCallback(() => {
    const newTheme = isDarkMode ? "light" : "dark";
    setIsDarkMode(!isDarkMode);
    setTheme(newTheme);
    colorScheme.set(newTheme);
  }, [isDarkMode, setTheme]);

  // Check update handler
  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          "Update Tersedia",
          "Update baru tersedia. Unduh dan restart aplikasi?",
          [
            { text: "Batal", style: "cancel" },
            {
              text: "Update",
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              },
            },
          ],
        );
      } else {
        Alert.alert("Tidak Ada Update", "Aplikasi sudah versi terbaru.");
      }
    } catch (error) {
      Alert.alert("Error", `Gagal cek update: ${error}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  // Effect to sync theme state with store
  useEffect(() => {
    setIsDarkMode(theme === "dark");
  }, [theme]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Premium Gradient Header */}
      <LinearGradient
        colors={["#3b82f6", "#2563eb", "#1d4ed8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="pb-8 pt-4 px-5"
      >
        {/* Top Bar */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <Icon as={ChevronLeft} className="size-6 text-white" />
          </TouchableOpacity>
          <View className="flex-1" />
        </View>

        {/* Header Content */}
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-2xl bg-white/20 items-center justify-center mr-4">
            <Icon as={Settings} className="size-7 text-white" />
          </View>
          <View>
            <Text className="text-white/70 text-sm">Kelola akun</Text>
            <Text className="text-white text-xl font-bold">Pengaturan</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Curved bottom effect */}
      <View className="h-4 -mt-4 bg-background rounded-t-3xl" />

      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Profile Card - Premium Design */}
        <View className="px-5 -mt-2">
          <Card className="p-0 overflow-hidden rounded-2xl border-0 shadow-lg bg-card">
            <View className="p-5">
              <View className="flex-row items-center">
                {/* Avatar */}
                {profileAvatarUrl ? (
                  <View className="relative">
                    <Image
                      source={{ uri: profileAvatarUrl }}
                      className="w-18 h-18 rounded-2xl"
                      style={{ width: 72, height: 72 }}
                    />
                    <View className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-card items-center justify-center">
                      <View className="w-2 h-2 rounded-full bg-white" />
                    </View>
                  </View>
                ) : (
                  <View className="relative">
                    <LinearGradient
                      colors={["#6366f1", "#4f46e5"]}
                      className="w-18 h-18 rounded-2xl items-center justify-center"
                      style={{ width: 72, height: 72 }}
                    >
                      <Text className="text-white text-2xl font-bold">
                        {(profileFullName || user?.email)
                          ?.charAt(0)
                          .toUpperCase() || "U"}
                      </Text>
                    </LinearGradient>
                    <View className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-card items-center justify-center">
                      <View className="w-2 h-2 rounded-full bg-white" />
                    </View>
                  </View>
                )}

                {/* User Info */}
                <View className="flex-1 ml-4">
                  <Text className="text-foreground font-bold text-lg">
                    {profileFullName ||
                      user?.email?.split("@")[0] ||
                      "Pengguna"}
                  </Text>
                  <Text className="text-muted-foreground text-sm mt-0.5">
                    {user?.email || "Tidak ada email"}
                  </Text>

                  {/* Copy ID Button */}
                  <TouchableOpacity
                    onPress={handleCopyId}
                    className={`self-start mt-2 px-3 py-1.5 rounded-xl flex-row items-center ${
                      copiedId ? "bg-green-500/10" : "bg-muted"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Icon
                      as={copiedId ? Shield : Shield}
                      className={`size-3 mr-1.5 ${copiedId ? "text-green-500" : "text-muted-foreground"}`}
                    />
                    <Text
                      className={`text-xs font-medium ${copiedId ? "text-green-500" : "text-muted-foreground"}`}
                    >
                      {copiedId
                        ? "ID Tersalin!"
                        : `${user?.id?.substring(0, 8) || "Unknown"}...`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Account Settings Section */}
        <View className="px-5 mt-5">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest font-medium mb-3 ml-1">
            Akun
          </Text>
          <Card className="p-0 overflow-hidden rounded-2xl border-0 shadow-lg bg-card">
            {/* Edit Profile */}
            <TouchableOpacity
              className="flex-row items-center p-4 border-b border-border/50"
              onPress={navigateToEditProfile}
              activeOpacity={0.7}
            >
              <View className="w-11 h-11 rounded-xl bg-blue-500/10 items-center justify-center mr-4">
                <Icon as={User} className="size-5 text-blue-500" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">
                  Edit Profil
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  Ubah nama dan foto profil
                </Text>
              </View>
              <Icon
                as={ChevronRight}
                className="size-5 text-muted-foreground"
              />
            </TouchableOpacity>

            {/* Change Password */}
            <TouchableOpacity
              className="flex-row items-center p-4"
              onPress={navigateToChangePassword}
              activeOpacity={0.7}
            >
              <View className="w-11 h-11 rounded-xl bg-amber-500/10 items-center justify-center mr-4">
                <Icon as={Key} className="size-5 text-amber-500" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">
                  Ubah Password
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  Perbarui kata sandi akun
                </Text>
              </View>
              <Icon
                as={ChevronRight}
                className="size-5 text-muted-foreground"
              />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Preferences Section */}
        <View className="px-5 mt-5">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest font-medium mb-3 ml-1">
            Preferensi
          </Text>
          <Card className="p-0 overflow-hidden rounded-2xl border-0 shadow-lg bg-card">
            {/* Dark Mode Toggle */}
            <View className="flex-row items-center p-4 border-b border-border/50">
              <View
                className={`w-11 h-11 rounded-xl items-center justify-center ${
                  isDarkMode ? "bg-purple-500/10" : "bg-yellow-500/10"
                }`}
              >
                <Icon
                  as={isDarkMode ? Moon : Sun}
                  className={`size-5 ${isDarkMode ? "text-purple-500" : "text-yellow-500"}`}
                />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-semibold">
                  Mode Gelap
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  {isDarkMode ? "Tema gelap aktif" : "Tema terang aktif"}
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: "#e5e7eb", true: "#6366f1" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Check Update */}
            <TouchableOpacity
              className="flex-row items-center p-4"
              onPress={handleCheckUpdate}
              disabled={isCheckingUpdate}
              activeOpacity={0.7}
            >
              <View className="w-11 h-11 rounded-xl bg-green-500/10 items-center justify-center mr-4">
                <Icon
                  as={CircleFadingArrowUp}
                  className="size-5 text-green-500"
                />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">
                  {isCheckingUpdate ? "Mengecek..." : "Cek Update"}
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  Periksa update terbaru
                </Text>
              </View>
              {isCheckingUpdate && (
                <View className="w-5 h-5 border-2 border-t-transparent border-primary rounded-full" />
              )}
            </TouchableOpacity>
          </Card>
        </View>

        {/* App Info Section */}
        <View className="px-5 mt-5">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest font-medium mb-3 ml-1">
            Tentang
          </Text>
          <Card className="p-0 overflow-hidden rounded-2xl border-0 shadow-lg bg-card">
            <View className="flex-row items-center p-4">
              <View className="w-11 h-11 rounded-xl bg-indigo-500/10 items-center justify-center mr-4">
                <Icon as={Smartphone} className="size-5 text-indigo-500" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">
                  Versi Aplikasi
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  Skanida v{Constants.expoConfig?.version}
                </Text>
              </View>
              <View className="px-3 py-1.5 rounded-xl bg-indigo-500/10">
                <Text className="text-xs font-bold text-indigo-500">
                  Terbaru
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Logout Button */}
        <View className="px-5 mt-6">
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.9}
            className="overflow-hidden rounded-2xl"
          >
            <LinearGradient
              colors={["#ef4444", "#dc2626", "#b91c1c"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-4 flex-row items-center justify-center rounded-2xl"
            >
              <Icon as={LogOut} className="size-5 text-white mr-3" />
              <Text className="font-bold text-white text-base">
                Keluar dari Akun
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="items-center mt-8 px-5">
          <Text className="text-muted-foreground text-xs">
            © 2025 Skanida Apps
          </Text>
          <Text className="text-muted-foreground/50 text-xs mt-1">
            Semua hak dilindungi undang-undang
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Export the memoized component for better performance
export default memo(Pengaturan);
