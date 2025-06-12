/* eslint-disable prettier/prettier */
// ========== IMPORTS ==========
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { supabase } from "../../utils/supabase";
import useAuthStore from "../../store/authStore";
import { Button } from "../../components/ui/button";
import { useColorScheme } from "~/lib/useColorScheme";

// ========== TYPES ==========
type AttendanceType = "Masuk" | "Izin" | "Sakit";
type AttendancePeriod = "Datang" | "Pulang" | null;
type ApprovalStatus = "pending" | "approved" | "rejected";

interface AttendanceRecord {
  id: string;
  date: string;
  type: AttendanceType;
  period: AttendancePeriod;
  description?: string;
  photo_url?: string;
  approval_status?: ApprovalStatus;
  timestamp?: string;
}

interface TodaysAttendance {
  hasClockedIn: boolean;
  hasClockedOut: boolean;
  hasLeaveRequest: boolean;
  leaveType: string | null;
  approvalStatus: ApprovalStatus | null;
}

type ViewType = "hariIni" | "bulanIni";


// ========== UTILS ==========
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTime = (dateString: string): string => {
  if (!dateString || !dateString.includes("T")) return "N/A";
  return new Date(dateString).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDateRange = (year: number, month: number) => {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(
    lastDay,
  ).padStart(2, "0")}`;
  return { startDate, endDate };
};

// ========== CUSTOM HOOKS ==========
const useTodaysAttendance = (userId: string) => {
  const [data, setData] = useState<TodaysAttendance>({
    hasClockedIn: false,
    hasClockedOut: false,
    hasLeaveRequest: false,
    leaveType: null,
    approvalStatus: null,
  });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    const todayDateString = formatDate(new Date());

    try {
      // Parallel fetch for better performance
      const [attendanceResponse, leaveResponse] = await Promise.all([
        supabase
          .from("absences")
          .select("status, date")
          .eq("user_id", userId)
          .eq("date", todayDateString)
          .order("date", { ascending: true }),
        supabase
          .from("perizinan")
          .select("kategori_izin, approval_status")
          .eq("user_id", userId)
          .eq("tanggal", todayDateString),
      ]);

      if (attendanceResponse.error) throw attendanceResponse.error;
      if (leaveResponse.error) throw leaveResponse.error;      // Process attendance data - check all records
      let hasClockedIn = false;
      let hasClockedOut = false;

      if (attendanceResponse.data && attendanceResponse.data.length > 0) {
        attendanceResponse.data.forEach((record) => {
          // Check for various possible status values
          if (record.status === "Hadir") {
            hasClockedIn = true;
          } else if (record.status === "Pulang") {
            hasClockedOut = true;
          }
        });      }

      // Process leave data
      const hasLeaveRequest =
        leaveResponse.data && leaveResponse.data.length > 0;
      const leaveType = hasLeaveRequest
        ? leaveResponse.data[0].kategori_izin
        : null;
      const approvalStatus = hasLeaveRequest
        ? (leaveResponse.data[0].approval_status as ApprovalStatus)
        : null;

      setData({
        hasClockedIn,
        hasClockedOut,
        hasLeaveRequest,
        leaveType,
        approvalStatus,
      });
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
      Alert.alert("Error", "Failed to load today's attendance data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { data, loading, refetch: fetchData };
};

const useAttendanceHistory = (userId: string) => {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    const currentDate = new Date();
    const { startDate, endDate } = getDateRange(
      currentDate.getFullYear(),
      currentDate.getMonth(),
    );

    try {
      // Parallel fetch for better performance
      const [attendanceResponse, leaveResponse] = await Promise.all([
        supabase
          .from("absences")
          .select("id, date, status, reason, photo_url, created_at")
          .eq("user_id", userId)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false }),
        supabase
          .from("perizinan")
          .select(
            "id, tanggal, kategori_izin, deskripsi, link_foto, approval_status",
          )
          .eq("user_id", userId)
          .gte("tanggal", startDate)
          .lte("tanggal", endDate)
          .order("tanggal", { ascending: false }),
      ]);

      if (attendanceResponse.error) throw attendanceResponse.error;
      if (leaveResponse.error) throw leaveResponse.error;

      // Transform and combine data
      const attendanceRecords: AttendanceRecord[] = attendanceResponse.data
        ?.map((item) => ({
          id: item.id,
          date: item.date,
          type: "Masuk" as AttendanceType,
          period: item.status as AttendancePeriod,
          description: item.reason || "",
          photo_url: item.photo_url,
          timestamp: item.created_at,
        }))
        ?.reverse();

      const leaveRecords: AttendanceRecord[] = leaveResponse.data?.map(
        (item) => ({
          id: item.id,
          date: item.tanggal,
          type:
            item.kategori_izin === "sakit"
              ? "Sakit"
              : ("Izin" as AttendanceType),
          period: null,
          description: item.deskripsi || "",
          photo_url: item.link_foto,
          approval_status:
            item.approval_status || ("pending" as ApprovalStatus),
        }),
      );

      // Sort by date descending
      const combinedRecords = [...attendanceRecords, ...leaveRecords].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setData(combinedRecords);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      Alert.alert("Error", "Failed to load attendance history.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { data, loading, refetch: fetchData };
};

// ========== COMPONENTS ==========
const StatusCard = ({
  icon,
  title,
  status,
  isActive,
  color,
}: {
  icon: string;
  title: string;
  status: string;
  isActive: boolean;
  color: string;
}) => (
  <View
    className={`flex-1 p-3 rounded-lg ${
      isActive ? "bg-green-100" : "bg-gray-100"
    } mx-1`}
  >
    <View className="flex-row items-center">
      <Ionicons
        name={icon as any}
        size={24}
        color={isActive ? color : "#9ca3af"}
      />
      <Text
        className={`ml-2 font-semibold ${
          isActive ? "text-green-700" : "text-gray-500"
        }`}
      >
        {title}
      </Text>
    </View>
    <Text
      className={`text-xs mt-1 ${
        isActive ? "text-green-700" : "text-gray-500"
      }`}
    >
      {status}
    </Text>
  </View>
);

const LeaveStatusCard = ({
  leaveType,
  approvalStatus,
}: {
  leaveType: string;
  approvalStatus: ApprovalStatus;
}) => {
  const getStatusColor = () => {
    switch (approvalStatus) {
      case "approved":
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          icon: "#1e40af",
        };
      case "rejected":
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          icon: "#b91c1c",
        };
      default:
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          icon: "#d97706",
        };
    }
  };

  const getStatusText = () => {
    switch (approvalStatus) {
      case "approved":
        return "Disetujui";
      case "rejected":
        return "Ditolak";
      default:
        return "Menunggu Persetujuan";
    }
  };

  const colors = getStatusColor();

  return (
    <View className={`mt-3 p-3 rounded-lg ${colors.bg}`}>
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
          color={colors.icon}
        />
        <Text className={`ml-2 font-semibold ${colors.text}`}>
          Perizinan ({leaveType})
        </Text>
      </View>
      <Text className={`text-xs mt-1 ${colors.text}`}>
        Status: {getStatusText()}
      </Text>
    </View>
  );
};

const AttendanceItem = ({
  date,
  records,
  isDarkColorScheme,
  onPress,
}: {
  date: string;
  records: AttendanceRecord[];
  isDarkColorScheme: boolean;
  onPress: () => void;
}) => {
  const isToday = date === formatDate(new Date());
  const clockInRecord = records.find(
    (r) => r.type === "Masuk" && r.period === "Datang",
  );
  const clockOutRecord = records.find(
    (r) => r.type === "Masuk" && r.period === "Pulang",
  );
  const leaveRecord = records.find(
    (r) => r.type === "Izin" || r.type === "Sakit",
  );

  const formattedDate = new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

  const dayName = new Date(date).toLocaleDateString("id-ID", {
    weekday: "short",
  });

  return (
    <TouchableOpacity
      className={`flex-row p-4 rounded-lg mb-2 ${
        isDarkColorScheme ? "bg-gray-800" : "bg-white"
      } ${isToday ? (isDarkColorScheme ? "border border-blue-700" : "border border-blue-500") : ""}`}
      onPress={onPress}
    >
      {/* Date column */}
      <View
        className="items-center justify-center pr-4 border-r border-gray-200 mr-4"
        style={{ width: 60 }}
      >
        <Text
          className={`font-bold text-lg ${
            isDarkColorScheme ? "text-white" : "text-gray-800"
          } ${isToday ? "text-blue-600" : ""}`}
        >
          {formattedDate.split(" ")[0]}
        </Text>
        <Text
          className={`text-xs ${
            isDarkColorScheme ? "text-gray-400" : "text-gray-600"
          } ${isToday ? "text-blue-600" : ""}`}
        >
          {formattedDate.split(" ")[1]}
        </Text>
        <Text
          className={`text-xs mt-1 ${
            isDarkColorScheme ? "text-gray-400" : "text-gray-600"
          } ${isToday ? "text-blue-600" : ""}`}
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
                className={`ml-2 font-semibold ${
                  isDarkColorScheme ? "text-white" : "text-gray-800"
                }`}
              >
                {leaveRecord.type}
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
                className={`mt-1 text-xs ${
                  isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                }`}
                numberOfLines={1}
              >
                {leaveRecord.description}
              </Text>
            )}
          </View>
        ) : (
          <View>
            <View className="flex-row items-center">
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#16a34a"
              />
              <Text
                className={`ml-2 font-semibold ${
                  isDarkColorScheme ? "text-white" : "text-gray-800"
                }`}
              >
                Hadir
              </Text>              {clockInRecord && (
                <>
                  <Text
                    className={`ml-2 text-sm ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    ({formatTime(clockInRecord.timestamp || "") !== "N/A" 
                      ? formatTime(clockInRecord.timestamp || "")
                      : "Waktu tidak tersedia"})
                  </Text>
                </>
              )}
            </View>
            <View className="flex-row items-center mt-1">
              {clockInRecord && (
                <View className="flex-row items-center">                  <Text
                    className={`text-xs ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Masuk:
                  </Text>
                  <Text
                    className={`ml-1 text-xs font-medium ${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {formatTime(clockInRecord.timestamp || "") !== "N/A"
                      ? formatTime(clockInRecord.timestamp || "")
                      : "Tidak tersedia"}
                  </Text>
                </View>
              )}

              {clockOutRecord && (
                <View className="flex-row items-center ml-3">                  <Text
                    className={`text-xs ${
                      isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Pulang:
                  </Text>
                  <Text
                    className={`ml-1 text-xs font-medium ${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {formatTime(clockOutRecord.timestamp || "") !== "N/A"
                      ? formatTime(clockOutRecord.timestamp || "")
                      : "Tidak tersedia"}
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
        color={isDarkColorScheme ? "#9ca3af" : "#6b7280"}
      />
    </TouchableOpacity>
  );
};

const DetailModal = ({
  record,
  visible,
  isDarkColorScheme,
  onClose,
}: {
  record: AttendanceRecord | null;
  visible: boolean;
  isDarkColorScheme: boolean;
  onClose: () => void;
}) => {
  if (!record) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        className="bg-black bg-opacity-50 justify-end"
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          className={`p-4 rounded-t-3xl ${
            isDarkColorScheme ? "bg-gray-900" : "bg-white"
          }`}
          style={{ maxHeight: "80%" }}
          onStartShouldSetResponder={() => true}
        >
          <View className="items-center mb-4">
            <View className="w-10 h-1 bg-gray-300 rounded-full" />
          </View>

          <Text
            className={`text-xl font-bold mb-4 ${
              isDarkColorScheme ? "text-white" : "text-gray-800"
            }`}
          >
            Detail Absensi
          </Text>

          <View
            className={`p-4 mb-3 rounded-lg ${
              isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"
            }`}
          >
            {/* Date */}
            <View className="flex-row justify-between mb-3">
              <Text
                className={`font-medium ${
                  isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                }`}
              >
                Tanggal:
              </Text>
              <Text
                className={`font-medium ${
                  isDarkColorScheme ? "text-white" : "text-gray-800"
                }`}
              >                {new Date(record.date).toLocaleDateString("id-ID", {
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
                className={`font-medium ${
                  isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                }`}
              >
                Jenis:
              </Text>
              <Text
                className={`font-medium ${
                  isDarkColorScheme ? "text-white" : "text-gray-800"
                }`}
              >
                {record.type === "Masuk"
                  ? `Absensi ${record.period || "Tidak diketahui"}`
                  : record.type}
              </Text>
            </View>

            {/* Attendance Period (if applicable) */}
            {record.type === "Masuk" && record.period && (
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Periode:
                </Text>                <Text
                  className={`font-medium ${
                    isDarkColorScheme ? "text-white" : "text-gray-800"
                  }`}
                >
                  {record.period === "Datang" 
                    ? "Masuk" 
                    : record.period === "Pulang" 
                      ? "Pulang" 
                      : record.period || "Tidak diketahui"}
                </Text>
              </View>
            )}

            {/* Status */}
            {record.approval_status && (
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Status:
                </Text>
                <View
                  className={`px-2 py-1 rounded-full ${
                    record.approval_status === "approved"
                      ? "bg-green-100"
                      : record.approval_status === "rejected"
                        ? "bg-red-100"
                        : "bg-yellow-100"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      record.approval_status === "approved"
                        ? "text-green-800"
                        : record.approval_status === "rejected"
                          ? "text-red-800"
                          : "text-yellow-800"
                    }`}
                  >
                    {record.approval_status === "approved"
                      ? "Disetujui"
                      : record.approval_status === "rejected"
                        ? "Ditolak"
                        : "Menunggu Persetujuan"}
                  </Text>
                </View>
              </View>
            )}            {/* Timestamp */}
            {record.timestamp && (
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Waktu:
                </Text>
                <Text
                  className={`font-medium ${
                    isDarkColorScheme ? "text-white" : "text-gray-800"
                  }`}
                >
                  {record.timestamp && record.timestamp.includes("T")
                    ? new Date(record.timestamp).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "Waktu tidak tersedia"}
                </Text>
              </View>
            )}

            {/* Description */}
            {record.description && (
              <View className="mb-3">
                <Text
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Keterangan:
                </Text>
                <Text
                  className={`${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
                >
                  {record.description}
                </Text>
              </View>
            )}
          </View>

          {/* Photo */}
          {record.photo_url && (
            <View className="items-center mb-4">
              <Text
                className={`font-medium mb-2 ${
                  isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                }`}
              >
                Foto:
              </Text>
              <Image
                source={{ uri: record.photo_url }}
                className="w-full h-56 rounded-lg"
                resizeMode="cover"
              />
            </View>
          )}

          <Button onPress={onClose} variant="secondary" className="mt-2">
            Tutup
          </Button>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ========== MAIN COMPONENT ==========
export default function Riwayat() {  const user = useAuthStore((state: any) => state.user);
    const { isDarkColorScheme } = useColorScheme();

  const router = useRouter();

  const [activeView, setActiveView] = useState<ViewType>("hariIni");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Custom hooks for data fetching
  const todaysAttendance = useTodaysAttendance(user?.id || "");
  const attendanceHistory = useAttendanceHistory(user?.id || "");

  // Memoized grouped attendance data
  const groupedAttendance = useMemo(() => {
    const grouped: Record<string, AttendanceRecord[]> = {};
    const currentDate = new Date();
    const daysInMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    ).getDate();

    // Initialize all dates in month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = formatDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
      );
      grouped[dateStr] = [];
    }

    // Group records by date
    attendanceHistory.data.forEach((record) => {
      if (record.date in grouped) {
        grouped[record.date].push(record);
      } else {
        grouped[record.date] = [record];
      }
    });

    return Object.entries(grouped)
      .map(([date, records]) => ({ date, records }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceHistory.data]);  // Effects
  useEffect(() => {
    if (activeView === "hariIni") {
      todaysAttendance.refetch();
    } else {
      attendanceHistory.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, user?.id]);

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
  // ====================================================================
  // ⚠️ DEBUG BUTTONS - JANGAN LUPA HAPUS PAS PRODUCTION! ⚠️
  // ====================================================================
  const debugUpdateApprovalStatus = async (status: ApprovalStatus) => {
    if (!user?.id) return;
    
    const todayDateString = formatDate(new Date());
    
    try {
      const { error } = await supabase
        .from("perizinan")
        .update({ approval_status: status })
        .eq("user_id", user.id)
        .eq("tanggal", todayDateString);
        
      if (error) throw error;
        Alert.alert(
        "Debug Success",
        `Approval status berhasil diubah ke: ${status}`,
      );
      todaysAttendance.refetch();
    } catch (error) {
      console.error("Debug error:", error);
      Alert.alert("Debug Error", "Gagal mengubah approval status");
    }
  };

  // Render functions
  const renderTodayView = () => (
    <ScrollView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
    >
      {/* ⚠️ DEBUG PANEL - HAPUS PAS PRODUCTION! ⚠️ */}
      <View className={`p-4 rounded-lg mb-4 border-2 border-red-500 ${isDarkColorScheme ? "bg-red-900" : "bg-red-50"}`}>
        <Text className={`text-center font-bold mb-3 ${isDarkColorScheme ? "text-red-300" : "text-red-800"}`}>
          🚨 DEBUG PANEL - HAPUS PAS PRODUCTION! 🚨
        </Text>
        
        <View className="flex-row justify-between mb-3">
          <TouchableOpacity
            className="bg-yellow-500 py-2 px-3 rounded flex-1 mr-1"
            onPress={() => debugUpdateApprovalStatus("pending")}
          >
            <Text className="text-white text-center text-xs font-bold">PENDING</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-green-500 py-2 px-3 rounded flex-1 mx-1"
            onPress={() => debugUpdateApprovalStatus("approved")}
          >
            <Text className="text-white text-center text-xs font-bold">APPROVED</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-red-500 py-2 px-3 rounded flex-1 ml-1"
            onPress={() => debugUpdateApprovalStatus("rejected")}
          >
            <Text className="text-white text-center text-xs font-bold">REJECTED</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          className="bg-blue-500 py-2 px-4 rounded-lg flex-row items-center justify-center"
          onPress={() => {
            todaysAttendance.refetch();
            Alert.alert(
              "Data diperbarui",
              "Riwayat absensi telah diperbarui."
            );
          }}
        >
          <Ionicons
            name="refresh"
            size={20}
            color="white"
            className="mr-2"
          />
          <Text className="text-white font-bold ml-2">REFRESH DATA</Text>
        </TouchableOpacity>
      </View>

      {todaysAttendance.loading ? (
        <View className="flex-1 items-center justify-center py-10">
          <ActivityIndicator size="large" color="#0284c7" />
          <Text
            className={`mt-4 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Memuat data absensi...
          </Text>
        </View>
      ) : (
        <View>
          <View
            className={`p-4 rounded-lg mb-4 ${isDarkColorScheme ? "bg-gray-800" : "bg-white"}`}
          >
            <Text
              className={`text-lg font-bold mb-2 ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
            >
              Status Absensi Hari Ini
            </Text>

            <Text
              className={`mb-4 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
            >
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>

            {/* Status Cards */}
            <View className="flex-row justify-between mb-3">
              <StatusCard
                icon={
                  todaysAttendance.data.hasClockedIn
                    ? "checkmark-circle"
                    : "time-outline"
                }
                title="Absen Masuk"
                status={
                  todaysAttendance.data.hasClockedIn
                    ? "Sudah Absen"
                    : "Belum Absen"
                }
                isActive={todaysAttendance.data.hasClockedIn}
                color="#16a34a"
              />
              <StatusCard
                icon={
                  todaysAttendance.data.hasClockedOut
                    ? "checkmark-circle"
                    : "time-outline"
                }
                title="Absen Pulang"
                status={
                  todaysAttendance.data.hasClockedOut
                    ? "Sudah Absen"
                    : "Belum Absen"
                }
                isActive={todaysAttendance.data.hasClockedOut}
                color="#16a34a"
              />
            </View>

            {/* Leave Status */}
            {todaysAttendance.data.hasLeaveRequest &&
              todaysAttendance.data.approvalStatus && (
                <LeaveStatusCard
                  leaveType={todaysAttendance.data.leaveType || ""}
                  approvalStatus={todaysAttendance.data.approvalStatus}
                />
              )}

            {/* Action Buttons */}
            {!todaysAttendance.data.hasLeaveRequest && (
              <View className="mt-4">
                {!todaysAttendance.data.hasClockedIn && (
                  <TouchableOpacity
                    className="bg-blue-600 py-3 px-4 rounded-lg"
                    onPress={() => router.push("/attendance/AbsenceReport")}
                  >
                    <Text className="text-white font-semibold text-center">
                      Absen Masuk
                    </Text>
                  </TouchableOpacity>
                )}

                {todaysAttendance.data.hasClockedIn &&
                  !todaysAttendance.data.hasClockedOut && (
                    <TouchableOpacity
                      className="bg-green-600 py-3 px-4 rounded-lg"
                      onPress={() => router.push("/attendance/AbsenceReport")}
                    >
                      <Text className="text-white font-semibold text-center">
                        Absen Pulang
                      </Text>
                    </TouchableOpacity>
                  )}

                {todaysAttendance.data.hasClockedIn &&
                  todaysAttendance.data.hasClockedOut && (
                    <View className="bg-gray-200 py-3 px-4 rounded-lg">
                      <Text className="text-gray-500 font-semibold text-center">
                        Absensi Hari Ini Selesai
                      </Text>
                    </View>
                  )}
              </View>
            )}
          </View>

          {/* Permission Request Link */}
          {!todaysAttendance.data.hasLeaveRequest && (
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row items-center justify-between mb-4 ${
                isDarkColorScheme ? "bg-gray-800" : "bg-white"
              }`}
              onPress={() => router.push("/perizinan/izin")}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={isDarkColorScheme ? "#60a5fa" : "#2563eb"}
                />
                <Text
                  className={`ml-2 font-semibold ${
                    isDarkColorScheme ? "text-white" : "text-gray-800"
                  }`}
                >
                  Buat Perizinan
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDarkColorScheme ? "#9ca3af" : "#6b7280"}
              />
            </TouchableOpacity>
          )}

          {/* Debug and Refresh Buttons - DEBUG MODE ONLY */}
          {__DEV__ && (
            <View className="flex-row justify-between mt-4">
              <TouchableOpacity
                className="bg-red-600 py-2 px-4 rounded-lg flex-row items-center"
                onPress={() => {
                  // Debug: Force error
                  throw new Error("Debug: Forced error");
                }}
              >
                <Ionicons name="bug" size={20} color="white" className="mr-2" />
                <Text className="text-white font-semibold">Force Error</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-yellow-600 py-2 px-4 rounded-lg flex-row items-center"
                onPress={() => {
                  // Refresh: Re-fetch data
                  todaysAttendance.refetch();
                  attendanceHistory.refetch();
                  Alert.alert("Data diperbarui", "Riwayat absensi telah diperbarui.");
                }}
              >
                <Ionicons name="refresh" size={20} color="white" className="mr-2" />
                <Text className="text-white font-semibold">Segarkan Data</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderHistoryView = () => (
    <View className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}>
      {attendanceHistory.loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0284c7" />
          <Text
            className={`mt-4 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Memuat riwayat absensi...
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedAttendance}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <AttendanceItem
              date={item.date}
              records={item.records}
              isDarkColorScheme={isDarkColorScheme}
              onPress={() => {
                if (item.records.length > 0) {
                  setSelectedRecord(item.records[0]);
                  setShowDetailModal(true);
                }
              }}
            />
          )}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
              <Text
                className={`mt-4 font-medium ${
                  isDarkColorScheme ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Tidak ada data absensi
              </Text>
              <Text
                className={`mt-2 text-center ${
                  isDarkColorScheme ? "text-gray-500" : "text-gray-400"
                }`}
              >
                Belum ada riwayat absensi untuk bulan ini
              </Text>
            </View>
          }
        />
      )}
    </View>
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className={`p-4 ${isDarkColorScheme ? "bg-gray-800" : "bg-black"}`}>
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="p-1 mr-2">
            <Ionicons name="arrow-back-outline" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-white text-center">
              Riwayat Absensi
            </Text>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </View>

      {/* View Toggle */}
      <View
        className={`flex-row p-1 rounded-lg m-4 ${
          isDarkColorScheme ? "bg-gray-700" : "bg-gray-200"
        }`}
      >
        <TouchableOpacity
          className={`flex-1 py-2 px-4 rounded-md items-center justify-center ${
            activeView === "hariIni"
              ? isDarkColorScheme
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
                : isDarkColorScheme
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
              ? isDarkColorScheme
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
                : isDarkColorScheme
                  ? "text-gray-300"
                  : "text-gray-700"
            } font-medium`}
          >
            Bulan Ini
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeView === "hariIni" ? renderTodayView() : renderHistoryView()}

      {/* Detail Modal */}
      <DetailModal
        record={selectedRecord}
        visible={showDetailModal}
        isDarkColorScheme={isDarkColorScheme}
        onClose={() => setShowDetailModal(false)}
      />
    </SafeAreaView>
  );
}
