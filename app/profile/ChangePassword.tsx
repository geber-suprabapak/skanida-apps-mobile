import { useRouter, Stack } from "expo-router";
import React, { useState } from "react";
import {
  View,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { supabase } from "~/utils/supabase";
import { useColorScheme } from "~/lib/useColorScheme";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Key } from "~/lib/icons/Key";
import { Eye } from "~/lib/icons/Eye";
import { EyeOff } from "~/lib/icons/EyeOff";

export default function ChangePassword() {
  const router = useRouter();
  const { isDarkColorScheme } = useColorScheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Semua kolom harus diisi");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Konfirmasi password tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password baru minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      // Re-authenticate user
      const session = await supabase.auth.getSession();
      const email = session.data.session?.user.email;
      if (!email) throw new Error("Session tidak valid");
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (loginError) {
        Alert.alert("Error", "Password lama salah");
        setLoading(false);
        return;
      }
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }
      Alert.alert("Sukses", "Password berhasil diubah", [
        { text: "OK", onPress: () => router.back() },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      Alert.alert("Error", "Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      {/* Custom Header */}
      <View
        className={`flex-row items-center p-4 border-b ${
          isDarkColorScheme 
            ? "border-gray-700 bg-gray-900" 
            : "border-border bg-background"
        }`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft 
            size={24} 
            color={isDarkColorScheme ? "#ffffff" : "#000000"} 
          />
        </TouchableOpacity>
        <Text
          className={`text-lg font-bold ${
            isDarkColorScheme ? "text-white" : "text-foreground"
          }`}
        >
          Ubah Password
        </Text>
      </View>

      <ScrollView 
        className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View
          className={`rounded-xl p-5 shadow-sm ${
            isDarkColorScheme ? "bg-gray-800" : "bg-card"
          }`}
        >
          {/* Header Icon */}
          <View className="items-center mb-6">
            <View
              className={`w-16 h-16 rounded-full ${
                isDarkColorScheme ? "bg-gray-700" : "bg-accent"
              } justify-center items-center mb-3`}
            >
              <Key 
                size={32} 
                color={isDarkColorScheme ? "#ffffff" : "#000000"} 
              />
            </View>
            <Text
              className={`text-xl font-bold text-center ${
                isDarkColorScheme ? "text-white" : "text-card-foreground"
              }`}
            >
              Keamanan Akun
            </Text>
            <Text
              className={`text-sm text-center mt-1 ${
                isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              Pastikan password baru Anda aman dan mudah diingat
            </Text>
          </View>

          {/* Form Fields */}
          <View className="space-y-4">
            {/* Current Password */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDarkColorScheme ? "text-white" : "text-card-foreground"
                }`}
              >
                Password Lama
              </Text>
              <View className="flex-row items-center border rounded-lg px-4 py-3">
                <TextInput
                  className={`flex-1 text-base ${
                    isDarkColorScheme 
                      ? "bg-gray-700 text-white placeholder:text-gray-400" 
                      : "bg-background text-foreground placeholder:text-muted-foreground"
                  }`}
                  placeholder="Masukkan password lama"
                  placeholderTextColor={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                  {showCurrentPassword ? (
                    <EyeOff size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
                  ) : (
                    <Eye size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDarkColorScheme ? "text-white" : "text-card-foreground"
                }`}
              >
                Password Baru
              </Text>
              <View className="flex-row items-center border rounded-lg px-4 py-3">
                <TextInput
                  className={`flex-1 text-base ${
                    isDarkColorScheme 
                      ? "bg-gray-700 text-white placeholder:text-gray-400" 
                      : "bg-background text-foreground placeholder:text-muted-foreground"
                  }`}
                  placeholder="Masukkan password baru"
                  placeholderTextColor={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? (
                    <EyeOff size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
                  ) : (
                    <Eye size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
                  )}
                </TouchableOpacity>
              </View>
              <Text
                className={`text-xs mt-1 ${
                  isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
                }`}
              >
                Minimal 6 karakter
              </Text>
            </View>

            {/* Confirm Password */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDarkColorScheme ? "text-white" : "text-card-foreground"
                }`}
              >
                Konfirmasi Password Baru
              </Text>
              <View className="flex-row items-center border rounded-lg px-4 py-3">
                <TextInput
                  className={`flex-1 text-base ${
                    isDarkColorScheme 
                      ? "bg-gray-700 text-white placeholder:text-gray-400" 
                      : "bg-background text-foreground placeholder:text-muted-foreground"
                  }`}
                  placeholder="Ulangi password baru"
                  placeholderTextColor={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
                  ) : (
                    <Eye size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-8 space-y-3">
            <Button
              variant="default"
              size="lg"
              disabled={loading}
              onPress={handleChangePassword}
              className="w-full bg-black"
            >
              <View className="flex-row items-center justify-center">
                {loading && (
                  <ActivityIndicator
                    size="small"
                    color="white"
                    className="mr-2"
                  />
                )}
                <Text className="text-white font-medium">
                  {loading ? "Menyimpan..." : "Simpan Password"}
                </Text>
              </View>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onPress={() => router.back()}
              disabled={loading}
              className={`w-full ${
                isDarkColorScheme 
                  ? "border-gray-600" 
                  : "border-border"
              }`}
            >
              <Text className={isDarkColorScheme ? "text-white" : "text-foreground"}>
                Batal
              </Text>
            </Button>
          </View>
        </View>

        {/* Security Tips Card */}
        <View
          className={`rounded-xl p-4 mt-4 ${
            isDarkColorScheme ? "bg-gray-800" : "bg-card"
          }`}
        >
          <Text
            className={`text-sm font-medium mb-3 ${
              isDarkColorScheme ? "text-white" : "text-card-foreground"
            }`}
          >
            Tips Keamanan
          </Text>
          <View className="space-y-2">
            <Text
              className={`text-xs ${
                isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              • Gunakan kombinasi huruf besar, kecil, angka, dan simbol
            </Text>
            <Text
              className={`text-xs ${
                isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              • Hindari menggunakan informasi personal yang mudah ditebak
            </Text>
            <Text
              className={`text-xs ${
                isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
              }`}
            >
              • Jangan gunakan password yang sama di platform lain
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
