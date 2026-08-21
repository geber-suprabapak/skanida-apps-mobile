// filepath: app/index.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import * as Sentry from "@sentry/react-native";

import useAuthStore from "../store/authStore";
import { clearLogtoSession, getLogtoUser } from "~/utils/logto";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getLogtoUser();
        if (!user) {
          router.replace("/auth/AuthSelector");
          return;
        }

        const isStudent = user.roles.some(
          (role) => role === "student" || role === "siswa",
        );
        if (!isStudent) {
          await clearLogtoSession();
          router.replace("/auth/AuthSelector");
          return;
        }

        setLoadingMessage("Session found");
        setUser(user);
        router.replace("/Dashboard");
      } catch (err) {
        if (__DEV__) console.error("[Index] checkAuth error:", err);
        Sentry.captureException(err);
        router.replace("/auth/AuthSelector");
      }
    };

    checkAuth();
  }, [router, setUser]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl font-bold">{loadingMessage}</Text>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    </>
  );
}
