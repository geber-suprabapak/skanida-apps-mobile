import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  Switch,
} from "react-native";
import { Image } from "expo-image";

void Image;
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Text } from "~/components/ui/text";
import { Avatar } from "~/components/ui/avatar";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { getProfile } from "~/utils/bffMobileApi";
import { faceApiLog } from "~/utils/faceApiDebug";
import { Card } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import {
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
import { useNotificationSettings } from "~/hooks/useNotificationSettings";
import { useUniwind } from "uniwind";

function Pengaturan() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const { setTheme } = useThemeStore();
  const { theme } = useUniwind();
  const isDark = theme === "dark";

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
  const [studentNis, setStudentNis] = useState<string>(
    user?.user_metadata?.nis || "",
  );
  const [copiedId, setCopiedId] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const notif = useNotificationSettings(user?.id);

  // Hardware back button
  useFocusEffect(
    useCallback(() => {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        return false;
      });
      return () => handler.remove();
    }, [router]),
  );

  useEffect(() => {
    if (!profileAvatar) {
      setAvatarUrl(null);
      return;
    }
    setAvatarUrl(profileAvatar);
  }, [profileAvatar]);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfileName("Pengguna Skanida");
      setProfileAvatar(null);
      setStudentNis("");
      return;
    }
    setProfileName(
      user.user_metadata?.name || user.email || "Pengguna Skanida",
    );
    setProfileAvatar(user.user_metadata?.avatar_url || null);
    setStudentNis(user.user_metadata?.nis || "");

    try {
      const data = await getProfile();
      setProfileName(
        data.full_name ||
          user.user_metadata?.name ||
          user.email ||
          "Pengguna Skanida",
      );
      setProfileAvatar(
        data.avatar_url || user.user_metadata?.avatar_url || null,
      );
      if (data.nis) {
        setStudentNis(data.nis);
      }
    } catch (error) {
      if (__DEV__) console.error("Error fetching settings profile:", error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const refreshFocusedData = async () => {
        await fetchProfile();
        if (!isActive) return;
        await notif.refresh();
      };

      refreshFocusedData();

      return () => {
        isActive = false;
      };
    }, [fetchProfile, notif.refresh]),
  );

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Ya, Keluar",
        style: "destructive",
        onPress: async () => {
          try {
            await useAuthStore.getState().logout();
            await AsyncStorage.clear();
            router.replace("/auth/AuthSelector");
          } catch (error) {
            if (__DEV__) console.error("Logout error:", error);
            Alert.alert("Error", "Gagal melakukan logout. Silakan coba lagi.");
          }
        },
      },
    ]);
  }, [setUser, router]);

  const handleCopyId = useCallback(async () => {
    const val = studentNis || user?.id;
    if (val) {
      await Clipboard.setStringAsync(val);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }, [studentNis, user?.id]);

  const toggleTheme = useCallback(() => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
  }, [isDark, setTheme]);

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
    } catch {
      Alert.alert("Gagal", "Gagal memeriksa pembaruan.");
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const EditButton = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Ubah foto profil"
      accessibilityHint="Ketuk dua kali untuk mengedit foto profil"
      activeOpacity={0.8}
      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-2 border-card items-center justify-center shadow-sm"
    >
      <Icon as={Pencil} className="size-4 text-white" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="px-6 py-4 border-b border-border">
        <Text className="text-xl font-bold text-foreground">Pengaturan</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 32,
          width: "100%",
          maxWidth: 672,
          alignSelf: "center",
        }}
      >
        {/* Profile Card */}
        <View className="px-5 mt-4">
          <Card className="p-0 overflow-hidden rounded-2xl border-0 shadow-lg bg-card">
            <View className="p-5 flex-row items-center">
              <View className="relative">
                <Avatar
                  size="lg"
                  fallback={(profileName || user?.email)?.charAt(0).toUpperCase() || "S"}
                  className="w-20 h-20"
                  source={avatarUrl ?? undefined}
                />
                <EditButton
                  onPress={() => {
                    faceApiLog("settings-page:navigate-manage-account", {
                      userId: user?.id ?? null,
                      email: user?.email ?? null,
                    });
                    router.push("/profile/ManageAccount");
                  }}
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
                  disabled={!studentNis}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Salin NIS Siswa"
                  accessibilityHint="Ketuk dua kali untuk menyalin NIS siswa ke papan klip"
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
                      ? "NIS Tersalin!"
                      : studentNis
                        ? `NIS: ${studentNis}`
                        : "NIS Belum Terdaftar"}
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
                className={`w-11 h-11 rounded-xl items-center justify-center ${isDark ? "bg-purple-500/10" : "bg-yellow-500/10"}`}
              >
                <Icon
                  as={isDark ? Moon : Sun}
                  className={`size-5 ${isDark ? "text-purple-500" : "text-yellow-500"}`}
                />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-semibold">
                  Mode Gelap
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  {isDark ? "Tema gelap aktif" : "Tema terang aktif"}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                accessibilityRole="switch"
                accessibilityLabel="Mode Gelap"
                accessibilityState={{ checked: isDark }}
                trackColor={{ false: "#e5e7eb", true: "#6366f1" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Notification */}
            <TouchableOpacity
              className="flex-row items-center p-4 border-b border-border/50"
              onPress={notif.toggle}
              disabled={notif.isLoading}
              activeOpacity={0.7}
            >
              <View
                className={`w-11 h-11 rounded-xl items-center justify-center ${notif.isEnabled ? "bg-primary/10" : "bg-muted"}`}
              >
                <Icon
                  as={notif.isEnabled ? Bell : BellOff}
                  className={`size-5 ${notif.isEnabled ? "text-primary" : "text-muted-foreground"}`}
                />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-semibold">
                  Notifikasi
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  {notif.subtitle}
                </Text>
              </View>
              {notif.isLoading ? (
                <View className="w-5 h-5 border-2 border-t-transparent border-primary rounded-full" />
              ) : (
                <Switch
                  value={notif.isEnabled}
                  onValueChange={notif.toggle}
                  trackColor={{ false: "#e5e7eb", true: "#3b82f6" }}
                  thumbColor="#ffffff"
                  disabled={notif.isLoading}
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
        {Boolean(user) && (
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
        )}

        {/* Footer */}
        <View className="items-center mt-8 px-5">
          <Text className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} Skanida Apps
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
