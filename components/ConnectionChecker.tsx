import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { WifiOff, RefreshCw } from "lucide-react-native";

interface ConnectionCheckerProps {
  children: React.ReactNode;
}

interface ConnectionContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  connectionType: string;
  isRetrying?: boolean;
  retryConnection?: () => Promise<void>;
  toggleForceOffline?: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnected: true, // Optimistic default so app renders immediately
  isInternetReachable: true,
  connectionType: "unknown",
});

export const useConnection = () => useContext(ConnectionContext);

export function TopOfflineBanner({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.offlineBanner,
        { paddingTop: Math.max(insets.top, 8) + 4 },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.bannerContent}>
        <View style={styles.bannerLeft}>
          <WifiOff size={16} color="#FFFFFF" />
          <Text style={styles.bannerText}>Tidak ada koneksi internet</Text>
        </View>
        <TouchableOpacity
          onPress={onRetry}
          disabled={isRetrying}
          style={styles.retryButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Coba Lagi"
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.retryRow}>
              <RefreshCw size={12} color="#FFFFFF" />
              <Text style={styles.retryText}>Coba Lagi</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ConnectionChecker({
  children,
}: ConnectionCheckerProps) {
  const [forceOffline, setForceOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [connectionState, setConnectionState] = useState({
    isConnected: true,
    isInternetReachable: true,
    connectionType: "unknown",
  });

  const toggleForceOffline = useCallback(() => {
    if (__DEV__) {
      setForceOffline((prev) => !prev);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    setIsRetrying(true);
    try {
      const state = await NetInfo.fetch();
      const isConnected =
        state.isConnected === true &&
        (state.isInternetReachable === true ||
          state.isInternetReachable === null) &&
        !forceOffline;

      setConnectionState({
        isConnected,
        isInternetReachable: state.isInternetReachable ?? false,
        connectionType: state.type || "unknown",
      });
    } finally {
      setIsRetrying(false);
    }
  }, [forceOffline]);

  useEffect(() => {
    checkConnection();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnectedComputed =
        state.isConnected === true &&
        (state.isInternetReachable === true ||
          state.isInternetReachable === null) &&
        !forceOffline;

      setConnectionState({
        isConnected: isConnectedComputed,
        isInternetReachable: state.isInternetReachable ?? false,
        connectionType: state.type || "unknown",
      });
    });

    return () => unsubscribe();
  }, [checkConnection, forceOffline]);

  const isOffline = !connectionState.isConnected;

  const contextValue = useMemo(
    () => ({
      ...connectionState,
      isRetrying,
      retryConnection: checkConnection,
      toggleForceOffline,
    }),
    [connectionState, isRetrying, checkConnection, toggleForceOffline],
  );

  return (
    <ConnectionContext.Provider value={contextValue}>
      <View style={styles.container}>
        {children}
        {isOffline && (
          <TopOfflineBanner onRetry={checkConnection} isRetrying={isRetrying} />
        )}
      </View>
    </ConnectionContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#DC2626",
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  bannerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
