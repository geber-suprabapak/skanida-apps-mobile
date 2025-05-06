import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import React, { useState } from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

export default function EditProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();

  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name) {
      Alert.alert("Error", "Nama tidak boleh kosong");
      return;
    }
    setLoading(true);
    try {
      // Update profile di Supabase
      const { error } = await supabase.auth.updateUser({
        data: { name, phone },
      });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      // Ambil ulang user terbaru dari Supabase
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "Gagal mengambil data user terbaru");
        return;
      }
      setUser(userData.user);
      Alert.alert("Sukses", "Profil berhasil diperbarui", [
        { text: "OK", onPress: () => router.back() },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      Alert.alert("Error", "Gagal memperbarui profil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false, // Hide the default header
        }}
      />

      {/* Custom Header */}
      <View
        className={`flex-row items-center p-4 border-b ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-border bg-background"}`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons
            name="arrow-back-outline"
            size={24}
            color={isDarkMode ? "#fff" : "hsl(var(--foreground))"}
          />
        </TouchableOpacity>
        <Text
          className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-foreground"}`}
        >
          Edit Profil
        </Text>
      </View>

      <ScrollView
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
        contentContainerClassName="p-6"
      >
        <View
          className={`rounded-xl p-5 shadow-sm mb-4 ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
        >
          <View className="mb-4">
            <Text
              className={`mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              Nama
            </Text>
            <Input
              placeholder="Nama lengkap"
              value={name}
              onChangeText={setName}
              className={
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                  : ""
              }
            />
          </View>
          <View className="mb-6">
            <Text
              className={`mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              No. Telepon
            </Text>
            <Input
              placeholder="Nomor telepon"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              className={
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                  : ""
              }
            />
          </View>
        </View>

        <View
          className={`rounded-xl p-5 shadow-sm ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
        >
          <Button
            variant="default"
            size="lg"
            disabled={loading}
            onPress={handleSave}
            className={`mb-4 w-full ${isDarkMode ? "bg-white" : "bg-black"}`}
          >
            {loading ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator
                  size="small"
                  color={isDarkMode ? "#000" : "#fff"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={
                    isDarkMode
                      ? "text-black font-medium"
                      : "text-white font-medium"
                  }
                >
                  Sedang menyimpan...
                </Text>
              </View>
            ) : (
              <Text
                className={
                  isDarkMode
                    ? "text-black font-medium"
                    : "text-white font-medium"
                }
              >
                Simpan
              </Text>
            )}
          </Button>
          <Button
            size="default"
            onPress={() => router.back()}
            disabled={loading}
            className="w-full rounded-lg py-3 bg-red-600"
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text className="text-white">Batal</Text>
            </View>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
