import { Stack, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "~/utils/supabase";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { ChevronLeft, Lock, Mail } from "lucide-react-native";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = email.trim().length > 0 && emailRegex.test(email);

  // Handle hardware back button for Android
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [router]);

  /**
   * Open default email application
   * Strategy: Try Android Intent for APP_EMAIL, then known email client schemes, then fallback
   */
  const openEmailApp = useCallback(async () => {
    try {
      // List of email client URL schemes to try (in order of popularity)
      const emailSchemes = [
        // Gmail
        "googlegmail://",
        "com.google.android.gm://",
        // Outlook
        "ms-outlook://",
        "com.microsoft.office.outlook://",
        // Spark
        "readdle-spark://",
        // Airmail
        "airmail://",
        // Edison Mail
        "edisonmail://",
        // Yahoo Mail
        "ymail://",
        "yahoo://",
      ];

      let opened = false;

      // Try known email client schemes
      for (const scheme of emailSchemes) {
        try {
          const canOpen = await Linking.canOpenURL(scheme);
          if (canOpen) {
            await Linking.openURL(scheme);
            opened = true;
            break;
          }
        } catch {
          // Continue to next scheme
          continue;
        }
      }

      // If no scheme worked, show fallback instruction
      if (!opened) {
        Alert.alert(
          "Buka Email Manual",
          "Tidak dapat membuka aplikasi email secara otomatis. Silakan buka aplikasi email Anda secara manual.",
          [{ text: "OK" }],
        );
      }
    } catch (err) {
      if (__DEV__) console.error("Error opening email app:", err);
      Alert.alert(
        "Buka Email Manual",
        "Tidak dapat membuka aplikasi email secara otomatis. Silakan buka aplikasi email Anda secara manual.",
        [{ text: "OK" }],
      );
    }
  }, []);

  /**
   * Handle password reset request
   */
  const handleResetPassword = useCallback(async () => {
    setEmailError(false);
    setErrorMessage("");

    if (!isValidEmail) {
      setEmailError(true);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: process.env.EXPO_PUBLIC_AUTH_CALLBACK_URL,
      });

      if (error) {
        if (__DEV__) console.error("Reset password error:", error.message);
        setErrorMessage("Terjadi kesalahan. Silakan coba lagi nanti.");
        Alert.alert("Gagal", "Terjadi kesalahan, coba lagi nanti.");
        return;
      }

      // Success: Show modal with two buttons
      Alert.alert(
        "Terkirim",
        "Permintaan reset password berhasil. Silakan periksa email Anda.",
        [
          {
            text: "Buka Email",
            onPress: async () => {
              await openEmailApp();
              // Clear form after opening email app
              setEmail("");
            },
          },
          {
            text: "Kembali",
            onPress: () => {
              // Clear form and navigate back to Auth Selector
              setEmail("");
              router.replace("/auth/AuthSelector");
            },
          },
        ],
        { cancelable: false },
      );
    } catch (err) {
      if (__DEV__) console.error("Reset password exception:", err);
      setErrorMessage("Terjadi kesalahan. Silakan coba lagi nanti.");
      Alert.alert("Gagal", "Terjadi kesalahan. Silakan coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  }, [email, isValidEmail, openEmailApp, router]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header with Back Button */}
      <View className="flex-row items-center p-6 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-card dark:bg-gray-800"
        >
          <Icon as={ChevronLeft} className="size-5 text-foreground" />
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
              <View className="w-32 h-32 rounded-full shadow-lg mb-8 items-center justify-center bg-card dark:bg-gray-800">
                <Icon as={Lock} className="size-12 text-foreground" />
              </View>

              <Text
                variant="h3"
                className="text-3xl font-bold text-center mb-3 text-foreground"
              >
                Reset Password
              </Text>

              <Text className="text-center text-base leading-relaxed max-w-sm text-foreground">
                Masukkan email Anda untuk menerima link reset password
              </Text>
            </View>

            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View className="rounded-2xl p-8 shadow-xl bg-card dark:bg-gray-800">
                {/* Email Field */}
                <View className="mb-6">
                  <Text
                    variant="small"
                    className="mb-3 font-medium text-foreground"
                  >
                    Email
                  </Text>
                  <View className="relative">
                    <Input
                      placeholder="Masukkan email Anda"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (emailError) setEmailError(false);
                        if (errorMessage) setErrorMessage("");
                      }}
                      editable={!loading}
                      className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                    <View className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Icon as={Mail} className="size-5 text-foreground" />
                    </View>
                  </View>
                  {emailError && (
                    <Text variant="small" className="mt-2 text-red-500">
                      Email tidak valid
                    </Text>
                  )}
                </View>

                {/* Error Message */}
                {errorMessage && (
                  <View className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <Text
                      variant="small"
                      className="text-red-600 dark:text-red-400"
                    >
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {/* Submit Button */}
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleResetPassword}
                  disabled={!isValidEmail || loading}
                >
                  <Text
                    variant="h3"
                    className="font-semibold text-lg text-primary-foreground"
                  >
                    {loading ? "Mengirim..." : "Kirim Link Reset"}
                  </Text>
                </Button>
              </View>

              {/* Back to Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text variant="default" className="text-foreground">
                  Sudah ingat password?
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Login")}>
                  <Text
                    variant="default"
                    className="font-semibold text-primary ml-1"
                  >
                    Kembali ke Login
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
