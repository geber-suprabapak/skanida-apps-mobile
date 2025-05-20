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

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

type InvoiceStatus = "Pending" | "Unpaid" | "Paid";

type PaymentMethod = "Bank Transfer" | "Credit Card" | "PayPal";

type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  amount: number; // Assuming amount might be needed later, though not in current display
  date: string; // This will be used for ordering
};

export default function Riwayat() {
  const user = useAuthStore((state) => state.user);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();

  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceRecord[]>([]); // Renamed state
  const [loading, setLoading] = useState(true);
  // Add state for filters if they become interactive
  // const [activeFilter, setActiveFilter] = useState<'day' | 'month'>('month');
  // const [selectedMonth, setSelectedMonth] = useState<string>('');
  // const [selectedYear, setSelectedYear] = useState<string>('');

  useEffect(() => {
    fetchInvoiceHistory(); // Renamed function call
  }, []);

  const fetchInvoiceHistory = async () => {
    // Renamed function
    setLoading(true);
    try {
      // console.log("Fetching invoice history for user ID:", user.id); // Keep for debugging if needed

      // Adjust Supabase query for invoices
      const { data, error } = await supabase
        .from("invoices") // Assuming 'invoices' table
        .select("id, invoiceNumber, status, paymentMethod, amount, date")
        .eq("user_id", user.id) // Assuming invoices are tied to a user
        .order("date", { ascending: false });

      if (error) {
        // console.error("Supabase query error:", error); // Keep for debugging
        throw error;
      }

      // console.log("Fetched records count:", data?.length || 0); // Keep for debugging
      if (data && data.length > 0) {
        setInvoiceHistory(data);
      } else {
        setInvoiceHistory([]);
      }
    } catch (error) {
      // console.error("Error fetching invoice history:", error); // Keep for debugging
      let errorMessage = "An unknown error occurred.";
      if (typeof error === "object" && error !== null) {
        if ("message" in error) {
          errorMessage = String(error.message);
        } else {
          try {
            errorMessage = JSON.stringify(error);
          } catch (e) {
            // If stringify fails, fallback to a generic message
            errorMessage = "Failed to stringify error object.";
          }
        }
      } else if (error !== undefined && error !== null) {
        errorMessage = String(error);
      }

      Alert.alert(
        "Error",
        `Failed to load invoice history: ${errorMessage}. Please try again later.`,
      );
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

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
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
          {/* Spacer to help center title if back button was absolutely positioned or for symmetry */}
          <View style={{ width: 24 + 8 }} />
        </View>
        <View className="flex-row justify-around items-center">
          <TouchableOpacity className="items-center px-2 py-1">
            <Ionicons name="calendar-outline" size={32} color="white" />
            <Text className="text-white mt-1 text-xs">Hari Ini</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center px-2 py-1">
            <Ionicons name="calendar-outline" size={32} color="white" />
            <Text className="text-white mt-1 text-xs">Bulan ini</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Buttons */}
      <View
        className={`flex-row p-4 space-x-2 items-center ${isDarkMode ? "bg-gray-900 border-b border-gray-700" : "bg-background border-b border-border"}`}
      >
        <Button
          variant="default"
          className={`flex-1 ${isDarkMode ? "" : "bg-black hover:bg-gray-800"}`}
          // onPress={() => { /* Handle Bulan filter */ }}
        >
          <Text
            className={`${isDarkMode ? "text-primary-foreground" : "text-white"}`}
          >
            Bulan
          </Text>
        </Button>
        <Button
          variant="default"
          className={`flex-1 ${isDarkMode ? "" : "bg-black hover:bg-gray-800"}`}
          // onPress={() => { /* Handle Tahun filter */ }}
        >
          <Text
            className={`${isDarkMode ? "text-primary-foreground" : "text-white"}`}
          >
            Tahun
          </Text>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onPress={fetchInvoiceHistory} // "Tampilkan data" can act as a refresh or apply filters
        >
          <Text
            className={`${isDarkMode ? "text-foreground" : "text-foreground"}`}
          >
            Tampilkan data
          </Text>
        </Button>
      </View>

      <ScrollView
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
        contentContainerClassName="grow"
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator
              size="large"
              color={isDarkMode ? "#fff" : "hsl(var(--primary))"}
            />
          </View>
        ) : invoiceHistory.length > 0 ? (
          <View className="px-4 py-3">
            {invoiceHistory.map((record) => (
              <View
                key={record.id}
                className={`flex-row justify-between items-center p-3 mb-2 rounded-lg shadow-sm ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
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
        ) : (
          <View className="flex-1 items-center justify-center py-10">
            <Text
              className={`text-lg font-semibold ${isDarkMode ? "text-gray-400" : "text-muted-foreground"}`}
            >
              Belum Ada Data
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
