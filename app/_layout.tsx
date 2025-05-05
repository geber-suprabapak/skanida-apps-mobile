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
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true); // Add loading state

  React.useEffect(() => {
    // Simulate loading for 1 second
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); // 1000 milliseconds = 1 second

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
    // Also wait for color scheme to be loaded before showing the main stack
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
        <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "transparent", // ✅ hanya backgroundColor yang valid
            },
            headerTransparent: true, // ✅ header transparan
            headerShadowVisible: false, // ✅ hapus bayangan header
            contentStyle: {
              paddingTop: 0, // ✅ isi screen mulai dari atas
            },
          }}
        >
          {/* Default screen options */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" options={{ headerShown: false }} />
          <Stack.Screen
            name="auth/AuthSelector"
            options={{ headerShown: false }}
          />
          {/* Hide default header for Login and Register */}
          <Stack.Screen name="auth/Login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/Register" options={{ headerShown: false }} />
          <Stack.Screen
            name="attendance/AbsenceReport"
            options={{ title: "Lapor Absensi" }}
          />
          {/* ... rest of the screens ... */}
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
