// filepath: e:\skanida-apps-mobile\app\auth\AuthSelector.tsx
// app/login.tsx
import { Asset } from "expo-asset";
import { useRouter, Stack } from "expo-router";
import React from "react";
import { View, ScrollView, Image } from "react-native"; // Import Image

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { H2, H3, H4 } from "~/components/ui/typography"; // Ensure H3 is imported

// Import the logo - using require for better compatibility
const SkanidaLogo = require("../../assets/skanida.png");

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerClassName="flex-grow justify-center items-center p-6">
        <View className="w-full max-w-md items-center">
          {" "}
          {/* Add items-center */}
          {/* Add the logo here */}
          <Image
            source={SkanidaLogo}
            className="w-96 h-96 mb-6" // Updated size to w-96 h-96
            resizeMode="contain"
          />
          <Text className="text-4xl font-bold text-center mb-2 text-black">
            Skanida Apps
          </Text>
          <Text className="text-center mb-12 text-lg mt-4 text-black">
            Sistem Kehadiran dan Informasi Data
          </Text>
          <Button
            size="lg"
            className="mb-4 mt-4 w-full bg-black border border-transparent active:bg-white active:border-gray-400"
            onPress={() => router.push("/auth/Login")}
          >
            <H3 className="text-white group-active:text-gray-400">Masuk</H3>
          </Button>
          <Button
            size="lg"
            className="mb-4 w-full bg-black border border-transparent active:bg-white active:border-gray-400"
            onPress={() => router.push("/auth/Register")}
          >
            <H3 className="text-white group-active:text-gray-400">Daftar</H3>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
