// app/home.tsx
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Alert } from "react-native";
import { YStack, Text, Button } from "tamagui";

import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    Alert.alert("Logout", "Berhasil Logout", [
      { text: "OK", onPress: () => router.replace("/AuthSelector") },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false, // If you want to hide the entire header, use this
        }}
      />
      <YStack flex={1} jc="center" ai="center" space="$3">
        <Text fontSize="$5">Selamat datang, {user?.email || "User"}!</Text>
        <Button onPress={() => router.push("/AbsenceReport")}>Lapor Kehadiran</Button>
        <Button onPress={handleLogout}>Logout</Button>
      </YStack>
    </>
  );
}
