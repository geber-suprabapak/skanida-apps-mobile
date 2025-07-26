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
  const [connectionState, setConnectionState] = useState<ConnectionContextType>(
    {
      isConnected: false,
      isInternetReachable: false,
      connectionType: "unknown",
    },
  );

  useEffect(() => {
    console.log("🔍 ConnectionChecker mounted");
    console.log("🔍 ConnectionChecker starting...");
    isMounted.current = true;

    // Add a simple test to verify alert works
    const testAlert = () => {
      console.log("🧪 Test alert function");
      Alert.alert("Test", "ConnectionChecker is working!", [
        { text: "OK", onPress: () => console.log("Test alert dismissed") },
      ]);
    };

    // Call test alert after 3 seconds (REMOVE THIS AFTER TESTING)
    setTimeout(testAlert, 3000);

    const showOfflineAlert = () => {
      if (!isMounted.current || isShowingAlert.current) {
        console.log("⚠️ Alert skipped - unmounted or already showing");
        return;
      }

      console.log("🚨 Showing offline alert - No internet connection");
      isShowingAlert.current = true;

      Alert.alert(
        "🚫 Tidak Ada Koneksi Internet",
        "Aplikasi ini memerlukan koneksi internet untuk berfungsi. Silakan periksa koneksi internet Anda dan coba lagi.",
        [
          {
            text: "Coba Lagi",
            onPress: () => {
              console.log("🔄 User clicked 'Coba Lagi'");
              isShowingAlert.current = false;
              // Check connection again after user taps "Coba Lagi"
              NetInfo.fetch().then((state) => {
                console.log("🔍 Rechecking connection:", {
                  isConnected: state.isConnected,
                  isInternetReachable: state.isInternetReachable,
                  type: state.type,
                });
                const isConnected =
                  state.isConnected && state.isInternetReachable;
                if (!isConnected) {
                  // Still offline, show alert again
                  console.log("❌ Still offline, showing alert again");
                  setTimeout(() => {
                    if (isMounted.current) showOfflineAlert();
                  }, 500);
                } else {
                  console.log("✅ Connection restored!");
                }
              });
            },
          },
          {
            text: "Keluar",
            style: "destructive",
            onPress: () => {
              console.log("❌ User clicked 'Keluar'");
              isShowingAlert.current = false;
              BackHandler.exitApp();
            },
          },
        ],
        {
          cancelable: false, // Prevent dismissing without action
        },
      );
    };

    // Initial connection check with multiple attempts
    const checkInitialConnection = async () => {
      try {
        console.log("🔍 Performing initial connection check...");
        const state = await NetInfo.fetch();
        console.log("🔍 Initial connection result:", {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
          details: state.details,
        });

        const isConnected = state.isConnected && state.isInternetReachable;
        const connectionType = state.type || "unknown";

        // Update connection state
        setConnectionState({
          isConnected: !!state.isConnected,
          isInternetReachable: !!state.isInternetReachable,
          connectionType,
        });

        // Show alert if offline on initial load
        if (!isConnected) {
          console.log("🚨 No connection detected on initial load");
          // Use longer delay to ensure everything is mounted properly
          setTimeout(() => {
            if (isMounted.current) {
              console.log("🚨 About to show initial offline alert");
              showOfflineAlert();
            }
          }, 2000); // Increased delay
        } else {
          console.log("✅ Connection available on initial load");
        }
      } catch (error) {
        console.error("❌ Error checking initial connection:", error);
        // If we can't check connection, assume offline
        setTimeout(() => showOfflineAlert(), 2000);
      }
    };

    checkInitialConnection();

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log("🔍 Network state changed:", {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });

      const isConnected = state.isConnected && state.isInternetReachable;
      const connectionType = state.type || "unknown";

      console.log("🔍 Computed connection status:", {
        isConnected,
        connectionType,
      });

      // Update connection state
      setConnectionState({
        isConnected: !!state.isConnected,
        isInternetReachable: !!state.isInternetReachable,
        connectionType,
      });

      // Check connection and show alert if offline
      if (!isConnected) {
        console.log("🚨 Connection lost, showing alert");
        if (isMounted.current) {
          showOfflineAlert();
        }
      } else {
        console.log("✅ Connection restored");
        // Connection restored, close any existing alert
        isShowingAlert.current = false;
      }
    });

    // Cleanup subscription on unmount
    return () => {
      console.log("🔍 ConnectionChecker unmounting");
      isMounted.current = false;
      isShowingAlert.current = false;
      unsubscribe();
    };
  }, []);

  return (
    <ConnectionContext.Provider value={connectionState}>
      {children}
    </ConnectionContext.Provider>
  );
}
