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
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

// Type for today's attendance status
type TodaysAttendance = {
  hasClockedIn: boolean;
  hasClockedOut: boolean;
  hasLeaveRequest: boolean;
  leaveType: string | null;
};

// Types for Attendance History
type AttendanceType = "Masuk" | "Izin" | "Sakit";
type AttendancePeriod = "Datang" | "Pulang" | null;
type ApprovalStatus = "pending" | "approved" | "rejected";
type AttendanceRecord = {
  id: string;
  date: string;
  type: AttendanceType;
  period: AttendancePeriod;
  description?: string;
  photo_url?: string;
  approval_status?: ApprovalStatus;
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
    hasLeaveRequest: false,
    leaveType: null,
  });
  const [approvalStatus, setApprovalStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);
  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth(),
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  useEffect(() => {
    if (activeView === "hariIni") {
      fetchTodaysAttendance();
    } else if (activeView === "bulanIni") {
      fetchAttendanceHistory();
    }
  }, [activeView, user, selectedMonth, selectedYear]);

  const fetchTodaysAttendance = async () => {
    setLoading(true);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayDateString = `${year}-${month}-${day}`;

    try {
      // Check for attendance records
      const { data: absenceData, error: absenceError } = await supabase
        .from("absences")
        .select("status")
        .eq("user_id", user.id)
        .eq("date", todayDateString);

      if (absenceError) throw absenceError;

      let hasClockedIn = false;
      let hasClockedOut = false;

      if (absenceData && absenceData.length > 0) {
        for (const record of absenceData) {
          if (record.status === "Datang") hasClockedIn = true;
          else if (record.status === "Pulang") hasClockedOut = true;
        }
      } // Check for leave requests (perizinan)
      const { data: leaveData, error: leaveError } = await supabase
        .from("perizinan")
        .select("kategori_izin, approval_status")
        .eq("user_id", user.id)
        .eq("tanggal", todayDateString);

      if (leaveError) throw leaveError;

      const hasLeaveRequest = leaveData && leaveData.length > 0;
      const leaveType = hasLeaveRequest ? leaveData[0].kategori_izin : null;

      // Set approval status for UI indicators
      if (hasLeaveRequest && leaveData && leaveData.length > 0) {
        setApprovalStatus(
          leaveData[0].approval_status as "pending" | "approved" | "rejected",
        );
      } else {
        setApprovalStatus(null);
      }

      setTodaysAttendance({
        hasClockedIn,
        hasClockedOut,
        hasLeaveRequest,
        leaveType,
      });
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
      Alert.alert("Error", "Failed to load today's attendance data.");
      setTodaysAttendance({
        hasClockedIn: false,
        hasClockedOut: false,
        hasLeaveRequest: false,
        leaveType: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      // Format the month and year for filtering
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;

      // Calculate end date (last day of month)
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      // Removed console log for production

      // Get attendance records
      const { data: absenceData, error: absenceError } = await supabase
        .from("absences")
        .select("id, date, status, reason, photo_url")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (absenceError) throw absenceError; // Get leave requests
      const { data: leaveData, error: leaveError } = await supabase
        .from("perizinan")
        .select(
          "id, tanggal, kategori_izin, deskripsi, link_foto, approval_status",
        )
        .eq("user_id", user.id)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", { ascending: false });

      if (leaveError) throw leaveError;

      // Convert absence data to AttendanceRecord format
      const absenceRecords: AttendanceRecord[] = absenceData
        ? absenceData.map((item) => ({
            id: item.id,
            date: item.date,
            type: "Masuk",
            period: item.status as AttendancePeriod,
            description: item.reason || "",
            photo_url: item.photo_url,
          }))
        : []; // Convert leave data to AttendanceRecord format
      const leaveRecords: AttendanceRecord[] = leaveData
        ? leaveData.map((item) => ({
            id: item.id,
            date: item.tanggal,
            type: item.kategori_izin === "sakit" ? "Sakit" : "Izin",
            period: null,
            description: item.deskripsi || "",
            photo_url: item.link_foto,
            approval_status: item.approval_status || "pending",
          }))
        : [];

      // Combine and sort by date
      const combinedRecords = [...absenceRecords, ...leaveRecords].sort(
        (a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        },
      );

      setAttendanceHistory(combinedRecords);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      Alert.alert("Error", "Failed to load attendance history data.");
      setAttendanceHistory([]);
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

  const getStatusColor = (type: AttendanceType) => {
    if (isDarkMode) {
      return type === "Masuk"
        ? "#4ade80"
        : type === "Sakit"
          ? "#fcd34d"
          : "#f87171";
    }
    return type === "Masuk"
      ? "#22c55e"
      : type === "Sakit"
        ? "#eab308"
        : "#ef4444";
  };

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
      ) : !todaysAttendance.hasClockedIn &&
        !todaysAttendance.hasClockedOut &&
        !todaysAttendance.hasLeaveRequest ? (
        <View className="flex-1 items-center justify-center">
          <Text
            className={`text-lg font-semibold ${isDarkMode ? "text-gray-400" : "text-muted-foreground"}`}
          >
            Belum Ada Data
          </Text>
        </View>
      ) : (
        <View className="space-y-3">
          {" "}
          {todaysAttendance.hasLeaveRequest && (
            <View
              className={`flex-row justify-between items-center p-4 rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-card shadow-sm"}`}
            >
              <View>
                <Text
                  className={`text-base font-medium ${isDarkMode ? "text-gray-200" : "text-foreground"}`}
                >
                  {todaysAttendance.leaveType === "sakit" ? "Sakit" : "Izin"}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View
                    className={`h-2 w-2 rounded-full mr-2 ${
                      approvalStatus === "approved"
                        ? "bg-green-500"
                        : approvalStatus === "rejected"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                    }`}
                  />
                  <Text
                    className={`text-sm ${
                      approvalStatus === "approved"
                        ? isDarkMode
                          ? "text-green-400"
                          : "text-green-600"
                        : approvalStatus === "rejected"
                          ? isDarkMode
                            ? "text-red-400"
                            : "text-red-600"
                          : isDarkMode
                            ? "text-yellow-400"
                            : "text-yellow-600"
                    }`}
                  >
                    {approvalStatus === "approved"
                      ? "Disetujui"
                      : approvalStatus === "rejected"
                        ? "Ditolak"
                        : "Menunggu persetujuan"}
                  </Text>
                </View>
              </View>

              <View>
                <Ionicons
                  name={
                    todaysAttendance.leaveType === "sakit"
                      ? "medkit"
                      : "document-text"
                  }
                  size={24}
                  color={
                    todaysAttendance.leaveType === "sakit"
                      ? isDarkMode
                        ? "#fcd34d"
                        : "#eab308" // Yellow for sick
                      : isDarkMode
                        ? "#f87171"
                        : "#ef4444"
                  } // Red for permission
                />
              </View>
            </View>
          )}
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
          onPress={() => setShowMonthPicker(true)}
        >
          <Text className={`${isDarkMode ? "text-white" : "text-foreground"}`}>
            Bulan:{" "}
            {new Date(selectedYear, selectedMonth).toLocaleString("id-ID", {
              month: "long",
            })}
          </Text>
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          onPress={() => setShowYearPicker(true)}
        >
          <Text className={`${isDarkMode ? "text-white" : "text-foreground"}`}>
            Tahun: {selectedYear}
          </Text>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onPress={() => fetchAttendanceHistory()}
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
        ) : attendanceHistory.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text
              className={`text-lg font-semibold ${isDarkMode ? "text-gray-400" : "text-muted-foreground"}`}
            >
              Belum Ada Data
            </Text>
          </View>
        ) : (
          <View className="space-y-2">
            {attendanceHistory.map((record) => (
              <TouchableOpacity
                key={record.id}
                className={`flex-row justify-between items-center p-3 rounded-lg shadow-sm ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
                onPress={() => {
                  setSelectedRecord(record);
                  setShowDetailModal(true);
                }}
              >
                <View className="flex-1">
                  <Text
                    className={`font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}
                  >
                    {new Date(record.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                  <Text
                    className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                  >
                    {record.period
                      ? `${record.type} - ${record.period}`
                      : record.type}
                  </Text>
                  {/* Show approval status for leave requests */}
                  {(record.type === "Izin" || record.type === "Sakit") &&
                    record.approval_status && (
                      <View className="flex-row items-center mt-1">
                        <View
                          className={`h-2 w-2 rounded-full mr-2 ${
                            record.approval_status === "approved"
                              ? "bg-green-500"
                              : record.approval_status === "rejected"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}
                        />
                        <Text
                          className={`text-xs ${
                            record.approval_status === "approved"
                              ? isDarkMode
                                ? "text-green-400"
                                : "text-green-600"
                              : record.approval_status === "rejected"
                                ? isDarkMode
                                  ? "text-red-400"
                                  : "text-red-600"
                                : isDarkMode
                                  ? "text-yellow-400"
                                  : "text-yellow-600"
                          }`}
                        >
                          {record.approval_status === "approved"
                            ? "Disetujui"
                            : record.approval_status === "rejected"
                              ? "Ditolak"
                              : "Menunggu persetujuan"}
                        </Text>
                      </View>
                    )}
                </View>

                <View className="flex-row items-center">
                  {record.photo_url && (
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={isDarkMode ? "#a3a3a3" : "#6b7280"}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getStatusColor(record.type) }}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View
            className={`w-11/12 max-w-md rounded-lg ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <View className="flex-row justify-between items-center p-4 border-b">
              <Text
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
                Detail Kehadiran
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? "white" : "black"}
                />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <View className="p-4">
                <View className="flex-row mb-4">
                  <View className="flex-1">
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Tanggal
                    </Text>
                    <Text
                      className={`text-base font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}
                    >
                      {new Date(selectedRecord.date).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Status
                    </Text>
                    <Text
                      className="text-base font-medium"
                      style={{ color: getStatusColor(selectedRecord.type) }}
                    >
                      {selectedRecord.period
                        ? `${selectedRecord.type} - ${selectedRecord.period}`
                        : selectedRecord.type}
                    </Text>
                  </View>
                </View>

                {selectedRecord.description && (
                  <View className="mb-4">
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Keterangan
                    </Text>
                    <Text
                      className={`text-base ${isDarkMode ? "text-white" : "text-gray-800"}`}
                    >
                      {selectedRecord.description}
                    </Text>
                  </View>
                )}

                {/* Show approval status for leave requests */}
                {(selectedRecord.type === "Izin" ||
                  selectedRecord.type === "Sakit") && (
                  <View className="mb-4">
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Status Persetujuan
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <View
                        className={`w-3 h-3 rounded-full mr-2 ${
                          selectedRecord.approval_status === "approved"
                            ? "bg-green-500"
                            : selectedRecord.approval_status === "rejected"
                              ? "bg-red-500"
                              : "bg-yellow-500"
                        }`}
                      />
                      <Text
                        className={`${
                          selectedRecord.approval_status === "approved"
                            ? isDarkMode
                              ? "text-green-400"
                              : "text-green-600"
                            : selectedRecord.approval_status === "rejected"
                              ? isDarkMode
                                ? "text-red-400"
                                : "text-red-600"
                              : isDarkMode
                                ? "text-yellow-400"
                                : "text-yellow-600"
                        }`}
                      >
                        {selectedRecord.approval_status === "approved"
                          ? "Disetujui"
                          : selectedRecord.approval_status === "rejected"
                            ? "Ditolak"
                            : "Menunggu persetujuan"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View
            className={`w-11/12 max-w-md rounded-lg ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <View className="flex-row justify-between items-center p-4 border-b">
              <Text
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
                Pilih Bulan
              </Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? "white" : "black"}
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={Array.from({ length: 12 }, (_, i) => i)}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMonth(item);
                    setShowMonthPicker(false);
                    fetchAttendanceHistory();
                  }}
                  className={`p-4 ${isDarkMode ? "bg-gray-700" : "bg-white"} ${
                    item === selectedMonth ? "bg-primary bg-opacity-20" : ""
                  } border-b`}
                >
                  <Text
                    className={`text-center ${
                      item === selectedMonth
                        ? isDarkMode
                          ? "text-primary"
                          : "text-primary"
                        : isDarkMode
                          ? "text-white"
                          : "text-gray-800"
                    }`}
                  >
                    {new Date(selectedYear, item).toLocaleString("id-ID", {
                      month: "long",
                    })}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      {/* Year Picker Modal */}
      <Modal
        visible={showYearPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowYearPicker(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View
            className={`w-11/12 max-w-md rounded-lg ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <View className="flex-row justify-between items-center p-4 border-b">
              <Text
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
                Pilih Tahun
              </Text>
              <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? "white" : "black"}
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={Array.from(
                { length: 9 },
                (_, i) => new Date().getFullYear() - 1 + i,
              )}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedYear(item);
                    setShowYearPicker(false);
                    fetchAttendanceHistory();
                  }}
                  className={`p-4 ${isDarkMode ? "bg-gray-700" : "bg-white"} ${
                    item === selectedYear ? "bg-primary bg-opacity-20" : ""
                  } border-b`}
                >
                  <Text
                    className={`text-center ${
                      item === selectedYear
                        ? isDarkMode
                          ? "text-primary"
                          : "text-primary"
                        : isDarkMode
                          ? "text-white"
                          : "text-gray-800"
                    }`}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
