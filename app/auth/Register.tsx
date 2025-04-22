// app/register.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, TouchableOpacity, Alert } from "react-native";

import useAuthStore from "../../store/authStore";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { supabase } from "~/utils/supabase";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Semua kolom harus diisi");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Password dan konfirmasi password harus sama");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      if (data?.user) {
        setUser(data.user);
        Alert.alert(
          "Berhasil",
          "Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/Dashboard"),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert("Error", "Terjadi kesalahan saat mendaftar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 p-6 justify-center bg-white">
      <View>
        <Text className="text-3xl font-bold mb-2 text-center text-gray-700">
          Daftar Akun
        </Text>
      </View>

      <View>
        <Text className="text-center mb-8 text-gray-600">
          Buat akun baru untuk menggunakan aplikasi
        </Text>
      </View>

      <View>
        <View className="mb-4">
          <Text className="text-gray-700 mb-2">Email</Text>
          <Input // Use Input component
            className="border border-gray-300 rounded-lg px-4 py-2.5"
            placeholder="Masukkan email Anda"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>
      </View>

      <View>
        <View className="mb-4">
          <Text className="text-gray-700 mb-2">Password</Text>
          <Input // Use Input component
            className="border border-gray-300 rounded-lg px-4 py-2.5"
            placeholder="Masukkan password Anda"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>
      </View>

      <View>
        <View className="mb-6">
          <Text className="text-gray-700 mb-2">Konfirmasi Password</Text>
          <Input // Use Input component
            className="border border-gray-300 rounded-lg px-4 py-2.5"
            placeholder="Masukkan kembali password Anda"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>
      </View>

      <View>
        <Button
          variant="default"
          size="lg"
          className="mb-4"
          onPress={handleRegister}
          disabled={loading}
        >
          <Text>{loading ? "Loading..." : "Daftar"}</Text>
        </Button>
      </View>

      <View>
        <View className="flex-row justify-center mt-4">
          <Text className="text-gray-600">Sudah memiliki akun? </Text>
          <TouchableOpacity onPress={() => router.push("/auth/Login")}>
            <Text className="text-gray-700 font-semibold">Masuk</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
