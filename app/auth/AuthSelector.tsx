// filepath: e:\skanida-apps-mobile\app\auth\AuthSelector.tsx
// app/login.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect } from "react";
import { View, ScrollView, Image, BackHandler, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { H1, H3 } from "~/components/ui/typography";
import { useColorScheme } from "~/lib/useColorScheme";

const SkanidaLogo = require("../../assets/skanidatransparan.png");

export default function LoginScreen() {
  const router = useRouter();
  const { isDarkColorScheme } = useColorScheme();

  // Handle hardware back button - show exit confirmation
  useEffect(() => {
    const backAction = () => {
      Alert.alert(
        "Keluar Aplikasi",
        "Apakah Anda yakin ingin keluar dari aplikasi?",
        [
          { text: "Batal", style: "cancel" },
          { text: "Keluar", style: "destructive", onPress: () => BackHandler.exitApp() }
        ]
      );
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, []);

  return (
    <SafeAreaView className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={
          isDarkColorScheme
            ? ['#111827', '#1f2937', '#374151']
            : ['#f8fafc', '#f1f5f9', '#e2e8f0']
        }
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >          <View className="flex-1 justify-center items-center px-8 py-16">            {/* Logo Section */}
            <View className="items-center mb-16">
              <View className={`w-52 h-52 rounded-full shadow-lg mb-10 ${isDarkColorScheme ? "bg-white" : "bg-white/80"} items-center justify-center`}>
                <Image
                  source={SkanidaLogo}
                  className="w-36 h-36"
                  resizeMode="contain"
                />
              </View>

              <H1 className={`text-4xl font-bold text-center mb-4 ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}>
                Skanida Apps
              </H1>

              <Text className={`text-center text-lg leading-relaxed max-w-sm px-4 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}>
                Sistem Absensi SMKN2 Magelang
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="w-full max-w-sm space-y-6">
              <Button
                variant="default"
                size="lg"
                className={`w-full h-16 rounded-xl shadow-lg ${
                  isDarkColorScheme
                    ? "bg-white shadow-gray-900/20"
                    : "bg-gray-900 shadow-gray-900/10"
                }`}
                onPress={() => router.push("/auth/Login")}
              >
                <H3 className={`font-semibold text-lg ${isDarkColorScheme ? "text-gray-900" : "text-white"}`}>
                  Masuk
                </H3>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className={`w-full h-16 rounded-xl border-2 ${
                  isDarkColorScheme
                    ? "border-gray-600 bg-transparent"
                    : "border-gray-300 bg-transparent"
                }`}
                onPress={() => router.push("/auth/Register")}
              >
                <H3 className={`font-semibold text-lg ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}>
                  Daftar
                </H3>
              </Button>
            </View>

            {/* Footer */}
            <View className="mt-20">
              <Text className={`text-center text-sm ${isDarkColorScheme ? "text-gray-500" : "text-gray-400"}`}>
                © 2025 Skanida Apps
              </Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
