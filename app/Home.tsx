// app/home.tsx
import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";

import useAuthStore from "~/store/authStore";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to Dashboard when user is logged in
    if (user) {
      router.replace("/Dashboard");
    } else {
      router.replace("/auth/AuthSelector");
    }
  }, [user, router]);

  // Show loading screen while redirecting
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View className="flex-1 items-center justify-center space-y-3">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-lg text-gray-600">Loading...</Text>
      </View>
    </>
  );
}
