import "~/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import ConnectionChecker from "~/components/ConnectionChecker";
import { useEffect, useState } from "react";
import { colorScheme } from "nativewind";
import useThemeStore from "~/store/themeStore";
import { timeSync } from "~/utils/timeSync";
import {
  setupNotificationHandler,
  setupNotificationChannel,
  getNotificationPermissionStatus,
  registerAndSaveNotificationToken,
  clearNotificationToken,
} from "~/utils/notifications";
import { ensureSupabaseInitialized } from "~/utils/supabase";
import { View, ActivityIndicator, AppState } from "react-native";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";

import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.05,
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
  const user = useAuthStore((state) => state.user);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (theme === "system") {
      colorScheme.set("light");
    } else {
      colorScheme.set(theme);
    }
  }, [theme]);

  // Initialize Supabase before rendering the app
  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        // Initialize Supabase first
        await ensureSupabaseInitialized();

        if (!mounted) return;

        // Initialize TimeSync
        await timeSync.initialize();

        if (!mounted) return;

        // Setup notifications
        setupNotificationHandler();
        await setupNotificationChannel();

        if (!mounted) return;

        setIsSupabaseReady(true);
      } catch (error) {
        if (__DEV__) {
          console.error("App initialization failed:", error);
        }
        Sentry.captureException(error);
        if (mounted) {
          setInitError(
            error instanceof Error ? error.message : "Failed to initialize app",
          );
        }
      }
    }

    initializeApp();

    return () => {
      mounted = false;
      timeSync.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseReady || !user?.id) {
      return;
    }

    let isMounted = true;

    const reconcileNotificationState = async () => {
      try {
        const status = await getNotificationPermissionStatus(user.id);
        if (!isMounted) return;

        if (status.isGranted && !status.tokenSynced && !status.isOptedOut) {
          await registerAndSaveNotificationToken(user.id, {
            showAlertOnDenied: false,
            allowPermissionPrompt: false,
          });
          return;
        }

        if (!status.isGranted && status.tokenSynced) {
          await clearNotificationToken(user.id, { setOptOut: false });
        }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { userId: user.id, scope: "root-notification-reconcile" },
        });
      }
    };

    void reconcileNotificationState();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void reconcileNotificationState();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [isSupabaseReady, user?.id]);

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
        <StatusBar style="auto" />
        <Stack />
        <PortalHost />
      </ConnectionChecker>
    </SafeAreaProvider>
  );
});
