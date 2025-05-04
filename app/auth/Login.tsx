// app/Login.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import useAuthStore from "../../store/authStore";
import { supabase } from "../../utils/supabase";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Large, H1, H4, P, H3 } from "~/components/ui/typography"; // Import H1, H4, and H3 components
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
    // Add top padding (pt-10) directly to SafeAreaView
    <SafeAreaView className="flex-1 bg- pt-10" edges={["top", "left", "right"]}>
      {/* Set status bar style to dark for light background */}
      <StatusBar style="dark" />
      {/* Remove the spacer View */}
      {/* Keep ScrollView padding as it was (or adjust if needed, removing pt-20) */}
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 pb-6">
        <View>
          <H1 className="mb-2 text-center text-gray-700">
            Selamat Datang
          </H1>
        </View>

        <View>
          <P className="text-center mb-8 text-gray-600">
            Masuk ke akun Anda untuk melanjutkan
          </P>
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
            className="mb-4 w-full bg-black py-3"
            onPress={handleLogin}
            disabled={loading}
          >
            <H3 className="text-white font-medium text-center">
              {loading ? "Loading..." : "Masuk"}
            </H3>
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
