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
          let activeSession = session;
          let role = resolveUserRole(
            activeSession.access_token,
            activeSession.user.app_metadata as
              | Record<string, unknown>
              | undefined,
          );

          if (!role) {
            setLoadingMessage("Refreshing session");

            const {
              data: { session: refreshedSession },
              error: refreshError,
            } = await supabase.auth.refreshSession();

            if (refreshError) {
              if (__DEV__)
                console.error(
                  "[Index] refreshSession error:",
                  refreshError.message,
                );
              Sentry.captureException(refreshError, {
                tags: { feature: "auth-startup", reason: "missing-role" },
                extra: { userId: activeSession.user.id },
              });
              router.replace("/auth/AuthSelector");
              return;
            }

            if (refreshedSession?.user) {
              activeSession = refreshedSession;
              role = resolveUserRole(
                activeSession.access_token,
                activeSession.user.app_metadata as
                  | Record<string, unknown>
                  | undefined,
              );
            }
          }

          if (role === "siswa") {
            setLoadingMessage("Session found");
            setUser(activeSession.user);
            router.replace("/Dashboard");
            return;
          }

          if (role) {
            await supabase.auth.signOut();
            router.replace("/auth/AuthSelector");
            return;
          }

          Sentry.captureMessage("Missing user role after session refresh", {
            level: "warning",
            tags: { feature: "auth-startup", reason: "missing-role" },
            extra: { userId: activeSession.user.id },
          });
          router.replace("/auth/AuthSelector");
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
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl font-bold">{loadingMessage}</Text>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    </>
  );
}
