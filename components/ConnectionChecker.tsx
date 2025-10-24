import React, {
  useEffect,
  useRef,
  createContext,
  useContext,
  useState,
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
  isConnected: false,
  isInternetReachable: false,
  connectionType: "unknown",
});

export const useConnection = () => useContext(ConnectionContext);

export default function ConnectionChecker({
  children,
}: ConnectionCheckerProps) {
  const isShowingAlert = useRef(false);
  const isMounted = useRef(false);
  const hasShownAlphaAlert = useRef(false);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionContextType>(
    {
      isConnected: false,
      isInternetReachable: false,
      connectionType: "unknown",
    },
  );

  const toggleForceOffline = () => {
    if (__DEV__) {
      setForceOffline((prev) => !prev);
    }
  };

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
                } else {
                  // If connection is restored, show the alpha alert
                  showAlphaReleaseAlert();
                  setIsInitialCheckDone(true);
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

    const showAlphaReleaseAlert = () => {
      if (hasShownAlphaAlert.current) return;
      hasShownAlphaAlert.current = true;
      Alert.alert(
        "🚧 Alpha Release",
        "Aplikasi ini masih dalam tahap pengembangan (alpha). Fitur dan data dapat berubah sewaktu-waktu. Mohon laporkan bug atau masukan ke tim pengembang. Terima kasih atas partisipasinya!",
        [{ text: "Saya Mengerti", style: "default" }],
        { cancelable: true },
      );
    };

    // Initial connection check with multiple attempts
    const checkInitialConnection = async () => {
      try {
        const state = await NetInfo.fetch();

        const isConnected =
          state.isConnected === true &&
          (state.isInternetReachable === true ||
            state.isInternetReachable === null) &&
          !forceOffline;
        const connectionType = state.type || "unknown";

        // Update connection state
        setConnectionState({
          isConnected: !!state.isConnected && !forceOffline,
          isInternetReachable: !!state.isInternetReachable,
          connectionType,
        });

        // Show alert if offline on initial load
        if (!isConnected) {
          // Show alert immediately on app start if no internet
          setTimeout(() => {
            if (isMounted.current) {
              showOfflineAlert();
            }
          }, 1000); // Reduced delay for faster response
        } else {
          showAlphaReleaseAlert();
          setIsInitialCheckDone(true);
        }
      } catch {
        // If we can't check connection, assume offline and show alert
        setTimeout(() => {
          if (isMounted.current) showOfflineAlert();
        }, 1000);
      }
    };

    checkInitialConnection();

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Compute connection status
      const isConnectedComputed =
        state.isConnected === true &&
        (state.isInternetReachable === true ||
          state.isInternetReachable === null) &&
        !forceOffline;
      const connectionType = state.type || "unknown";

      // Update connection state
      setConnectionState({
        isConnected: isConnectedComputed,
        isInternetReachable: !!state.isInternetReachable,
        connectionType,
      });

      // Handle offline/online transitions
      if (!isConnectedComputed) {
        if (isMounted.current && !isShowingAlert.current) {
          showOfflineAlert();
        }
      } else {
        // Reset alert flag and show alpha release if needed
        isShowingAlert.current = false;
        if (isMounted.current && !hasShownAlphaAlert.current) {
          showAlphaReleaseAlert();
        }
        if (!isInitialCheckDone) {
          setIsInitialCheckDone(true);
        }
      }
    });

    // Cleanup subscription on unmount
    return () => {
      isMounted.current = false;
      isShowingAlert.current = false;
      unsubscribe();
    };
  }, [isInitialCheckDone, forceOffline]);

  return (
    <ConnectionContext.Provider
      value={{ ...connectionState, toggleForceOffline }}
    >
      {isInitialCheckDone ? children : null}
    </ConnectionContext.Provider>
  );
}
