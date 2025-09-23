// filepath: e:\skanida-apps-mobile\app\auth\AuthSelector.tsx
// app/login.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Image,
  BackHandler,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { H1, H3 } from "~/components/ui/typography";

const SkanidaLogo = require("../../assets/skanidatransparan.png");

export default function LoginScreen() {
  const router = useRouter();

  // Handle hardware back button - show exit confirmation
  useEffect(() => {
    const backAction = () => {
      Alert.alert(
        "Keluar Aplikasi",
        "Apakah Anda yakin ingin keluar dari aplikasi?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Keluar",
            style: "destructive",
            onPress: () => BackHandler.exitApp(),
          },
        ],
      );
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, []);
  return (
    <SafeAreaView className={`flex-1 `}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center items-center px-8 py-16">
          {/* Logo Section */}
          <View className="items-center mb-16">
            <TouchableOpacity
              onPress={() => {}}
              className={`w-52 h-52 rounded-full shadow-lg mb-10  items-center justify-center`}
              activeOpacity={0.8}
            >
              <Image
                source={SkanidaLogo}
                className="w-36 h-36"
                resizeMode="contain"
              />
            </TouchableOpacity>
            <H1 className={`text-4xl font-bold text-center mb-4 `}>
              Skanida Apps
            </H1>
            <Text
              className={`text-center text-lg leading-relaxed max-w-sm px-4 `}
            >
              Sistem Absensi SMKN2 Magelang
            </Text>
          </View>
          {/* Action Buttons */}
          <View className="w-full max-w-sm space-y-6 gap-2">
            <Button
              variant="default"
              size="lg"
              className={`w-full h-16 rounded-xl shadow-lg `}
              onPress={() => router.push("/auth/Login")}
            >
              <H3 className={`font-semibold text-lg `}>Masuk</H3>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className={`w-full h-16 rounded-xl border-2  `}
              onPress={() => router.push("/auth/Register")}
            >
              <H3 className={`font-semibold text-lg `}>Daftar</H3>
            </Button>
          </View>
          {/* Footer */}
          <View className="mt-20">
            <Text className={`text-center text-sm `}>© 2025 Skanida Apps</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
