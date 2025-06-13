// app/pengaturan/pengaturan.tsx
import { useIsFocused } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function Pengaturan() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const isFocused = useIsFocused();

  const { isDarkColorScheme, setColorScheme } = useColorScheme();
  // Color Scheme Toggle
  function toggleColorScheme(): void {
    const newTheme: "light" | "dark" = isDarkColorScheme ? "light" : "dark";
    setColorScheme(newTheme);
  }

  const [profileFullName, setProfileFullName] = useState(
    user?.user_metadata?.name || user?.email || "Pengguna Skanida",
  );
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(
    user?.user_metadata?.avatar_url || null,
  );

  useEffect(() => {
    const fetchProfileDataAndUpdateState = async () => {
      if (!user) {
        setProfileFullName("Pengguna Skanida");
        setProfileAvatarUrl(null);
        return;
      }

      let currentName =
        user.user_metadata?.name || user.email || "Pengguna Skanida";
      let currentAvatar = user.user_metadata?.avatar_url || null;

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
          currentName = userProfile.full_name || currentName;
          currentAvatar = userProfile.avatar_url || currentAvatar;
        }
      } catch (err) {
        console.error("Pengaturan: Unexpected error fetching profile:", err);
      }
      setProfileFullName(currentName);
      setProfileAvatarUrl(currentAvatar);
    };

    if (isFocused && user) {
      fetchProfileDataAndUpdateState();
    } else if (!user) {
      setProfileFullName("Pengguna Skanida");
      setProfileAvatarUrl(null);
    }
  }, [user, isFocused]);

  const handleLogout = async () => {
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
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      className={`text-sm font-medium mb-4 ${isDarkColorScheme ? "text-white" : "text-muted-foreground"}`}
    >
      {title}
    </Text>
  );

  const ListItem = ({
    icon,
    title,
    subtitle,
    rightElement,
    onPress,
    showBorder = true,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
    showBorder?: boolean;
  }) => (
    <TouchableOpacity
      className={`flex-row items-center py-3 ${
        showBorder
          ? `border-b ${isDarkColorScheme ? "border-gray-700" : "border-border"}`
          : ""
      }`}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View
        className={`w-9 h-9 rounded-lg ${isDarkColorScheme ? "bg-gray-700" : "bg-accent"} justify-center items-center mr-3`}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className={`text-base ${
            isDarkColorScheme ? "text-white" : "text-card-foreground"
          }`}
        >
          {typeof title === "string" ? title : <>{title}</>}
        </Text>
        {subtitle && (
          <Text
            className={`text-xs mt-1 ${
              isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
            }`}
          >
            {typeof subtitle === "string" ? subtitle : <>{subtitle}</>}
          </Text>
        )}
      </View>
      {rightElement && typeof rightElement === "string" ? (
        <Text>{rightElement}</Text>
      ) : (
        rightElement
      )}
      {!rightElement && onPress && <ChevronRight size={16} color="#000" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View
        className={`flex-row items-center p-4 border-b ${isDarkColorScheme ? "border-gray-700 bg-gray-900" : "border-border bg-background"}`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text
          className={`text-lg font-bold ${isDarkColorScheme ? "text-white" : "text-foreground"}`}
        >
          Pengaturan
        </Text>
      </View>

      <ScrollView
        className={`flex-1 pb-32 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
      >
        <View
          key="profile-section"
          className={`rounded-xl mx-5 mt-4 mb-5 p-5 shadow-sm ${isDarkColorScheme ? "bg-gray-800" : "bg-card"}`}
        >
          <SectionHeader title="Profil" />
          <View
            className={`flex-row items-center mb-4 pb-4 border-b ${
              isDarkColorScheme ? "border-gray-700" : "border-border"
            }`}
          >
            {profileAvatarUrl ? (
              <Image
                source={{ uri: profileAvatarUrl }}
                className="w-16 h-16 rounded-full mr-4"
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-primary justify-center items-center mr-4">
                <Text className="text-2xl font-bold text-primary-foreground">
                  {(profileFullName || user?.email)?.charAt(0).toUpperCase() ||
                    "U"}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text
                className={`text-lg font-bold ${
                  isDarkColorScheme ? "text-white" : "text-card-foreground"
                }`}
              >
                Hey,{" "}
                {profileFullName || user?.email?.split("@")[0] || "Pengguna"}!
              </Text>
              <Text
                className={`text-sm mt-1 ${
                  isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
                }`}
              >
                {user?.email || "Tidak ada email"}
              </Text>
              <Text
                className={`text-xs mt-1 ${
                  isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
                }`}
              >
                User ID: {user?.id?.substring(0, 8) || "Unknown"}
              </Text>
            </View>
          </View>

          <ListItem
            icon={<User size={20} color="#000" />}
            title="Edit Profil"
            onPress={() => router.push("/profile/EditProfile")}
          />

          <ListItem
            icon={<Key size={20} color="#000" />}
            title="Ubah Password"
            onPress={() => router.push("/profile/ChangePassword")}
            showBorder={false}
          />
        </View>

        <View
          key="preferences-section"
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkColorScheme ? "bg-gray-800" : "bg-card"}`}
        >
          <SectionHeader title="Preferensi" />
          {/* DarkMode Handler */}
          <ListItem
            icon={<Moon size={20} color="#000" />}
            title="Mode Gelap"
            rightElement={
              <Switch
                value={isDarkColorScheme}
                onValueChange={toggleColorScheme}
                trackColor={{
                  false: "hsl(var(--muted))",
                  true: isDarkColorScheme ? "#3b82f6" : "hsl(var(--primary))",
                }}
                thumbColor={isDarkColorScheme ? "#fff" : "#f4f3f4"}
              />
            }
          />

          <ListItem
            icon={<Bell size={20} color="#000" />}
            title="Notifikasi"
            onPress={() => {}}
            showBorder={false}
          />
        </View>

        <View
          key="account-section"
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkColorScheme ? "bg-gray-800" : "bg-card"}`}
        >
          <SectionHeader title="Akun" />

          <Button
            size="default"
            onPress={handleLogout}
            className="w-full rounded-lg py-3 bg-red-600"
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <LogOut size={20} color="#000" style={{ marginRight: 8 }} />
              <Text className="text-white">Keluar</Text>
            </View>
          </Button>
        </View>

        <View
          key="appinfo-section"
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkColorScheme ? "bg-gray-800" : "bg-card"}`}
        >
          <SectionHeader title="Informasi Aplikasi" />

          <View className="py-2">
            <Text
              className={`text-sm ${
                isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              Versi Aplikasi
            </Text>
            <Text
              className={`mt-1 ${
                isDarkColorScheme ? "text-white" : "text-card-foreground"
              }`}
            >
              0.4.0
            </Text>
          </View>

          <View className="py-2 mt-2">
            <Text
              className={`text-sm ${
                isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              © 2025 Skanida Apps
            </Text>
            <Text
              className={`mt-1 ${
                isDarkColorScheme ? "text-white" : "text-card-foreground"
              }`}
            >
              Semua hak dilindungi tuhan
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
