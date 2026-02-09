import { useIsFocused } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
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
import * as Updates from "expo-updates";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";
import { getAvatarSignedUrl } from "~/utils/avatar";
import { Card } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  CircleFadingArrowUp,
  LogOut,
  Moon,
  Sun,
  Shield,
  Smartphone,
  Pencil,
  Bell,
  BellOff,
} from "lucide-react-native";
import {
  getNotificationPermissionStatus,
  registerAndSaveNotificationToken,
  clearNotificationToken,
  openNotificationSettings,
} from "~/utils/notifications";

function Pengaturan() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const isFocused = useIsFocused();
  const { theme, setTheme } = useThemeStore();

  const initialProfile = useMemo(
    () => ({
      name: user?.user_metadata?.name || user?.email || "Pengguna Skanida",
      avatar: user?.user_metadata?.avatar_url || null,
    }),
    [user?.user_metadata?.name, user?.email, user?.user_metadata?.avatar_url],
  );

  const [profileName, setProfileName] = useState(initialProfile.name);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(
    initialProfile.avatar,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(theme === "dark");
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifCanAsk, setNotifCanAsk] = useState(true);
  const [notifLoading, setNotifLoading] = useState(true);

  // Hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [router]);

  // Avatar URL resolution
  useEffect(() => {
    if (!profileAvatar) {
      setAvatarUrl(null);
      return;
    }
    let active = true;
    getAvatarSignedUrl(profileAvatar)
      .then((url) => active && setAvatarUrl(url))
      .catch(() => active && setAvatarUrl(profileAvatar));
    return () => {
      active = false;
    };
  }, [profileAvatar]);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfileName("Pengguna Skanida");
      setProfileAvatar(null);
      return;
    }
    setProfileName(
      user.user_metadata?.name || user.email || "Pengguna Skanida",
    );
    setProfileAvatar(user.user_metadata?.avatar_url || null);

    const { data, error } = await supabase
      .from("user_profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      setProfileName(
        data.full_name ||
          user.user_metadata?.name ||
          user.email ||
          "Pengguna Skanida",
      );
      setProfileAvatar(data.avatar_url || user.user_metadata?.avatar_url);
    }
  }, [user]);

  useEffect(() => {
    if (isFocused) fetchProfile();
  }, [isFocused, fetchProfile]);

  // Theme sync
  useEffect(() => setIsDarkMode(theme === "dark"), [theme]);

  // Notification status check
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      setNotifLoading(true);
      try {
        const s = await getNotificationPermissionStatus();
        setNotifEnabled(s.isGranted);
        setNotifCanAsk(s.canAskAgain);
      } finally {
        setNotifLoading(false);
      }
    })();
  }, [isFocused]);

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
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
            Alert.alert("Error", "Gagal melakukan logout. Silakan coba lagi.");
          }
        },
      },
    ]);
  }, [setUser, router]);

  const handleCopyId = useCallback(() => {
    if (user?.id) {
      Clipboard.setString(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }, [user?.id]);

  const toggleTheme = useCallback(() => {
    const next = isDarkMode ? "light" : "dark";
    setIsDarkMode(!isDarkMode);
    setTheme(next);
    colorScheme.set(next);
  }, [isDarkMode, setTheme]);

  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert("Update Tersedia", "Unduh dan restart aplikasi?", [
          { text: "Batal", style: "cancel" },
          {
            text: "Update",
            onPress: async () => {
              await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            },
          },
        ]);
      } else {
        Alert.alert("Tidak Ada Update", "Aplikasi sudah versi terbaru.");
      }
    } catch (error) {
      Alert.alert("Error", `Gagal cek update: ${error}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const handleNotifToggle = useCallback(async () => {
    if (!user?.id) return;

    if (notifEnabled) {
      setNotifLoading(true);
      try {
        const success = await clearNotificationToken(user.id);
        if (success) {
          setNotifEnabled(false);
        } else {
          Alert.alert(
            "Error",
            "Gagal menonaktifkan notifikasi. Silakan coba lagi.",
          );
        }
      } finally {
        setNotifLoading(false);
      }
      return;
    }

    if (!notifCanAsk) {
      openNotificationSettings();
      return;
    }

    setNotifLoading(true);
    try {
      const r = await registerAndSaveNotificationToken(user.id, false);
      setNotifEnabled(r.success);
      setNotifCanAsk(r.canAskAgain);
      if (r.permissionDenied && !r.canAskAgain) {
        Alert.alert(
          "Izin Notifikasi",
          "Izin ditolak permanen. Buka pengaturan perangkat.",
          [
            { text: "Batal", style: "cancel" },
            { text: "Buka Pengaturan", onPress: openNotificationSettings },
          ],
        );
      }
    } finally {
      setNotifLoading(false);
    }
  }, [user?.id, notifEnabled, notifCanAsk]);

  const getNotifSubtitle = () => {
    if (notifLoading) return "Memuat...";
    if (notifEnabled) return "Notifikasi aktif";
    if (!notifCanAsk) return "Tap untuk buka Pengaturan HP";
    return "Notifikasi nonaktif";
  };

  const EditButton = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-2 border-card items-center justify-center shadow-sm"
    >
      <Icon as={Pencil} className="size-4 text-white" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center border border-gray-100 dark:border-gray-700"
        >
          <Icon
            as={ChevronLeft}
            className="size-6 text-gray-900 dark:text-gray-100"
          />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Pengaturan
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Profile Card */}
        <View className="px-5 mt-4">
          <Card className="p-0 overflow-hidden rounded-2xl border-0 shadow-lg bg-card">
            <View className="p-5 flex-row items-center">
              <View className="relative">
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{ width: 72, height: 72 }}
                    className="rounded-2xl"
                  />
                ) : (
                  <View
                    className="rounded-2xl items-center justify-center bg-indigo-500"
                    style={{ width: 72, height: 72 }}
                  >
                    <Text className="text-white text-2xl font-bold">
                      {(profileName || user?.email)?.charAt(0).toUpperCase() ||
                        "U"}
                    </Text>
                  </View>
                )}
                <EditButton
                  onPress={() => router.push("/profile/ManageAccount")}
                />
              </View>

              <View className="flex-1 ml-4">
                <Text className="text-foreground font-bold text-lg">
                  {profileName || user?.email?.split("@")[0] || "Pengguna"}
                </Text>
                <Text className="text-muted-foreground text-sm mt-0.5">
                  {user?.email || "Tidak ada email"}
                </Text>
                <TouchableOpacity
                  onPress={handleCopyId}
                  className={`self-start mt-2 px-3 py-1.5 rounded-xl flex-row items-center ${copiedId ? "bg-green-500/10" : "bg-muted"}`}
                  activeOpacity={0.7}
                >
                  <Icon
                    as={Shield}
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
          </Card>
        </View>

        {/* Preferences */}
        <View className="px-5 mt-5">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest font-medium mb-3 ml-1">
            Preferensi
          </Text>
          <Card className="p-0 overflow-hidden rounded-2xl border-0 shadow-lg bg-card">
            {/* Dark Mode */}
            <View className="flex-row items-center p-4 border-b border-border/50">
              <View
                className={`w-11 h-11 rounded-xl items-center justify-center ${isDarkMode ? "bg-purple-500/10" : "bg-yellow-500/10"}`}
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

            {/* Notification */}
            <TouchableOpacity
              className="flex-row items-center p-4 border-b border-border/50"
              onPress={handleNotifToggle}
              disabled={notifLoading}
              activeOpacity={0.7}
            >
              <View
                className={`w-11 h-11 rounded-xl items-center justify-center ${notifEnabled ? "bg-blue-500/10" : "bg-gray-500/10"}`}
              >
                <Icon
                  as={notifEnabled ? Bell : BellOff}
                  className={`size-5 ${notifEnabled ? "text-blue-500" : "text-gray-500"}`}
                />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-semibold">
                  Notifikasi
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  {getNotifSubtitle()}
                </Text>
              </View>
              {notifLoading ? (
                <View className="w-5 h-5 border-2 border-t-transparent border-primary rounded-full" />
              ) : (
                <Switch
                  value={notifEnabled}
                  onValueChange={handleNotifToggle}
                  trackColor={{ false: "#e5e7eb", true: "#3b82f6" }}
                  thumbColor="#ffffff"
                  disabled={notifLoading}
                />
              )}
            </TouchableOpacity>

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

        {/* App Info */}
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
            </View>
          </Card>
        </View>

        {/* Logout */}
        <View className="px-5 mt-6">
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.9}
            className="py-4 flex-row items-center justify-center rounded-2xl bg-red-600"
          >
            <Icon as={LogOut} className="size-5 text-white mr-3" />
            <Text className="font-bold text-white text-base">
              Keluar dari Akun
            </Text>
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

export default memo(Pengaturan);
