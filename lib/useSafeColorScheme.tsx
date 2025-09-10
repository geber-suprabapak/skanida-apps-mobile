import { useState, useEffect } from "react";
import { useColorScheme as useNativewindColorScheme } from "nativewind";
import { requiresSafeNativeWindInit } from "~/lib/deviceUtils";

interface ColorSchemeState {
  colorScheme: "light" | "dark";
  isDarkColorScheme: boolean;
  isInitialized: boolean;
  setColorScheme: (scheme: "light" | "dark") => void;
  toggleColorScheme: () => void;
}

/**
 * Safe color scheme hook that handles Transsion devices carefully
 * Provides fallback values during initialization to prevent native crashes
 */
export function useSafeColorScheme(): ColorSchemeState {
  const [isInitialized, setIsInitialized] = useState(false);
  const [fallbackScheme, setFallbackScheme] = useState<"light" | "dark">(
    "dark",
  );
  // Always call the hook but conditionally use its values
  const nativewindHook = useNativewindColorScheme();
  const isSafeDevice = !requiresSafeNativeWindInit();

  useEffect(() => {
    if (requiresSafeNativeWindInit()) {
      // For Transsion devices, delay NativeWind initialization
      const timer = setTimeout(() => {
        setIsInitialized(true);
      }, 2000); // 2 second delay to let UI stabilize

      return () => clearTimeout(timer);
    } else {
      // For other devices, initialize immediately
      setIsInitialized(true);
    }
  }, []);

  // For problematic devices during initialization, use fallback
  if (requiresSafeNativeWindInit() && !isInitialized) {
    return {
      colorScheme: fallbackScheme,
      isDarkColorScheme: fallbackScheme === "dark",
      isInitialized: false,
      setColorScheme: setFallbackScheme,
      toggleColorScheme: () =>
        setFallbackScheme((prev) => (prev === "dark" ? "light" : "dark")),
    };
  }

  // Once initialized or for safe devices, use NativeWind
  const { colorScheme, setColorScheme, toggleColorScheme } = nativewindHook;

  return {
    colorScheme: colorScheme ?? fallbackScheme,
    isDarkColorScheme: (colorScheme ?? fallbackScheme) === "dark",
    isInitialized: true,
    setColorScheme: setColorScheme || setFallbackScheme,
    toggleColorScheme:
      toggleColorScheme ||
      (() => setFallbackScheme((prev) => (prev === "dark" ? "light" : "dark"))),
  };
}

/**
 * Original useColorScheme for backward compatibility
 * Now uses the safe implementation under the hood
 */
export function useColorScheme() {
  const { colorScheme, isDarkColorScheme, setColorScheme, toggleColorScheme } =
    useSafeColorScheme();

  return {
    colorScheme,
    isDarkColorScheme,
    setColorScheme,
    toggleColorScheme,
  };
}
