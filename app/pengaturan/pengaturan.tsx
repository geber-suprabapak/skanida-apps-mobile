// app/pengaturan/pengaturan.tsx
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";

import { Button } from "~/components/ui/button"; // Use the new button
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

export default function Pengaturan() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);

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

  // Section Components untuk reusable UI
  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      className={`text-sm font-medium mb-4 ${
        isDarkMode ? "text-white" : "text-muted-foreground"
      }`}
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
          ? `border-b ${isDarkMode ? "border-gray-700" : "border-border"}`
          : ""
      }`}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View
        className={`w-9 h-9 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-accent"} justify-center items-center mr-3`}
      >
        {icon}
      </View>
      <View className="flex-1">
        {/* Pastikan title selalu dibungkus <Text> */}
        <Text
          className={`text-base ${
            isDarkMode ? "text-white" : "text-card-foreground"
          }`}
        >
          {typeof title === "string" ? title : <>{title}</>}
        </Text>
        {/* Pastikan subtitle selalu dibungkus <Text> jika ada */}
        {subtitle && (
          <Text
            className={`text-xs mt-1 ${
              isDarkMode ? "text-gray-400" : "text-muted-foreground"
            }`}
          >
            {typeof subtitle === "string" ? subtitle : <>{subtitle}</>}
          </Text>
        )}
      </View>
      {/* Pastikan rightElement tidak string mentah */}
      {rightElement && typeof rightElement === "string" ? (
        <Text>{rightElement}</Text>
      ) : (
        rightElement
      )}
      {/* Icon panah kanan tetap aman */}
      {!rightElement && onPress && (
        <AntDesign
          name="right"
          size={16}
          color={isDarkMode ? "#fff" : "hsl(var(--muted-foreground))"}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Pengaturan",
          headerStyle: {
            backgroundColor: "hsl(var(--primary))",
          },
          headerTintColor: "hsl(var(--primary-foreground))",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
      <ScrollView
        className={`flex-1 pb-32 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
      >
        {/* Back Button dengan komponen Button reusable - Spasi dihapus*/}
        <Button
          variant="outline"
          size="default"
          className={`mx-5 mt-4 mb-2 ${isDarkMode ? "border-primary bg-gray-800" : ""}`}
          onPress={() => router.push("/Dashboard")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name="arrow-back-outline"
              size={20}
              color={isDarkMode ? "#fff" : "hsl(var(--primary))"}
              style={{ marginRight: 8 }}
            />
            <Text>Kembali ke Dashboard</Text>
          </View>
        </Button>

        {/* Profile Section - Ditambah Key */}
        <View
          key="profile-section" // <- Tambahkan key
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${
            isDarkMode ? "bg-gray-800" : "bg-card"
          }`}
        >
          <SectionHeader title="Profil" />
          <View
            className={`flex-row items-center mb-4 pb-4 border-b ${
              isDarkMode ? "border-gray-700" : "border-border"
            }`}
          >
            <View className="w-16 h-16 rounded-full bg-primary justify-center items-center mr-4">
              <Text className="text-2xl font-bold text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className={`text-lg font-bold ${
                  isDarkMode ? "text-white" : "text-card-foreground"
                }`}
              >
                {user?.email || "Pengguna"}
              </Text>
              <Text
                className={`text-sm mt-1 ${
                  isDarkMode ? "text-gray-400" : "text-muted-foreground"
                }`}
              >
                User ID: {user?.id?.substring(0, 8) || "Unknown"}
              </Text>
            </View>
          </View>

          <ListItem
            icon={
              <Ionicons
                name="person-outline"
                size={20}
                color={isDarkMode ? "#fff" : "hsl(var(--accent-foreground))"}
              />
            }
            title="Edit Profil"
            onPress={() => router.push("/profile/EditProfile")}
          />

          <ListItem
            icon={
              <Ionicons
                name="key-outline"
                size={20}
                color={isDarkMode ? "#fff" : "hsl(var(--accent-foreground))"}
              />
            }
            title="Ubah Password"
            onPress={() => router.push("/profile/ChangePassword")}
            showBorder={false}
          />
        </View>

        {/* Preferences Section - Ditambah Key */}
        <View
          key="preferences-section" // <- Tambahkan key
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${
            isDarkMode ? "bg-gray-800" : "bg-card"
          }`}
        >
          <SectionHeader title="Preferensi" />

          <ListItem
            icon={
              <Ionicons
                name={isDarkMode ? "moon" : "moon-outline"}
                size={20}
                color={isDarkMode ? "#fff" : "hsl(var(--accent-foreground))"}
              />
            }
            title="Mode Gelap"
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={setDarkMode}
                trackColor={{
                  false: "hsl(var(--muted))",
                  true: isDarkMode ? "#3b82f6" : "hsl(var(--primary))",
                }}
                thumbColor={isDarkMode ? "#fff" : "#f4f3f4"}
              />
            }
          />

          <ListItem
            icon={
              <Ionicons
                name="notifications-outline"
                size={20}
                color={isDarkMode ? "#fff" : "hsl(var(--accent-foreground))"}
              />
            }
            title="Notifikasi"
            onPress={() => {}}
            showBorder={false}
          />
        </View>

        {/* Account Section - Ditambah Key */}
        <View
          key="account-section" // <- Tambahkan key
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${
            isDarkMode ? "bg-gray-800" : "bg-card"
          }`}
        >
          <SectionHeader title="Akun" />

          <Button
            variant="destructive" // Keep variant for semantic meaning, but override styles
            size="default"
            onPress={handleLogout}
            // Apply fixed red background and remove conditional styling
            className="w-full rounded-lg py-3 bg-red-600" // Always use bg-red-600
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="log-out-outline"
                size={20}
                color="#fff" // Always use white color for icon
                style={{ marginRight: 8 }}
              />
              {/* Apply fixed white text color */}
              <Text className="text-white">Keluar</Text>
            </View>
          </Button>
        </View>

        {/* App Info Section - Ditambah Key */}
        <View
          key="appinfo-section" // <- Tambahkan key
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${
            isDarkMode ? "bg-gray-800" : "bg-card"
          }`}
        >
          <SectionHeader title="Informasi Aplikasi" />

          <View className="py-2">
            <Text
              className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              Versi Aplikasi
            </Text>
            <Text
              className={`mt-1 ${
                isDarkMode ? "text-white" : "text-card-foreground"
              }`}
            >
              0.3.0
            </Text>
          </View>

          <View className="py-2 mt-2">
            <Text
              className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              © 2025 Skanida Apps
            </Text>
            <Text
              className={`mt-1 ${
                isDarkMode ? "text-white" : "text-card-foreground"
              }`}
            >
              Semua hak dilindungi tuhan
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
