// app/Login.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import useAuthStore from "../../store/authStore";
import { supabase } from "../../utils/supabase";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const handleLogin = async () => {
    setEmailError(false);
    setPasswordError(false);

    let hasError = false;
    if (!email) {
      setEmailError(true);
      hasError = true;
    }
    if (!password) {
      setPasswordError(true);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase login error:", error.message); // Keep console log for debugging
        return;
      }

      if (data?.user) {
        setUser(data.user);
        router.replace("/Dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <ScrollView contentContainerClassName="flex-grow justify-center p-6">
        <View>
          <Text className="text-3xl font-bold mb-2 text-center text-gray-700">
            Selamat Datang
          </Text>
        </View>

        <View>
          <Text className="text-center mb-8 text-gray-600">
            Masuk ke akun Anda untuk melanjutkan
          </Text>
        </View>

        <View>
          <View className="mb-4">
            <Text className="text-gray-700 mb-2">Email</Text>
            <Input
              className={cn(emailError && "border-red-500")}
              placeholder="Masukkan email Anda"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError(false);
              }}
            />
          </View>
        </View>

        <View>
          <View className="mb-6">
            <Text className="text-gray-700 mb-2">Password</Text>
            <Input
              className={cn(passwordError && "border-red-500")}
              placeholder="Masukkan password Anda"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError(false);
              }}
            />
          </View>
        </View>

        <View>
          <Button
            variant="default"
            size="lg"
            className="mb-4"
            onPress={handleLogin}
            disabled={loading}
          >
            <Text>{loading ? "Loading..." : "Masuk"}</Text>
          </Button>
        </View>

        <View>
          <View className="flex-row justify-center mt-4">
            <Text className="text-gray-600">Belum memiliki akun? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/Register")}>
              <Text className="text-gray-700 font-semibold">Daftar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
