import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import {
  requiresSafeNativeWindInit,
  getDeviceDebugInfo,
} from "~/lib/deviceUtils";

interface SafeLoadingScreenProps {
  message?: string;
  showDebugInfo?: boolean;
}

/**
 * Safe loading screen that uses minimal styling to avoid NativeWind crashes
 * on Transsion devices during initialization
 */
export function SafeLoadingScreen({
  message = "Loading...",
  showDebugInfo = false,
}: SafeLoadingScreenProps) {
  const useSafeMode = requiresSafeNativeWindInit();
  const debugInfo = showDebugInfo ? getDeviceDebugInfo() : null;

  // Use inline styles for Transsion devices to avoid NativeWind conflicts
  if (useSafeMode) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000000", // Dark background
          padding: 16,
        }}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#000000"
          translucent={Platform.OS === "android"}
        />
        <Text
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {message}
        </Text>
        <ActivityIndicator size="large" color="#ffffff" />

        {debugInfo && (
          <View
            style={{
              marginTop: 24,
              padding: 12,
              backgroundColor: "#1a1a1a",
              borderRadius: 8,
              maxWidth: "90%",
            }}
          >
            <Text
              style={{
                color: "#888888",
                fontSize: 12,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Debug Info (Safe Mode Active)
            </Text>
            <Text
              style={{
                color: "#cccccc",
                fontSize: 11,
                fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
              }}
            >
              Device: {debugInfo.deviceName}
              {"\n"}
              Brand: {debugInfo.brand}
              {"\n"}
              Transsion: {debugInfo.isTranssionDevice ? "Yes" : "No"}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // For non-Transsion devices, use NativeWind classes
  return (
    <View className="flex-1 justify-center items-center bg-black p-4">
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={Platform.OS === "android"}
      />
      <Text className="text-white text-lg font-bold mb-4 text-center">
        {message}
      </Text>
      <ActivityIndicator size="large" color="#ffffff" />

      {debugInfo && (
        <View className="mt-6 p-3 bg-gray-900 rounded-lg max-w-[90%]">
          <Text className="text-gray-400 text-xs text-center mb-2">
            Debug Info
          </Text>
          <Text className="text-gray-200 text-xs font-mono">
            Device: {debugInfo.deviceName}
            {"\n"}
            Brand: {debugInfo.brand}
            {"\n"}
            Transsion: {debugInfo.isTranssionDevice ? "Yes" : "No"}
          </Text>
        </View>
      )}
    </View>
  );
}
