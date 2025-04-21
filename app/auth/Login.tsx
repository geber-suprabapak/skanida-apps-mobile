// app/Login.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  BounceIn,
  Layout,
  SlideInDown,
} from "react-native-reanimated";

import useAuthStore from "../../store/authStore";
import { supabase } from "../../utils/supabase";
import { Button } from "~/components/Button";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Email dan password harus diisi");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      if (data?.user) {
        setUser(data.user);
        router.replace("/Dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Terjadi kesalahan saat login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 p-6 justify-center bg-white">
      <Animated.View entering={BounceIn.delay(200).duration(800)}>
        <Text className="text-3xl font-bold mb-2 text-center text-brand-purple">
          Selamat Datang
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).duration(600)}>
        <Text className="text-center mb-8 text-gray-600">
          Masuk ke akun Anda untuk melanjutkan
        </Text>
      </Animated.View>

      <Animated.View entering={SlideInDown.delay(600).duration(500)}>
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

      <Animated.View entering={SlideInDown.delay(700).duration(500)}>
        <View className="mb-6">
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

      <Animated.View entering={FadeInUp.delay(800).duration(600)}>
        <Button
          variant="primary"
          size="large"
          className="mb-4"
          onPress={handleLogin}
          loading={loading}
        >
          Masuk
        </Button>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(1000).duration(600)}>
        <View className="flex-row justify-center mt-4">
          <Text className="text-gray-600">Belum memiliki akun? </Text>
          <TouchableOpacity onPress={() => router.push("/auth/Register")}>
            <Text className="text-brand-purple font-semibold">Daftar</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
