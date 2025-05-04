// filepath: e:\skanida-apps-mobile\app\auth\AuthSelector.tsx
// app/login.tsx
import { useRouter, Stack } from "expo-router";
import React from "react";
import { View, ScrollView } from "react-native";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerClassName="flex-grow justify-center items-center p-6">
        <View className="w-full max-w-md">
          <Text className="text-4xl font-bold text-center mb-2 text-black">
            Skanida Apps
          </Text>

          <Text className="text-center mb-12 text-lg mt-4 text-black">
            Sistem Kehadiran dan Informasi Data
          </Text>
          <Button
            variant="outline"
            size="lg"
            className="mb-4 mt-4 w-full"
            onPress={() => router.push("/auth/Login")}
          >
            <Text className="text-black">Masuk</Text>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="mb-4 w-full"
            onPress={() => router.push("/auth/Register")}
          >
            <Text className="text-black">Daftar</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
