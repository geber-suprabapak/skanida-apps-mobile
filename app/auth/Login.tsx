import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Eye } from "~/lib/icons/Eye";
import { EyeOff } from "~/lib/icons/EyeOff";
import { Key } from "~/lib/icons/Key";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  // Handle hardware back button for Android
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [router]);

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
        if (error.message === "Email not confirmed") {
          alert(
            "Email belum dikonfirmasi. Silakan periksa email Anda untuk verifikasi.",
          );
        } else {
          alert("Login gagal. Periksa kembali email dan password Anda.");
        }
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
    <SafeAreaView className={`flex-1 `}>
      <Stack.Screen name="auth/Login" options={{ headerShown: false }} />

      {/* Header with Back Button */}
      <View className="flex-row items-center p-6 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className={`w-12 h-12 rounded-full items-center justify-center  shadow-lg`}
        >
          <ChevronLeft size={20} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center items-center px-8 py-8">
            {/* Logo and Title Section */}
            <View className="items-center mb-12">
              <View
                className={`w-32 h-32 rounded-full shadow-lg mb-8  items-center justify-center`}
              >
                <Key size={48} />
              </View>

              <Text
                variant={"h3"}
                className={`text-3xl font-bold text-center mb-3 `}
              >
                Selamat Datang Kembali
              </Text>

              <Text
                className={`text-center text-base leading-relaxed max-w-sm `}
              >
                Masuk ke akun Anda untuk melanjutkan
              </Text>
            </View>
            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View className={`rounded-2xl p-8 shadow-xl `}>
                {/* Email Field */}
                <View className="mb-6">
                  <Text className={`mb-3 text-sm font-medium `}>Email</Text>
                  <Input
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
                {/* Password Field */}
                <View className="mb-8">
                  <Text className={`mb-3 text-sm font-medium `}>Password</Text>
                  <View className="relative">
                    <Input
                      placeholder="Masukkan password Anda"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (passwordError) setPasswordError(false);
                      }}
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Login Button */}
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text variant="h3" className={`font-semibold text-lg `}>
                    {loading ? "Sedang masuk..." : "Masuk"}
                  </Text>
                </Button>
              </View>

              {/* Register Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text className={`text-base `}>Belum memiliki akun?</Text>
                <TouchableOpacity onPress={() => router.push("/auth/Register")}>
                  <Text className={`font-semibold text-base `}>
                    Daftar sekarang
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
