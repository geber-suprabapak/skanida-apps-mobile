// app/register.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import useAuthStore from "../../store/authStore";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Large, H1, P, H3 } from "~/components/ui/typography";
import { cn } from "~/lib/utils";
import { supabase } from "~/utils/supabase";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const handleRegister = async () => {
    setEmailError(false);
    setPasswordError(false);
    setConfirmPasswordError(false);

    let hasValidationError = false;
    if (!email) {
      setEmailError(true);
      hasValidationError = true;
    }
    if (!password) {
      setPasswordError(true);
      hasValidationError = true;
    }
    if (!confirmPassword) {
      setConfirmPasswordError(true);
      hasValidationError = true;
    }

    let passwordMismatch = false;
    if (password && confirmPassword && password !== confirmPassword) {
      setPasswordError(true);
      setConfirmPasswordError(true);
      passwordMismatch = true;
    }

    if (hasValidationError || passwordMismatch) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error("Supabase signup error:", error.message);
        return;
      }

      if (data?.user) {
        setUser(data.user);
        router.replace("/Dashboard");
      }
    } catch (error) {
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white pt-10" edges={["top", "left", "right"]}>
      {/* Set status bar style to dark for light background */}
      <StatusBar style="dark" />
      {/* Keep ScrollView padding as it was (or adjust if needed, removing pt-20) */}
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 pb-6">
        <View>
          <H1 className="mb-2 text-center text-gray-700">
            Daftar Akun
          </H1>
        </View>

        <View>
          <P className="text-center mb-8 text-gray-600">
            Buat akun baru untuk menggunakan aplikasi
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
          <View className="mb-4">
            <Text className="text-gray-700 mb-2">Password</Text>
            <Input
              className={cn(passwordError && "border-red-500")}
              placeholder="Masukkan password Anda"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError(false);
                if (confirmPasswordError && text === confirmPassword) {
                  setConfirmPasswordError(false);
                }
              }}
            />
          </View>
        </View>

        <View>
          <View className="mb-6">
            <Text className="text-gray-700 mb-2">Konfirmasi Password</Text>
            <Input
              className={cn(confirmPasswordError && "border-red-500")}
              placeholder="Masukkan kembali password Anda"
              secureTextEntry
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError(false);
                if (passwordError && text === password) {
                  setPasswordError(false);
                }
              }}
            />
          </View>
        </View>

        <View>
          <Button
            variant="default"
            size="lg"
            className="mb-4 w-full bg-black py-3"
            onPress={handleRegister}
            disabled={loading}
          >
            <H3 className="text-white font-medium">
              {loading ? "Loading..." : "Daftar"}
            </H3>
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
      </ScrollView>
    </SafeAreaView>
  );
}
