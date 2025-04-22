// app/register.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native"; // Added Alert
import Animated, {
  FadeInDown,
  FadeInUp,
  BounceIn,
  Layout,
  SlideInDown,
} from "react-native-reanimated";

import useAuthStore from "../../store/authStore";
import { supabase } from "~/utils/supabase";
import { Button } from "~/components/Button"; // Import the Button component

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
      <Animated.View entering={BounceIn.delay(200).duration(800)}>
        <Text className="text-3xl font-bold mb-2 text-center text-gray-700">
          Daftar Akun
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).duration(600)}>
        <Text className="text-center mb-8 text-gray-600">
          Buat akun baru untuk menggunakan aplikasi
        </Text>
      </Animated.View>

      <Animated.View entering={SlideInDown.delay(500).duration(500)}>
        <View className="mb-4">
          <Text className="text-gray-700 mb-2">Email</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-2.5"
            placeholder="Masukkan email Anda"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>
      </Animated.View>

      <Animated.View entering={SlideInDown.delay(600).duration(500)}>
        <View className="mb-4">
          <Text className="text-gray-700 mb-2">Password</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-2.5"
            placeholder="Masukkan password Anda"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>
      </Animated.View>

      <Animated.View entering={SlideInDown.delay(700).duration(500)}>
        <View className="mb-6">
          <Text className="text-gray-700 mb-2">Konfirmasi Password</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-2.5"
            placeholder="Masukkan kembali password Anda"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(800).duration(600)}>
        <Button
          variant="primary"
          size="large"
          className="mb-4"
          onPress={handleRegister}
          loading={loading}
        >
          Daftar
        </Button>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(1000).duration(600)}>
        <View className="flex-row justify-center mt-4">
          <Text className="text-gray-600">Sudah memiliki akun? </Text>
          <TouchableOpacity onPress={() => router.push("/auth/Login")}>
            <Text className="text-gray-700 font-semibold">Masuk</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
