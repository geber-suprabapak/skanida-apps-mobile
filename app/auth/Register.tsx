// app/register.tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { H1, P, H3 } from "~/components/ui/typography";
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
  const { isDarkMode } = useThemeStore();

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
    <SafeAreaView
      className="flex-1 pt-10 bg-white"
      edges={["top", "left", "right"]}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 pb-6 bg-white">
        <View>
          <H1 className="mb-2 text-center text-foreground">Daftar Akun</H1>
          <View>
            <P className="text-center mb-8 text-muted-foreground">
              Buat akun baru untuk menggunakan aplikasi
            </P>
          </View>
        </View>

        <View>
          <View className="mb-4">
            <Text className="mb-2 text-foreground">Email</Text>
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
            <Text className="mb-2 text-foreground">Password</Text>
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
            <Text className="mb-2 text-foreground">Konfirmasi Password</Text>
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
            className={`mb-4 w-full ${
              isDarkMode ? 'bg-white' : 'bg-black'
            }`}
            onPress={handleRegister}
            disabled={loading}
          >
            <H3 className={`font-medium ${isDarkMode ? 'text-black' : 'text-white'}`}>
              {loading ? "Loading..." : "Daftar"}
            </H3>
          </Button>
        </View>

        <View>
          <View className="flex-row justify-center mt-4">
            <Text className="text-muted-foreground">Sudah memiliki akun? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/Login")}>
              <Text className="font-semibold text-foreground">Masuk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}