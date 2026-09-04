import { useRouter, Stack, type Href } from "expo-router";
import { useEffect } from "react";
import * as Sentry from "@sentry/react-native";

import useAuthStore from "../store/authStore";
import { clearLogtoSession, getLogtoUser } from "~/utils/logto";
import LoadingScreen from "./auth/LoadingScreen";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        // Avoid redundant parallel session restoration if already populated by _layout.tsx
        const initialUser = useAuthStore.getState().user;
        const currentUser = initialUser ?? (await getLogtoUser());
        if (!active) return;
        if (!currentUser) {
          router.replace("/auth/AuthSelector");
          return;
        }

        const isStudent = currentUser.roles.some(
          (role) => role === "student" || role === "siswa",
        );
        if (!isStudent) {
          await clearLogtoSession();
          if (!active) return;
          setUser(null);
          router.replace("/auth/AuthSelector");
          return;
        }

        if (!useAuthStore.getState().user) {
          setUser(currentUser);
        }
        if (active) {
          // SAFETY: `/home` is supplied by the new `(tabs)/home.tsx` route; Expo's
          // generated typed-route cache is refreshed by Metro after file changes.
          router.replace("/home" as Href);
        }
      } catch (err) {
        if (__DEV__) console.error("[Index] checkAuth error:", err);
        Sentry.captureException(err);
        if (active) {
          router.replace("/auth/AuthSelector");
        }
      }
    };

    void checkAuth();

    return () => {
      active = false;
    };
  }, [router, setUser]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoadingScreen />
    </>
  );
}
