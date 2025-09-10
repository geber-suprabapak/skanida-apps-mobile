import React, { Component, ReactNode } from "react";
import { View, Text, StatusBar, Platform } from "react-native";
import { getDeviceDebugInfo } from "~/lib/deviceUtils";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Error boundary specifically designed to catch NativeWind-related crashes
 * and provide graceful fallback for Transsion devices
 */
export class NativeWindErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error details
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || null,
    });

    // You can also log the error to an error reporting service here
    console.warn("NativeWind Error Boundary caught an error:", error);
    console.warn("Error Info:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const deviceInfo = getDeviceDebugInfo();

      // Fallback UI using inline styles to avoid any NativeWind issues
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#000000",
            padding: 20,
          }}
        >
          <StatusBar
            barStyle="light-content"
            backgroundColor="#000000"
            translucent={Platform.OS === "android"}
          />

          <Text
            style={{
              color: "#ff4444",
              fontSize: 20,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            UI Rendering Error
          </Text>

          <Text
            style={{
              color: "#ffffff",
              fontSize: 16,
              textAlign: "center",
              marginBottom: 24,
              lineHeight: 24,
            }}
          >
            The app encountered a rendering issue. {"\n"}
            Please restart the app to continue.
          </Text>

          {__DEV__ && (
            <View
              style={{
                backgroundColor: "#1a1a1a",
                padding: 16,
                borderRadius: 8,
                maxWidth: "90%",
                marginTop: 20,
              }}
            >
              <Text
                style={{
                  color: "#888888",
                  fontSize: 12,
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                Debug Information
              </Text>

              <Text
                style={{
                  color: "#cccccc",
                  fontSize: 11,
                  fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                  marginBottom: 8,
                }}
              >
                Device: {deviceInfo.deviceName}
                {"\n"}
                Brand: {deviceInfo.brand}
                {"\n"}
                Transsion Device: {deviceInfo.isTranssionDevice ? "Yes" : "No"}
              </Text>

              {this.state.error && (
                <Text
                  style={{
                    color: "#ff6666",
                    fontSize: 10,
                    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                  }}
                >
                  Error: {this.state.error.message}
                </Text>
              )}
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}
