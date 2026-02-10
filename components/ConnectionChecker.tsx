import React, {
  useEffect,
  useRef,
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Alert, BackHandler } from "react-native";
import NetInfo from "@react-native-community/netinfo";

interface ConnectionCheckerProps {
  children: React.ReactNode;
}

interface ConnectionContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  connectionType: string;
  toggleForceOffline?: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnected: true, // PERF-C04: Default to true (optimistic) so app renders immediately
  isInternetReachable: true,
  connectionType: "unknown",
});

export const useConnection = () => useContext(ConnectionContext);

export default function ConnectionChecker({
  children,
}: ConnectionCheckerProps) {
  const isShowingAlert = useRef(false);
  const isMounted = useRef(false);
  const [forceOffline, setForceOffline] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionContextType>(
    {
      isConnected: true, // PERF-C04: Optimistic default
      isInternetReachable: true,
      connectionType: "unknown",
    },
  );

  const toggleForceOffline = useCallback(() => {
    if (__DEV__) {
      setForceOffline((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    const showOfflineAlert = () => {
      if (!isMounted.current || isShowingAlert.current) {
        return;
      }

      isShowingAlert.current = true;

      Alert.alert(
        "🚫 Tidak Ada Koneksi Internet",
        "Aplikasi ini memerlukan koneksi internet untuk berfungsi. Silakan periksa koneksi internet Anda dan coba lagi.",
        [
          {
            text: "Coba Lagi",
            onPress: () => {
              isShowingAlert.current = false;
              // Check connection again after user taps "Coba Lagi"
              NetInfo.fetch().then((state) => {
                const isConnected =
                  state.isConnected === true &&
                  (state.isInternetReachable === true ||
                    state.isInternetReachable === null) &&
                  !forceOffline;
                if (!isConnected) {
                  // Still offline, show alert again immediately
                  setTimeout(() => {
                    if (isMounted.current) showOfflineAlert();
                  }, 300);
                }
              });
            },
          },
          {
            text: "Keluar",
            onPress: () => BackHandler.exitApp(),
            style: "destructive",
          },
        ],
        {
          cancelable: false, // Prevent dismissing without action
        },
      );
    };

    // Initial connection check (non-blocking)
    NetInfo.fetch().then((state) => {
      if (!isMounted.current) return;

      const isConnected =
        state.isConnected === true &&
        (state.isInternetReachable === true ||
          state.isInternetReachable === null) &&
        !forceOffline;

      setConnectionState({
        isConnected: !!state.isConnected && !forceOffline,
        isInternetReachable: !!state.isInternetReachable,
        connectionType: state.type || "unknown",
      });

      if (!isConnected) {
        setTimeout(() => {
          if (isMounted.current) showOfflineAlert();
        }, 1000);
      }
    });

    // PERF-H09: Subscribe once, don't re-subscribe on state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnectedComputed =
        state.isConnected === true &&
        (state.isInternetReachable === true ||
          state.isInternetReachable === null) &&
        !forceOffline;

      setConnectionState({
        isConnected: isConnectedComputed,
        isInternetReachable: !!state.isInternetReachable,
        connectionType: state.type || "unknown",
      });

      if (!isConnectedComputed) {
        if (isMounted.current && !isShowingAlert.current) {
          showOfflineAlert();
        }
      } else {
        isShowingAlert.current = false;
      }
    });

    return () => {
      isMounted.current = false;
      isShowingAlert.current = false;
      unsubscribe();
    };
  }, [forceOffline]); // PERF-H09: Only re-subscribe when forceOffline changes

  // PERF-M03: Memoize context value to prevent unnecessary consumer re-renders
  const contextValue = useMemo(
    () => ({ ...connectionState, toggleForceOffline }),
    [connectionState, toggleForceOffline],
  );

  // PERF-C04: Always render children (non-blocking). Show alert overlay if offline.
  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
}
