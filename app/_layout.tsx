import "~/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import ConnectionChecker from "~/components/ConnectionChecker";
import { useEffect, useState } from "react";
import { Uniwind, useUniwind } from "uniwind";
import useThemeStore from "~/store/themeStore";
import { timeSync } from "~/utils/timeSync";
import {
  setupNotificationHandler,
  setupNotificationChannel,
} from "~/utils/notifications";
import { useNotificationSync } from "~/hooks/useNotificationSync";
import { ensureSupabaseInitialized, supabase } from "~/utils/supabase";
import { View, ActivityIndicator } from "react-native";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";

import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  enableTombstone: true,
  tracesSampleRate: 0.1,
  // Keep Hermes profiling off during the Expo 57 rollout to mitigate the
  // known Sentry/Hermes teardown SIGABRT race.
  profilesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
    }),
    Sentry.feedbackIntegration(),
  ],
  spotlight: __DEV__,
});

export { ErrorBoundary } from "expo-router";

export default Sentry.wrap(function RootLayout() {
  const { theme } = useThemeStore();
  const { theme: resolvedTheme } = useUniwind();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    Uniwind.setTheme(theme);
  }, [theme]);

  // Initialize Supabase first — this gates rendering. TimeSync and
  // notifications are initialized afterwards without blocking auth.
  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        await ensureSupabaseInitialized();
        if (!mounted) return;
        // Unblock auth routing immediately after Supabase is ready.
        setIsSupabaseReady(true);
      } catch (error) {
        if (__DEV__) {
          console.error("Supabase initialization failed:", error);
        }
        Sentry.captureException(error);
        if (mounted) {
          setInitError(
            error instanceof Error ? error.message : "Failed to initialize app",
          );
        }
        return;
      }

      // Non-blocking: failures here don't affect auth or routing.
      try {
        await timeSync.initialize();
      } catch (error) {
        if (__DEV__) console.warn("TimeSync initialization failed:", error);
        Sentry.captureException(error);
      }

      if (!mounted) return;

      try {
        setupNotificationHandler();
        await setupNotificationChannel();
      } catch (error) {
        if (__DEV__) console.warn("Notification setup failed:", error);
        Sentry.captureException(error);
      }
    }

    initializeApp();

    return () => {
      mounted = false;
      timeSync.cleanup();
    };
  }, []);

  // Keep Zustand auth store in sync with Supabase auth state changes
  // (token refresh, sign-out, sign-in from another tab/device, etc.)
  // INITIAL_SESSION is intentionally skipped — index.tsx handles the first
  // routing decision via getSession() to avoid a double fetchUserProfile call.
  useEffect(() => {
    if (!isSupabaseReady) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseReady, setUser]);

  // Reconcile notification state on mount & app resume
  useNotificationSync({ userId: user?.id, enabled: isSupabaseReady });

  // Show loading screen while initializing
  if (!isSupabaseReady) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
          {initError ? (
            <View className="items-center px-8">
              <Text
                variant="h3"
                className="text-red-600 dark:text-red-500 mb-2"
              >
                Initialization Error
              </Text>
              <Text className="text-center text-gray-600 dark:text-gray-400">
                {initError}
              </Text>
            </View>
          ) : (
            <View className="items-center">
              <ActivityIndicator size="large" color="#0066FF" />
              <Text className="mt-4 text-gray-600 dark:text-gray-400">
                Initializing...
              </Text>
            </View>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ConnectionChecker>
        <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
        <Stack />
        <PortalHost />
      </ConnectionChecker>
    </SafeAreaProvider>
  );
});
