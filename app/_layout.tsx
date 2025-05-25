import "~/global.css";

import {
  Theme,
  ThemeProvider,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LoadingScreen from "./auth/LoadingScreen";

import { NAV_THEME } from "~/lib/constants";
import { useColorScheme } from "~/lib/useColorScheme";
import useThemeStore from "~/store/themeStore";

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export default function RootLayout() {
  const hasMounted = React.useRef(false);
  const { isDarkColorScheme } = useColorScheme();
  const { isDarkMode } = useThemeStore();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true); // Add loading state

  React.useEffect(() => {
    // Simulate loading for 1 second
    // Timeout 1ms (sangat singkat) karena:
    // 1. Hanya untuk mencegah flash of unstyled content (FOUC)
    // 2. Loading screen sudah di-handle oleh komponen LoadingScreen
    // 3. Tidak memerlukan waktu lama karena ini hanya setup initial theme
    // 4. User experience lebih baik dengan transisi yang cepat
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1);
    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === "web") {
      // Adds the background color to the html element to prevent white background on overscroll.
      document.documentElement.classList.add("bg-background");
    }
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  // Show loading screen first
  if (isLoading || !isColorSchemeLoaded) {
    return <LoadingScreen />;
  }

  // Use the theme store state for more reliable dark mode detection
  const isActuallyDark = isDarkMode || isDarkColorScheme;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={isActuallyDark ? DARK_THEME : LIGHT_THEME}>
        <StatusBar
          style={isActuallyDark ? "light" : "dark"}
          backgroundColor="transparent"
          translucent={Platform.OS === "android"}
        />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "transparent",
            },
            headerTransparent: true,
            headerShadowVisible: false,
            contentStyle: {
              paddingTop: 0,
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" options={{ headerShown: false }} />
          <Stack.Screen
            name="auth/AuthSelector"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="auth/Login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/Register" options={{ headerShown: false }} />
          <Stack.Screen
            name="attendance/AbsenceReport"
            options={{ title: "Lapor Absensi" }}
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Untuk support server-side rendering di web
const useIsomorphicLayoutEffect =
  Platform.OS === "web" && typeof window === "undefined"
    ? React.useEffect
    : React.useLayoutEffect;
