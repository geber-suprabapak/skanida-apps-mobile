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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

// Helper function to format date

// Helper function to format time

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
  // const [showMonthPicker, setShowMonthPicker] = useState(false);
  // const [showYearPicker, setShowYearPicker] = useState(false);
  // const [selectedMonth, setSelectedMonth] = useState<number>(
  //   new Date().getMonth(),
  // );
  // const [selectedYear, setSelectedYear] = useState<number>(
  //   new Date().getFullYear(),
  // );
  useEffect(() => {
    if (activeView === "hariIni") {
      fetchTodaysAttendance();
    } else if (activeView === "bulanIni") {
      fetchAttendanceHistory();
    }
  }, [activeView, user]);
  const fetchTodaysAttendance = async () => {
    setLoading(true);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayDateString = `${year}-${month}-${day}`;

    try {
      // Check for attendance records in the attendance table
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("status, timestamp")
        .eq("user_id", user.id)
        .eq("date", todayDateString);

      if (attendanceError) throw attendanceError;

      let hasClockedIn = false;
      let hasClockedOut = false;

      if (attendanceData && attendanceData.length > 0) {
        for (const record of attendanceData) {
          if (record.status === "Datang") hasClockedIn = true;
          else if (record.status === "Pulang") hasClockedOut = true;
        }
      }

      // Check for leave requests (perizinan)
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
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth(); // Use current month
      const currentYear = currentDate.getFullYear(); // Use current year

      // Format the month and year for filtering
      const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;

      // Calculate end date (last day of month)
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      // Get attendance records from the attendance table
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("id, timestamp, date, status, reason, photo_url")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("timestamp", { ascending: true });

      if (attendanceError) throw attendanceError;

      // Get leave requests
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

      // Convert attendance data to AttendanceRecord format
      const attendanceRecords: AttendanceRecord[] = attendanceData
        ? attendanceData.map((item) => ({
            id: item.id,
            date: item.date,
            type: "Masuk",
            period: item.status as AttendancePeriod,
            description: item.reason || "",
            photo_url: item.photo_url,
          }))
        : [];

      // Convert leave data to AttendanceRecord format
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
      const combinedRecords = [...attendanceRecords, ...leaveRecords].sort(
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
  const renderHariIniView = () => (
    <ScrollView
      className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center py-10">
          <ActivityIndicator size="large" color="#0284c7" />
          <Text
            className={`mt-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
          >
            Memuat data absensi...
          </Text>
        </View>
      ) : (
        <View>
          <View
            className={`p-4 rounded-lg mb-4 ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
          >
            <Text
              className={`text-lg font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}
            >
              Status Absensi Hari Ini
            </Text>

            {/* Today's date */}
            <Text
              className={`mb-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
            >
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>

            {/* Attendance Status Cards */}
            <View className="flex-row justify-between mb-3">
              {/* Clock In Status */}
              <View
                className={`flex-1 mr-2 p-3 rounded-lg ${
                  todaysAttendance.hasClockedIn ? "bg-green-100" : "bg-gray-100"
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={
                      todaysAttendance.hasClockedIn
                        ? "checkmark-circle"
                        : "time-outline"
                    }
                    size={24}
                    color={
                      todaysAttendance.hasClockedIn ? "#16a34a" : "#9ca3af"
                    }
                  />
                  <Text
                    className={`ml-2 font-semibold ${todaysAttendance.hasClockedIn ? "text-green-700" : "text-gray-500"}`}
                  >
                    Absen Masuk
                  </Text>
                </View>
                <Text
                  className={`text-xs mt-1 ${todaysAttendance.hasClockedIn ? "text-green-700" : "text-gray-500"}`}
                >
                  {todaysAttendance.hasClockedIn
                    ? "Sudah Absen"
                    : "Belum Absen"}
                </Text>
              </View>

              {/* Clock Out Status */}
              <View
                className={`flex-1 ml-2 p-3 rounded-lg ${
                  todaysAttendance.hasClockedOut
                    ? "bg-green-100"
                    : "bg-gray-100"
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={
                      todaysAttendance.hasClockedOut
                        ? "checkmark-circle"
                        : "time-outline"
                    }
                    size={24}
                    color={
                      todaysAttendance.hasClockedOut ? "#16a34a" : "#9ca3af"
                    }
                  />
                  <Text
                    className={`ml-2 font-semibold ${todaysAttendance.hasClockedOut ? "text-green-700" : "text-gray-500"}`}
                  >
                    Absen Pulang
                  </Text>
                </View>
                <Text
                  className={`text-xs mt-1 ${todaysAttendance.hasClockedOut ? "text-green-700" : "text-gray-500"}`}
                >
                  {todaysAttendance.hasClockedOut
                    ? "Sudah Absen"
                    : "Belum Absen"}
                </Text>
              </View>
            </View>

            {/* Leave Request Status */}
            {todaysAttendance.hasLeaveRequest && (
              <View
                className={`mt-3 p-3 rounded-lg ${
                  approvalStatus === "approved"
                    ? "bg-blue-100"
                    : approvalStatus === "rejected"
                      ? "bg-red-100"
                      : "bg-yellow-100"
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={
                      approvalStatus === "approved"
                        ? "checkmark-circle"
                        : approvalStatus === "rejected"
                          ? "close-circle"
                          : "alert-circle"
                    }
                    size={24}
                    color={
                      approvalStatus === "approved"
                        ? "#1e40af"
                        : approvalStatus === "rejected"
                          ? "#b91c1c"
                          : "#d97706"
                    }
                  />
                  <Text
                    className={`ml-2 font-semibold ${
                      approvalStatus === "approved"
                        ? "text-blue-800"
                        : approvalStatus === "rejected"
                          ? "text-red-800"
                          : "text-yellow-800"
                    }`}
                  >
                    Perizinan ({todaysAttendance.leaveType})
                  </Text>
                </View>
                <Text
                  className={`text-xs mt-1 ${
                    approvalStatus === "approved"
                      ? "text-blue-800"
                      : approvalStatus === "rejected"
                        ? "text-red-800"
                        : "text-yellow-800"
                  }`}
                >
                  Status:{" "}
                  {approvalStatus === "approved"
                    ? "Disetujui"
                    : approvalStatus === "rejected"
                      ? "Ditolak"
                      : "Menunggu Persetujuan"}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            {!todaysAttendance.hasLeaveRequest && (
              <View className="mt-4">
                {!todaysAttendance.hasClockedIn && (
                  <TouchableOpacity
                    className="bg-blue-600 py-3 px-4 rounded-lg"
                    onPress={() => router.push("/attendance/AbsenceReport")}
                  >
                    <Text className="text-white font-semibold text-center">
                      Absen Masuk
                    </Text>
                  </TouchableOpacity>
                )}

                {todaysAttendance.hasClockedIn &&
                  !todaysAttendance.hasClockedOut && (
                    <TouchableOpacity
                      className="bg-green-600 py-3 px-4 rounded-lg"
                      onPress={() => router.push("/attendance/AbsenceReport")}
                    >
                      <Text className="text-white font-semibold text-center">
                        Absen Pulang
                      </Text>
                    </TouchableOpacity>
                  )}

                {todaysAttendance.hasClockedIn &&
                  todaysAttendance.hasClockedOut && (
                    <View className="bg-gray-200 py-3 px-4 rounded-lg">
                      <Text className="text-gray-500 font-semibold text-center">
                        Absensi Hari Ini Selesai
                      </Text>
                    </View>
                  )}
              </View>
            )}
          </View>

          {/* Create permission request link */}
          {!todaysAttendance.hasLeaveRequest && (
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row items-center justify-between mb-4 ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
              onPress={() => router.push("/perizinan")}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={isDarkMode ? "#60a5fa" : "#2563eb"}
                />
                <Text
                  className={`ml-2 font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  Buat Perizinan
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDarkMode ? "#9ca3af" : "#6b7280"}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  ); // Function to group attendance records by date
  const groupAttendanceByDate = (records: AttendanceRecord[]) => {
    const groupedData: Record<string, AttendanceRecord[]> = {};

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // Use current month
    const currentYear = currentDate.getFullYear(); // Use current year

    // Get all dates in the month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      groupedData[dateStr] = [];
    }

    // Add records to their dates
    records.forEach((record) => {
      if (record.date in groupedData) {
        groupedData[record.date].push(record);
      } else {
        groupedData[record.date] = [record];
      }
    });

    return groupedData;
  };

  // Render attendance item
  const renderAttendanceItem = ({
    date,
    records,
  }: {
    date: string;
    records: AttendanceRecord[];
  }) => {
    // Sort records: Datang first, then Pulang, then leave requests
    const sortedRecords = [...records].sort((a, b) => {
      if (a.type === "Masuk" && a.period === "Datang") return -1;
      if (b.type === "Masuk" && b.period === "Datang") return 1;
      if (a.type === "Masuk" && a.period === "Pulang") return -1;
      if (b.type === "Masuk" && b.period === "Pulang") return 1;
      return 0;
    });

    // Find clock in and out records
    const clockInRecord = sortedRecords.find(
      (r) => r.type === "Masuk" && r.period === "Datang",
    );
    const clockOutRecord = sortedRecords.find(
      (r) => r.type === "Masuk" && r.period === "Pulang",
    );

    // Find leave request
    const leaveRecord = sortedRecords.find(
      (r) => r.type === "Izin" || r.type === "Sakit",
    );

    const formattedDate = new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });

    const dayName = new Date(date).toLocaleDateString("id-ID", {
      weekday: "short",
    });

    const isToday = date === new Date().toISOString().split("T")[0];

    return (
      <TouchableOpacity
        className={`flex-row p-4 rounded-lg mb-2 ${isDarkMode ? "bg-gray-800" : "bg-white"} ${isToday ? (isDarkMode ? "border border-blue-700" : "border border-blue-500") : ""}`}
        onPress={() => {
          if (records.length > 0) {
            setSelectedRecord(records[0]);
            setShowDetailModal(true);
          }
        }}
      >
        {/* Date column */}
        <View
          className="items-center justify-center pr-4 border-r border-gray-200 mr-4"
          style={{ width: 60 }}
        >
          <Text
            className={`font-bold text-lg ${isDarkMode ? "text-white" : "text-gray-800"} ${isToday ? "text-blue-600" : ""}`}
          >
            {formattedDate.split(" ")[0]}
          </Text>
          <Text
            className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"} ${isToday ? "text-blue-600" : ""}`}
          >
            {formattedDate.split(" ")[1]}
          </Text>
          <Text
            className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"} ${isToday ? "text-blue-600" : ""}`}
          >
            {dayName}
          </Text>
        </View>

        {/* Status column */}
        <View className="flex-1">
          {records.length === 0 ? (
            <View className="flex-row items-center">
              <Ionicons name="alert-circle-outline" size={18} color="#9ca3af" />
              <Text className="ml-2 text-gray-500">Belum ada data</Text>
            </View>
          ) : leaveRecord ? (
            // If there's a leave request
            <View>
              <View className="flex-row items-center">
                <Ionicons
                  name={
                    leaveRecord.type === "Sakit"
                      ? "medical-outline"
                      : "document-text-outline"
                  }
                  size={18}
                  color={leaveRecord.type === "Sakit" ? "#e11d48" : "#2563eb"}
                />
                <Text
                  className={`ml-2 font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  {leaveRecord.type === "Sakit" ? "Sakit" : "Izin"}
                </Text>

                {leaveRecord.approval_status && (
                  <View
                    className={`ml-2 px-2 py-1 rounded-full ${
                      leaveRecord.approval_status === "approved"
                        ? "bg-green-100"
                        : leaveRecord.approval_status === "rejected"
                          ? "bg-red-100"
                          : "bg-yellow-100"
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        leaveRecord.approval_status === "approved"
                          ? "text-green-800"
                          : leaveRecord.approval_status === "rejected"
                            ? "text-red-800"
                            : "text-yellow-800"
                      }`}
                    >
                      {leaveRecord.approval_status === "approved"
                        ? "Disetujui"
                        : leaveRecord.approval_status === "rejected"
                          ? "Ditolak"
                          : "Pending"}
                    </Text>
                  </View>
                )}
              </View>

              {leaveRecord.description && (
                <Text
                  className={`mt-1 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
                  numberOfLines={1}
                >
                  {leaveRecord.description}
                </Text>
              )}
            </View>
          ) : (
            // If there are attendance records
            <View>
              <View className="flex-row items-center">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#16a34a"
                />
                <Text
                  className={`ml-2 font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  Hadir
                </Text>
              </View>

              <View className="flex-row items-center mt-1">
                {clockInRecord && (
                  <View className="flex-row items-center">
                    <Text
                      className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Masuk:
                    </Text>
                    <Text
                      className={`ml-1 text-xs font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
                    >
                      {clockInRecord.date && clockInRecord.date.includes("T")
                        ? new Date(clockInRecord.date).toLocaleTimeString(
                            "id-ID",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : "N/A"}
                    </Text>
                  </View>
                )}

                {clockOutRecord && (
                  <View className="flex-row items-center ml-3">
                    <Text
                      className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Pulang:
                    </Text>
                    <Text
                      className={`ml-1 text-xs font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
                    >
                      {clockOutRecord.date && clockOutRecord.date.includes("T")
                        ? new Date(clockOutRecord.date).toLocaleTimeString(
                            "id-ID",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : "N/A"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={isDarkMode ? "#9ca3af" : "#6b7280"}
        />
      </TouchableOpacity>
    );
  };

  // Render detail modal
  const renderDetailModal = () => {
    if (!selectedRecord) return null;

    return (
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          className="bg-black bg-opacity-50 justify-end"
          activeOpacity={1}
          onPress={() => setShowDetailModal(false)}
        >
          <View
            className={`p-4 rounded-t-3xl ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
            style={{ maxHeight: "80%" }}
            onStartShouldSetResponder={() => true}
          >
            <View className="items-center mb-4">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>

            <Text
              className={`text-xl font-bold mb-4 ${isDarkMode ? "text-white" : "text-gray-800"}`}
            >
              Detail Absensi
            </Text>

            <View
              className={`p-4 mb-3 rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}
            >
              {/* Date */}
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                >
                  Tanggal:
                </Text>
                <Text
                  className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  {new Date(selectedRecord.date).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>

              {/* Type */}
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                >
                  Jenis:
                </Text>
                <Text
                  className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  {selectedRecord.type === "Masuk"
                    ? `Absensi ${selectedRecord.period}`
                    : selectedRecord.type}
                </Text>
              </View>

              {/* Status */}
              {selectedRecord.approval_status && (
                <View className="flex-row justify-between mb-3">
                  <Text
                    className={`font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                  >
                    Status:
                  </Text>
                  <View
                    className={`px-2 py-1 rounded-full ${
                      selectedRecord.approval_status === "approved"
                        ? "bg-green-100"
                        : selectedRecord.approval_status === "rejected"
                          ? "bg-red-100"
                          : "bg-yellow-100"
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        selectedRecord.approval_status === "approved"
                          ? "text-green-800"
                          : selectedRecord.approval_status === "rejected"
                            ? "text-red-800"
                            : "text-yellow-800"
                      }`}
                    >
                      {selectedRecord.approval_status === "approved"
                        ? "Disetujui"
                        : selectedRecord.approval_status === "rejected"
                          ? "Ditolak"
                          : "Menunggu Persetujuan"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Timestamp */}
              {selectedRecord.date && selectedRecord.date.includes("T") && (
                <View className="flex-row justify-between mb-3">
                  <Text
                    className={`font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                  >
                    Waktu:
                  </Text>
                  <Text
                    className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}
                  >
                    {new Date(selectedRecord.date).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </Text>
                </View>
              )}

              {/* Description */}
              {selectedRecord.description && (
                <View className="mb-3">
                  <Text
                    className={`font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                  >
                    Keterangan:
                  </Text>
                  <Text
                    className={`${isDarkMode ? "text-white" : "text-gray-800"}`}
                  >
                    {selectedRecord.description}
                  </Text>
                </View>
              )}
            </View>

            {/* Photo if available */}
            {selectedRecord.photo_url && (
              <View className="items-center mb-4">
                <Text
                  className={`font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
                >
                  Foto:
                </Text>
                <Image
                  source={{ uri: selectedRecord.photo_url }}
                  className="w-full h-56 rounded-lg"
                  resizeMode="cover"
                />
              </View>
            )}

            <Button
              onPress={() => setShowDetailModal(false)}
              variant="secondary"
              className="mt-2"
            >
              Tutup
            </Button>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderBulanIniView = () => {
    // Group attendance by date
    const groupedAttendance = groupAttendanceByDate(attendanceHistory);

    // Convert to array for rendering
    const attendanceByDate = Object.entries(groupedAttendance)
      .map(([date, records]) => ({ date, records }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <View
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
      >
        {/* Month/Year Selector */}
        <View
          className={`p-4 flex-row justify-between items-center ${isDarkMode ? "bg-gray-800" : "bg-white"} mb-2`}
        >
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#0284c7" />
            <Text
              className={`mt-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
            >
              Memuat riwayat absensi...
            </Text>
          </View>
        ) : (
          <FlatList
            data={attendanceByDate}
            keyExtractor={(item) => item.date}
            renderItem={({ item }) => renderAttendanceItem(item)}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-10">
                <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
                <Text
                  className={`mt-4 font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                >
                  Tidak ada data absensi
                </Text>
                <Text
                  className={`mt-2 text-center ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}
                >
                  Belum ada riwayat absensi untuk bulan ini
                </Text>
              </View>
            }
          />
        )}
      </View>
    );
  };
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

      {/* View Toggler */}
      <View
        className={`flex-row p-1 rounded-lg m-4 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}
      >
        <TouchableOpacity
          className={`flex-1 py-2 px-4 rounded-md items-center justify-center ${
            activeView === "hariIni"
              ? isDarkMode
                ? "bg-blue-600"
                : "bg-blue-500"
              : ""
          }`}
          onPress={() => setActiveView("hariIni")}
        >
          <Text
            className={`${
              activeView === "hariIni"
                ? "text-white"
                : isDarkMode
                  ? "text-gray-300"
                  : "text-gray-700"
            } font-medium`}
          >
            Hari Ini
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 px-4 rounded-md items-center justify-center ${
            activeView === "bulanIni"
              ? isDarkMode
                ? "bg-blue-600"
                : "bg-blue-500"
              : ""
          }`}
          onPress={() => setActiveView("bulanIni")}
        >
          <Text
            className={`${
              activeView === "bulanIni"
                ? "text-white"
                : isDarkMode
                  ? "text-gray-300"
                  : "text-gray-700"
            } font-medium`}
          >
            Bulan Ini
          </Text>
        </TouchableOpacity>
      </View>

      {activeView === "hariIni" ? renderHariIniView() : renderBulanIniView()}

      {/* Detail modal */}
      {renderDetailModal()}
    </SafeAreaView>
  );
}
