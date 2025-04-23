// app/pengaturan/pengaturan.tsx
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";

import { Button } from "~/components/Button";
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
        className={`flex-1 pb-32 ${isDarkMode ? "dark:bg-background" : "bg-background"}`}
      >
        {/* Back Button at the top of content area */}
        <TouchableOpacity
          className={`flex-row items-center mx-5 mt-4 mb-2 p-3 rounded-lg ${isDarkMode ? "bg-card" : "bg-card"}`}
          onPress={() => router.push("/Dashboard")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back-outline"
            size={24}
            color={isDarkMode ? "#C0DAFF" : "#0066FF"}
          />
          <Text
            className={`ml-2 text-base font-medium ${isDarkMode ? "text-white" : "text-card-foreground"}`}
          >
            Kembali ke Dashboard
          </Text>
        </TouchableOpacity>

        {/* Profile Section */}
        <View
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
        >
          <Text
            className={`text-sm font-medium mb-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
          >
            Profil
          </Text>
          <View className="flex-row items-center mb-4 pb-4 border-b border-border">
            <View className="w-16 h-16 rounded-full bg-primary justify-center items-center mr-4">
              <Text className="text-2xl font-bold text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-card-foreground"}`}
              >
                {user?.email || "Pengguna"}
              </Text>
              <Text
                className={`text-sm mt-1 ${isDarkMode ? "text-gray-300" : "text-muted-foreground"}`}
              >
                User ID: {user?.id?.substring(0, 8) || "Unknown"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            className="flex-row items-center py-3 border-b border-border"
            onPress={() => router.push("/profile/EditProfile")}
          >
            <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
              <Ionicons
                name="person-outline"
                size={20}
                color="hsl(var(--accent-foreground))"
              />
            </View>
            <Text
              className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
            >
              Edit Profil
            </Text>
            <AntDesign
              name="right"
              size={16}
              color="hsl(var(--muted-foreground))"
              className="ml-2"
            />
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center py-3"
            onPress={() => router.push("/profile/ChangePassword")}
          >
            <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
              <Ionicons
                name="key-outline"
                size={20}
                color="hsl(var(--accent-foreground))"
              />
            </View>
            <Text
              className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
            >
              Ubah Password
            </Text>
            <AntDesign
              name="right"
              size={16}
              color="hsl(var(--muted-foreground))"
              className="ml-2"
            />
          </TouchableOpacity>
        </View>
        {/* Preferences Section */}
        <View
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
        >
          <Text
            className={`text-sm font-medium mb-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
          >
            Preferensi
          </Text>
          <View className="flex-row items-center py-3 border-b border-border">
            <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
              <Ionicons
                name={isDarkMode ? "moon" : "moon-outline"}
                size={20}
                color="hsl(var(--accent-foreground))"
              />
            </View>
            <Text
              className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
            >
              Mode Gelap
            </Text>
            <Switch
              value={isDarkMode}
              onValueChange={setDarkMode}
              trackColor={{
                false: "hsl(var(--muted))",
                true: "hsl(var(--primary))",
              }}
              thumbColor={
                isDarkMode ? "hsl(var(--primary-foreground))" : "#f4f3f4"
              }
            />
          </View>
          <TouchableOpacity className="flex-row items-center py-3">
            <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
              <Ionicons
                name="notifications-outline"
                size={20}
                color="hsl(var(--accent-foreground))"
              />
            </View>
            <Text
              className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
            >
              Notifikasi
            </Text>
            <AntDesign
              name="right"
              size={16}
              color="hsl(var(--muted-foreground))"
              className="ml-2"
            />
          </TouchableOpacity>
        </View>
        {/* Account Section */}
        <View
          className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
        >
          <Text
            className={`text-sm font-medium mb-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
          >
            Akun
          </Text>
          <Button
            variant="danger"
            size="medium"
            onPress={handleLogout}
            className="w-full rounded-lg py-3 bg-destructive/10"
            leftIcon={
              <Ionicons
                name="log-out-outline"
                size={24}
                color="hsl(var(--destructive))"
              />
            }
          >
            Keluar
          </Button>
        </View>
      </ScrollView>
    </>
  );
}
