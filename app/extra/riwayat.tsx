import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  BackHandler,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button"; // Re-added Button import
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

// Type for today's attendance status
type TodaysAttendance = {
  hasClockedIn: boolean;
  hasClockedOut: boolean;
};

// Types for Invoice/Monthly History
type InvoiceStatus = "Pending" | "Unpaid" | "Paid";
type PaymentMethod = "Bank Transfer" | "Credit Card" | "PayPal" | "N/A"; // Added "N/A"
type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  date: string;
};

export default function Riwayat() {
  const user = useAuthStore((state) => state.user);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();

  const [activeView, setActiveView] = useState<"hariIni" | "bulanIni">(
    "hariIni",
  );
  const [todaysAttendance, setTodaysAttendance] = useState<TodaysAttendance>({
    hasClockedIn: false,
    hasClockedOut: false,
  });
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeView === "hariIni") {
      fetchTodaysAttendance();
    } else if (activeView === "bulanIni") {
      fetchInvoiceHistory(); // Or a more general monthly history function
    }
  }, [activeView, user]); // Add user to dependency array if its change should trigger refetch

  const fetchTodaysAttendance = async () => {
    setLoading(true);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayDateString = `${year}-${month}-${day}`;

    try {
      const { data, error } = await supabase
        .from("absences")
        .select("status")
        .eq("user_id", user.id)
        .eq("date", todayDateString);

      if (error) throw error;

      let hasClockedIn = false;
      let hasClockedOut = false;
      if (data) {
        for (const record of data) {
          if (record.status === "Datang") hasClockedIn = true;
          else if (record.status === "Pulang") hasClockedOut = true;
        }
      }
      setTodaysAttendance({ hasClockedIn, hasClockedOut });
    } catch (error) {
      // ... (error handling as before, adjusted message)
      console.error("Error fetching today's attendance:", error); // Removed unnecessary escape
      Alert.alert("Error", "Failed to load today's attendance data."); // Removed unnecessary escape
      setTodaysAttendance({ hasClockedIn: false, hasClockedOut: false });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceHistory = async (isFilterAction: boolean = false) => {
    setLoading(true);
    try {
      // Using absences table for monthly history for now, adjust as needed
      // This is a placeholder, ideally, you'd fetch actual invoices or aggregated monthly attendance
      const { data, error } = await supabase
        .from("absences") // Placeholder: change to 'invoices' or appropriate table
        .select("id, date, status, reason") // Adjust columns
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(20); // Example limit

      if (error) throw error;

      // Transform data if needed to fit InvoiceRecord structure or a new MonthlyAttendanceRecord structure
      // For this example, we'll map it somewhat, assuming 'reason' can be 'invoiceNumber' and 'status' is attendance status
      const mappedData: InvoiceRecord[] = data
        ? data.map((item: any) => ({
            id: item.id,
            invoiceNumber: item.reason || `Absen ${item.date}`, // Placeholder
            status:
              item.status === "Datang" || item.status === "Pulang"
                ? "Paid"
                : "Pending", // Placeholder mapping
            paymentMethod: "N/A", // Placeholder
            amount: 0, // Placeholder
            date: item.date,
          }))
        : [];
      setInvoiceHistory(mappedData);
      if (!mappedData || mappedData.length === 0) {
        // setInvoiceHistory([]); // Already handled by mapping to empty array
      }
    } catch (error) {
      // ... (error handling as before, adjusted message)
      console.error("Error fetching monthly history:", error); // Added console.error
      Alert.alert("Error", "Failed to load monthly history data.");
      setInvoiceHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [router]),
  );

  const renderHariIniView = () => (
    <ScrollView
      className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
      contentContainerClassName="grow p-4"
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={isDarkMode ? "#fff" : "hsl(var(--primary))"}
          />
        </View>
      ) : !todaysAttendance.hasClockedIn && !todaysAttendance.hasClockedOut ? (
        <View className="flex-1 items-center justify-center">
          <Text
            className={`text-lg font-semibold ${isDarkMode ? "text-gray-400" : "text-muted-foreground"}`}
          >
            Belum Ada Data
          </Text>
        </View>
      ) : (
        <View className="space-y-3">
          {todaysAttendance.hasClockedIn && (
            <View
              className={`flex-row justify-between items-center p-4 rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-card shadow-sm"}`}
            >
              <Text
                className={`text-base ${isDarkMode ? "text-gray-200" : "text-foreground"}`}
              >
                Sudah Absen Datang
              </Text>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={isDarkMode ? "#4ade80" : "#22c55e"}
              />
            </View>
          )}
          {todaysAttendance.hasClockedOut && (
            <View
              className={`flex-row justify-between items-center p-4 rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-card shadow-sm"}`}
            >
              <Text
                className={`text-base ${isDarkMode ? "text-gray-200" : "text-foreground"}`}
              >
                Sudah Absen Pulang
              </Text>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={isDarkMode ? "#4ade80" : "#22c55e"}
              />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderBulanIniView = () => (
    <>
      {/* Filter Buttons */}
      <View
        className={`flex-row p-4 space-x-2 items-center ${
          isDarkMode
            ? "bg-gray-900 border-b border-gray-700"
            : "bg-background border-b border-border"
        }`}
      >
        <Button
          variant="ghost"
          className="flex-1"
          onPress={() => console.log("Bulan filter pressed")}
        >
          <Text className={`${isDarkMode ? "text-white" : "text-foreground"}`}>
            Bulan: {new Date().toLocaleString("default", { month: "long" })}
          </Text>
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          onPress={() => console.log("Tahun filter pressed")}
        >
          <Text className={`${isDarkMode ? "text-white" : "text-foreground"}`}>
            Tahun: {new Date().getFullYear()}
          </Text>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onPress={() => fetchInvoiceHistory(true)} // true to indicate filter action
        >
          <Text className={`${isDarkMode ? "text-white" : "text-foreground"}`}>
            Tampilkan data
          </Text>
        </Button>
      </View>

      <ScrollView
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
        contentContainerClassName="grow p-4"
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator
              size="large"
              color={isDarkMode ? "#fff" : "hsl(var(--primary))"}
            />
          </View>
        ) : invoiceHistory.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text
              className={`text-lg font-semibold ${isDarkMode ? "text-gray-400" : "text-muted-foreground"}`}
            >
              Belum Ada Data
            </Text>
          </View>
        ) : (
          <View className="space-y-2">
            {invoiceHistory.map((record) => (
              <View
                key={record.id}
                className={`flex-row justify-between items-center p-3 rounded-lg shadow-sm ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
              >
                <Text
                  className={`w-1/3 font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}
                >
                  {record.invoiceNumber}
                </Text>
                <Text
                  className={`w-1/3 text-center ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                >
                  {record.status}
                </Text>
                <Text
                  className={`w-1/3 text-right ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                >
                  {record.paymentMethod}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom Header */}
      <View className={`p-4 ${isDarkMode ? "bg-gray-800" : "bg-black"}`}>
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="p-1 mr-2">
            <Ionicons name="arrow-back-outline" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-white text-center">
              Riwayat Absensi
            </Text>
          </View>
          <View style={{ width: 24 + 8 }} /> {/* Spacer for centering title */}
        </View>
        <View className="flex-row justify-around items-center">
          <TouchableOpacity
            className="items-center px-2 py-1"
            onPress={() => setActiveView("hariIni")}
          >
            <Ionicons
              name={activeView === "hariIni" ? "calendar" : "calendar-outline"}
              size={32}
              color="white"
            />
            <Text className="text-white mt-1 text-xs">Hari Ini</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="items-center px-2 py-1"
            onPress={() => setActiveView("bulanIni")}
          >
            <Ionicons
              name={activeView === "bulanIni" ? "calendar" : "calendar-outline"}
              size={32}
              color="white"
            />
            <Text className="text-white mt-1 text-xs">Bulan ini</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeView === "hariIni" ? renderHariIniView() : renderBulanIniView()}
    </SafeAreaView>
  );
}
