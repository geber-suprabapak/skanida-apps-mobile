// filepath: app/index.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import * as Sentry from "@sentry/react-native";

import useAuthStore from "../store/authStore";
import { supabase } from "../utils/supabase";
import { resolveUserRole } from "~/utils/authUtils";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          if (__DEV__)
            console.error("[Index] getSession error:", error.message);
          Sentry.captureException(error);
        }

        if (session?.user) {
          const role = resolveUserRole(
            session.access_token,
            session.user.app_metadata as Record<string, unknown> | undefined,
          );

          if (role !== "siswa") {
            await supabase.auth.signOut();
            router.replace("/auth/AuthSelector");
            return;
          }

          setLoadingMessage("Session found");
          setUser(session.user);
          router.replace("/Dashboard");
        } else {
          router.replace("/auth/AuthSelector");
        }
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl font-bold">{loadingMessage}</Text>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    </>
  );
}
