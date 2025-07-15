/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";

import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { attendanceCache } from "~/utils/attendanceCache";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { ChevronRight } from "~/lib/icons/ChevronRight";
import { CheckCircle } from "~/lib/icons/CheckCircle";
import { AlertCircle } from "~/lib/icons/AlertCircle";
import { FileText } from "~/lib/icons/FileText";
import { RefreshCw } from "~/lib/icons/RefreshCw";

// ========== TYPES ==========
interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'leave' | 'sick';
  checkInTime?: string;
  checkOutTime?: string;
  leaveType?: string;
  description?: string;
  photo_url?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

interface CalendarDay {
  date: number;
  fullDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  attendance?: AttendanceRecord;
}

interface AttendanceCalendarProps {
  isDarkColorScheme: boolean;
}

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

const getMonthDays = (year: number, month: number): CalendarDay[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDate = firstDay.getDay(); // 0 = Sunday

  const days: CalendarDay[] = [];
  const today = new Date();
  const todayString = formatDate(today);

  // Add previous month's trailing days
  const prevMonth = new Date(year, month - 1, 0);
  for (let i = startDate - 1; i >= 0; i--) {
    const date = prevMonth.getDate() - i;
    const fullDate = formatDate(new Date(year, month - 1, date));
    const isFuture = fullDate > todayString;
    days.push({
      date,
      fullDate,
      isCurrentMonth: false,
      isToday: false,
      isFuture,
    });
  }

  // Add current month days
  for (let date = 1; date <= daysInMonth; date++) {
    const fullDate = formatDate(new Date(year, month, date));
    const isToday = fullDate === todayString;
    const isFuture = fullDate > todayString;
    days.push({
      date,
      fullDate,
      isCurrentMonth: true,
      isToday,
      isFuture,
    });
  }

  // Add next month's leading days to complete the week
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let date = 1; date <= remainingDays; date++) {
    const fullDate = formatDate(new Date(year, month + 1, date));
    const isFuture = fullDate > todayString;
    days.push({
      date,
      fullDate,
      isCurrentMonth: false,
      isToday: false,
      isFuture,
    });
  }

  return days;
};

// ========== CUSTOM HOOKS ==========
const useOptimizedMonthlyAttendance = (userId: string, year: number, month: number) => {
  const [data, setData] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const lastFetchRef = useRef<{ userId: string; year: number; month: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFromCache = useCallback(async () => {
    if (!userId) return null;

    setCacheLoading(true);
    try {
      const cachedData = await attendanceCache.get(userId, year, month);
      setCacheLoading(false);
      return cachedData;
    } catch (error) {
      console.error("Error fetching from cache:", error);
      setCacheLoading(false);
      return null;
    }
  }, [userId, year, month]);

  const fetchFromServer = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return {};

    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    try {
      console.log(`🔄 Fetching attendance data for ${year}-${month + 1} from server...`);

      // Fetch attendance records with abort signal
      const attendancePromise = supabase
        .from("absences")
        .select("id, date, status, reason, photo_url, created_at")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate);

      // Fetch leave requests with abort signal
      const leavePromise = supabase
        .from("perizinan")
        .select("id, tanggal, kategori_izin, deskripsi, link_foto, approval_status")
        .eq("user_id", userId)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      // Execute both queries in parallel
      const [attendanceResult, leaveResult] = await Promise.all([
        attendancePromise,
        leavePromise
      ]);

      // Check if request was aborted
      if (signal?.aborted) {
        console.log('Request aborted');
        return {};
      }

      if (attendanceResult.error) throw attendanceResult.error;
      if (leaveResult.error) throw leaveResult.error;

      // Process data
      const processedData: Record<string, AttendanceRecord> = {};

      // Process attendance records (group by date)
      const attendanceByDate: Record<string, any[]> = {};
      attendanceResult.data?.forEach(record => {
        if (!attendanceByDate[record.date]) {
          attendanceByDate[record.date] = [];
        }
        attendanceByDate[record.date].push(record);
      });

      Object.entries(attendanceByDate).forEach(([date, records]) => {
        const hasCheckIn = records.some(r => r.status === 'Hadir' || r.status === 'Datang');
        const hasCheckOut = records.some(r => r.status === 'Pulang');
        const checkInRecord = records.find(r => r.status === 'Hadir' || r.status === 'Datang');
        const checkOutRecord = records.find(r => r.status === 'Pulang');

        if (hasCheckIn) {
          processedData[date] = {
            id: records[0].id,
            date,
            status: 'present',
            checkInTime: checkInRecord?.created_at,
            checkOutTime: checkOutRecord?.created_at,
            description: records[0].reason,
            photo_url: records[0].photo_url,
          };
        }
      });

      // Process leave requests (these override attendance records)
      leaveResult.data?.forEach(leave => {
        const status = leave.kategori_izin === 'sakit' ? 'sick' : 'leave';
        processedData[leave.tanggal] = {
          id: leave.id,
          date: leave.tanggal,
          status,
          leaveType: leave.kategori_izin,
          description: leave.deskripsi,
          photo_url: leave.link_foto,
          approval_status: leave.approval_status,
        };
      });

      // Cache the results
      await attendanceCache.set(userId, year, month, processedData);

      console.log(`✅ Successfully fetched and cached ${Object.keys(processedData).length} attendance records`);
      return processedData;

    } catch (error) {
      if (signal?.aborted) {
        console.log('Request was aborted');
        return {};
      }

      console.error("Error fetching attendance data from server:", error);
      throw error;
    }
  }, [userId, year, month]);

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    if (!userId) return;

    // Avoid duplicate requests
    const currentRequest = { userId, year, month };
    if (lastFetchRef.current &&
        lastFetchRef.current.userId === currentRequest.userId &&
        lastFetchRef.current.year === currentRequest.year &&
        lastFetchRef.current.month === currentRequest.month &&
        !forceRefresh) {
      console.log('Skipping duplicate request');
      return;
    }

    lastFetchRef.current = currentRequest;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);

      let cachedData: Record<string, AttendanceRecord> | null = null;

      // Try cache first (unless forcing refresh)
      if (!forceRefresh) {
        cachedData = await fetchFromCache();
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          console.log(`📱 Using cached data for ${year}-${month + 1}`);
          return;
        }
      }

      // Fetch from server
      const serverData = await fetchFromServer(signal);

      if (!signal.aborted) {
        setData(serverData);
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error('Error in fetchData:', error);
        // Fallback to cache if server fails
        const cachedData = await fetchFromCache();
        if (cachedData) {
          setData(cachedData);
          console.log('📱 Using stale cache due to server error');
        } else {
          setData({});
        }
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [userId, year, month, fetchFromCache, fetchFromServer]);

  // Prefetch adjacent months
  const prefetchAdjacentMonths = useCallback(async () => {
    if (!userId) return;

    const adjacentMonths = [
      { year: month === 0 ? year - 1 : year, month: month === 0 ? 11 : month - 1 },
      { year: month === 11 ? year + 1 : year, month: month === 11 ? 0 : month + 1 },
    ];

    for (const { year: adjYear, month: adjMonth } of adjacentMonths) {
      try {
        // Check if already cached
        const cached = await attendanceCache.get(userId, adjYear, adjMonth);
        if (!cached) {
          console.log(`🔮 Prefetching ${adjYear}-${adjMonth + 1}...`);

          const startDate = `${adjYear}-${String(adjMonth + 1).padStart(2, "0")}-01`;
          const lastDay = new Date(adjYear, adjMonth + 1, 0).getDate();
          const endDate = `${adjYear}-${String(adjMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

          // Prefetch in background (no loading state)
          const [attendanceResult, leaveResult] = await Promise.all([
            supabase
              .from("absences")
              .select("id, date, status, reason, photo_url, created_at")
              .eq("user_id", userId)
              .gte("date", startDate)
              .lte("date", endDate),
            supabase
              .from("perizinan")
              .select("id, tanggal, kategori_izin, deskripsi, link_foto, approval_status")
              .eq("user_id", userId)
              .gte("tanggal", startDate)
              .lte("tanggal", endDate)
          ]);

          if (!attendanceResult.error && !leaveResult.error) {
            // Process and cache the prefetched data
            const processedData: Record<string, AttendanceRecord> = {};

            // Process attendance records
            const attendanceByDate: Record<string, any[]> = {};
            attendanceResult.data?.forEach(record => {
              if (!attendanceByDate[record.date]) {
                attendanceByDate[record.date] = [];
              }
              attendanceByDate[record.date].push(record);
            });

            Object.entries(attendanceByDate).forEach(([date, records]) => {
              const hasCheckIn = records.some(r => r.status === 'Hadir' || r.status === 'Datang');
              const checkInRecord = records.find(r => r.status === 'Hadir' || r.status === 'Datang');
              const checkOutRecord = records.find(r => r.status === 'Pulang');

              if (hasCheckIn) {
                processedData[date] = {
                  id: records[0].id,
                  date,
                  status: 'present',
                  checkInTime: checkInRecord?.created_at,
                  checkOutTime: checkOutRecord?.created_at,
                  description: records[0].reason,
                  photo_url: records[0].photo_url,
                };
              }
            });

            // Process leave requests
            leaveResult.data?.forEach(leave => {
              const status = leave.kategori_izin === 'sakit' ? 'sick' : 'leave';
              processedData[leave.tanggal] = {
                id: leave.id,
                date: leave.tanggal,
                status,
                leaveType: leave.kategori_izin,
                description: leave.deskripsi,
                photo_url: leave.link_foto,
                approval_status: leave.approval_status,
              };
            });

            await attendanceCache.set(userId, adjYear, adjMonth, processedData);
            console.log(`✅ Prefetched and cached ${adjYear}-${adjMonth + 1}`);
          }
        }
      } catch (error) {
        console.log(`Failed to prefetch ${adjYear}-${adjMonth + 1}:`, error);
        // Prefetch failures are not critical, continue silently
      }
    }
  }, [userId, year, month]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading: loading || cacheLoading,
    refetch: fetchData,
    prefetchAdjacent: prefetchAdjacentMonths
  };
};

// ========== COMPONENTS ==========
const CalendarDayComponent = ({
  day,
  isDarkColorScheme,
  onPress,
  isSelected,
}: {
  day: CalendarDay;
  isDarkColorScheme: boolean;
  onPress: () => void;
  isSelected: boolean;
}) => {
  // Safety check for day prop
  if (!day) {
    return (
      <View className="flex-1 h-12 items-center justify-center m-0.5 rounded-lg bg-transparent">
        <Text className="text-sm text-gray-400">-</Text>
      </View>
    );
  }

  const getStatusColor = () => {
    // Future dates in current month should be greyed out but distinct from next month
    if (day.isCurrentMonth && day.isFuture) {
      return isDarkColorScheme ? "bg-gray-800" : "bg-gray-50";
    }
    
    // Previous/next month dates (outside current month)
    if (!day.isCurrentMonth) {
      return "bg-transparent";
    }

    if (!day.attendance) {
      return isDarkColorScheme ? "bg-red-900" : "bg-red-100";
    }

    switch (day.attendance.status) {
      case 'present':
        return isDarkColorScheme ? "bg-green-900" : "bg-green-100";
      case 'leave':
        return isDarkColorScheme ? "bg-blue-900" : "bg-blue-100";
      case 'sick':
        return isDarkColorScheme ? "bg-yellow-900" : "bg-yellow-100";
      default:
        return isDarkColorScheme ? "bg-red-900" : "bg-red-100";
    }
  };

  const getTextColor = () => {
    // Previous/next month dates (outside current month) - very faded
    if (!day.isCurrentMonth) {
      return isDarkColorScheme ? "text-gray-600" : "text-gray-400";
    }

    // Future dates in current month - greyed out but readable
    if (day.isCurrentMonth && day.isFuture) {
      return isDarkColorScheme ? "text-gray-500" : "text-gray-500";
    }

    // Today's date text color
    if (day.isToday) {
      return isDarkColorScheme ? "text-pink-400 font-semibold" : "text-pink-600 font-semibold";
    }

    if (!day.attendance) {
      return isDarkColorScheme ? "text-red-400" : "text-red-600";
    }

    switch (day.attendance.status) {
      case 'present':
        return isDarkColorScheme ? "text-green-400" : "text-green-700";
      case 'leave':
        return isDarkColorScheme ? "text-blue-400" : "text-blue-700";
      case 'sick':
        return isDarkColorScheme ? "text-yellow-400" : "text-yellow-700";
      default:
        return isDarkColorScheme ? "text-red-400" : "text-red-600";
    }
  };

  const getBorderAndBackground = () => {
    // Today's date gets a pink border indicator
    if (day.isToday) {
      return isDarkColorScheme
        ? "border-2 border-pink-400"
        : "border-2 border-pink-500";
    }

    // Default border
    return isDarkColorScheme ? "border border-gray-600" : "border border-gray-200";
  };

  const handlePress = () => {
    try {
      if (!day?.isCurrentMonth) {
        console.log('Day is not in current month, press ignored');
        return;
      }

      // Prevent interaction with future dates
      if (day.isFuture) {
        console.log('Future date clicked, press ignored');
        return;
      }

      if (typeof onPress === 'function') {
        onPress();
      } else {
        console.warn('onPress is not a function');
      }
    } catch (error) {
      console.error('Error in day press handler:', error);
    }
  };

  return (
    <TouchableOpacity
      className={`flex-1 h-12 items-center justify-center m-0.5 rounded-lg ${getStatusColor()} ${getBorderAndBackground()} ${isSelected ? (isDarkColorScheme ? 'border-green-400' : 'border-green-500') : ''}`}
      onPress={handlePress}
      disabled={!day.isCurrentMonth || day.isFuture}
      activeOpacity={day.isCurrentMonth && !day.isFuture ? 0.7 : 1}
      style={{ minHeight: 48 }}
    >
      <Text className={`text-sm ${getTextColor()}`}>
        {day.date}
      </Text>

      {/* Attendance indicator dot */}
      {day.attendance && day.isCurrentMonth && (
        <View className="absolute bottom-1 w-1 h-1 rounded-full bg-current" />
      )}

      {/* Today indicator - small dot at top-right */}
      {day.isToday && (
        <View
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
            isDarkColorScheme ? "bg-pink-400" : "bg-pink-500"
          }`}
        />
      )}
    </TouchableOpacity>
  );
};

const DetailCard = ({
  day,
  isDarkColorScheme,
  onClose,
}: {
  day: CalendarDay | null;
  isDarkColorScheme: boolean;
  onClose?: () => void;
}) => {
  if (!day) return null;

  const getStatusText = () => {
    if (!day.attendance) return "Tidak Hadir";

    switch (day.attendance.status) {
      case 'present':
        return "Hadir";
      case 'leave':
        return "Izin";
      case 'sick':
        return "Sakit";
      default:
        return "Tidak Hadir";
    }
  };

  const getStatusIcon = () => {
    if (!day.attendance) {
      return <AlertCircle size={24} color="#dc2626" />;
    }

    switch (day.attendance.status) {
      case 'present':
        return <CheckCircle size={24} color="#16a34a" />;
      case 'leave':
        return <FileText size={24} color="#2563eb" />;
      case 'sick':
        return <FileText size={24} color="#ca8a04" />;
      default:
        return <AlertCircle size={24} color="#dc2626" />;
    }
  };

  return (
    <View className={`rounded-lg p-4 mt-4 ${isDarkColorScheme ? "bg-gray-800" : "bg-white"}`}>
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          {getStatusIcon()}
          <Text
            className={`text-xl font-bold ml-3 ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
          >
            {getStatusText()}
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            className={`p-2 rounded-full ${isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"}`}
          >
            <Text className={`text-lg font-bold ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}>
              ×
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        className={`p-4 rounded-lg ${isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"}`}
      >
        {/* Date */}
        <View className="flex-row justify-between mb-3">
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Tanggal:
          </Text>
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
          >
            {new Date(day.fullDate).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Status */}
        <View className="flex-row justify-between mb-3">
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Status:
          </Text>
          <Text
            className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
          >
            {getStatusText()}
          </Text>
        </View>

        {/* Check-in/Check-out times */}
        {day.attendance?.status === 'present' && (
          <>
            {day.attendance.checkInTime && (
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
                >
                  Jam Masuk:
                </Text>
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
                >
                  {formatTime(day.attendance.checkInTime)}
                </Text>
              </View>
            )}
            {day.attendance.checkOutTime && (
              <View className="flex-row justify-between mb-3">
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
                >
                  Jam Pulang:
                </Text>
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
                >
                  {formatTime(day.attendance.checkOutTime)}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Leave type */}
        {day.attendance?.leaveType && (
          <View className="flex-row justify-between mb-3">
            <Text
              className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
            >
              Jenis:
            </Text>
            <Text
              className={`font-medium capitalize ${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
            >
              {day.attendance.leaveType}
            </Text>
          </View>
        )}

        {/* Approval status */}
        {day.attendance?.approval_status && (
          <View className="flex-row justify-between mb-3">
            <Text
              className={`font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
            >
              Status Persetujuan:
            </Text>
            <View
              className={`px-2 py-1 rounded-full ${
                day.attendance.approval_status === "approved"
                  ? "bg-green-100"
                  : day.attendance.approval_status === "rejected"
                    ? "bg-red-100"
                    : "bg-yellow-100"
              }`}
            >
              <Text
                className={`text-xs ${
                  day.attendance.approval_status === "approved"
                    ? "text-green-800"
                    : day.attendance.approval_status === "rejected"
                      ? "text-red-800"
                      : "text-yellow-800"
                }`}
              >
                {day.attendance.approval_status === "approved"
                  ? "Disetujui"
                  : day.attendance.approval_status === "rejected"
                    ? "Ditolak"
                    : "Menunggu"}
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        {day.attendance?.description && (
          <View className="mb-3">
            <Text
              className={`font-medium mb-1 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
            >
              Keterangan:
            </Text>
            <Text
              className={`${isDarkColorScheme ? "text-white" : "text-gray-800"}`}
            >
              {day.attendance.description}
            </Text>
          </View>
        )}
      </View>

      {/* Photo */}
      {day.attendance?.photo_url && (
        <View className="mt-4">
          <Text
            className={`font-medium mb-2 ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
          >
            Foto:
          </Text>
          <Image
            source={{ uri: day.attendance.photo_url }}
            className="w-full h-48 rounded-lg"
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
};

// ========== MAIN COMPONENT ==========
export default function AttendanceCalendar({ isDarkColorScheme }: AttendanceCalendarProps) {
  const user = useAuthStore((state: any) => state.user);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailDay, setDetailDay] = useState<CalendarDay | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Fetch monthly attendance data with optimized caching
  const monthlyAttendance = useOptimizedMonthlyAttendance(user?.id || "", currentYear, currentMonth);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    try {
      const days = getMonthDays(currentYear, currentMonth);
      return days.map(day => ({
        ...day,
        attendance: monthlyAttendance.data?.[day.fullDate],
      }));
    } catch (error) {
      console.error('Error generating calendar days:', error);
      return [];
    }
  }, [currentYear, currentMonth, monthlyAttendance.data]);

  // Navigation functions
  const goToPreviousMonth = () => {
    try {
      setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
      setDetailDay(null); // Clear detail when changing months
      setSelectedDay(null);
    } catch (error) {
      console.error('Error navigating to previous month:', error);
    }
  };

  const goToNextMonth = () => {
    try {
      setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
      setDetailDay(null); // Clear detail when changing months
      setSelectedDay(null);
    } catch (error) {
      console.error('Error navigating to next month:', error);
    }
  };

  const handleDayPress = useCallback((day: CalendarDay) => {
    try {
      // Only allow clicks on current month days
      if (!day?.isCurrentMonth) {
        const monthName = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ][currentMonth];
        console.log(`🚫 Day ${day?.date} not in current month (${monthName} ${currentYear}), ignoring press`);
        return;
      }

      console.log(`📅 Date clicked: ${day.fullDate}`);
      
      if (day.attendance) {
        console.log(`✅ Attendance found: ${day.attendance.status}`);
        if (day.attendance.checkInTime) {
          console.log(`🕒 Check-in time: ${formatTime(day.attendance.checkInTime)}`);
        }
        if (day.attendance.checkOutTime) {
          console.log(`🕕 Check-out time: ${formatTime(day.attendance.checkOutTime)}`);
        }
      } else {
        console.log(`❌ No attendance record found for ${day.fullDate}`);
      }

      // Simply set the detail day to show information
      setDetailDay(day);
      setSelectedDay(day);
    } catch (error) {
      console.error('Error in handleDayPress:', error);
      console.warn('Failed to show date details, please try again');
    }
  }, [currentMonth, currentYear]);

  // Effects
  useEffect(() => {
    try {
      if (user?.id && typeof monthlyAttendance.refetch === 'function') {
        // Fetch current month data
        monthlyAttendance.refetch(false);

        // Prefetch adjacent months after a short delay
        const prefetchTimer = setTimeout(() => {
          if (typeof monthlyAttendance.prefetchAdjacent === 'function') {
            monthlyAttendance.prefetchAdjacent();
          }
        }, 1000);

        return () => clearTimeout(prefetchTimer);
      } else {
        console.warn('Unable to refetch attendance data - missing user ID or refetch function');
      }
    } catch (error) {
      console.error('Error refetching attendance data:', error);
    }
  }, [currentYear, currentMonth, user?.id]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    try {
      if (user?.id && typeof monthlyAttendance.refetch === 'function') {
        monthlyAttendance.refetch(true); // Force refresh
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [user?.id, monthlyAttendance.refetch]);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  return (
    <ScrollView className="flex-1 p-4">
      {/* Month Navigation */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity
          onPress={goToPreviousMonth}
          className={`p-2 rounded-full ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"}`}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center justify-center">
          <Text
            className={`text-xl font-bold ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
          >
            {monthNames[currentMonth]} {currentYear}
          </Text>

          {/* Refresh Button */}
          <TouchableOpacity
            onPress={handleRefresh}
            className={`ml-3 p-2 rounded-full ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"}`}
            activeOpacity={0.7}
            disabled={monthlyAttendance.loading}
            key="refresh-button"
          >
            {monthlyAttendance.loading ? (
              <View className="animate-spin">
                <RefreshCw
                  size={16}
                  color="#9ca3af"
                  className=""
                />
              </View>
            ) : (
              <RefreshCw
                size={16}
                color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"}
                className=""
              />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={goToNextMonth}
          className={`p-2 rounded-full ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"}`}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={isDarkColorScheme ? "#ffffff" : "#000000"} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View className={`p-4 rounded-lg mb-6 ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"}`}>
        <Text className={`font-semibold mb-3 ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}>
          Keterangan:
        </Text>
        <View className="flex-row flex-wrap">
          <View key="legend-present" className="flex-row items-center mr-4 mb-2">
            <View className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-green-900" : "bg-green-100"}`} />
            <Text className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}>Hadir</Text>
          </View>
          <View key="legend-leave" className="flex-row items-center mr-4 mb-2">
            <View className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-blue-900" : "bg-blue-100"}`} />
            <Text className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}>Izin</Text>
          </View>
          <View key="legend-sick" className="flex-row items-center mr-4 mb-2">
            <View className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-yellow-900" : "bg-yellow-100"}`} />
            <Text className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}>Sakit</Text>
          </View>
          <View key="legend-absent" className="flex-row items-center mr-4 mb-2">
            <View className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-red-900" : "bg-red-100"}`} />
            <Text className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}>Tidak Hadir</Text>
          </View>
          <View key="legend-today" className="flex-row items-center mb-2">
            <View className={`w-4 h-4 rounded mr-2 border-2 relative ${isDarkColorScheme ? "border-pink-400 bg-gray-700" : "border-pink-500 bg-white"}`}>
              <View className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full ${isDarkColorScheme ? "bg-pink-400" : "bg-pink-500"}`} />
            </View>
            <Text className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}>Hari Ini</Text>
          </View>
        </View>
      </View>

      {/* Calendar */}
      <View className={`rounded-lg p-4 ${isDarkColorScheme ? "bg-gray-800" : "bg-white"}`}>
        {/* Day names header */}
        <View className="flex-row mb-2">
          {dayNames.map((dayName) => (
            <View key={dayName} className="flex-1 items-center py-2">
              <Text className={`font-medium ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}>
                {dayName}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar days */}
        {monthlyAttendance.loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#0284c7" />
            <Text className={`mt-2 ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}>
              Memuat data kehadiran...
            </Text>
          </View>
        ) : (
          <View key={`calendar-${currentYear}-${currentMonth}`}>
            {Array.from({ length: Math.ceil((calendarDays?.length || 0) / 7) }, (_, weekIndex) => (
              <View key={`week-${currentYear}-${currentMonth}-${weekIndex}`} className="flex-row">
                {(calendarDays || [])
                  .slice(weekIndex * 7, weekIndex * 7 + 7)
                  .map((day, dayIndex) => (
                    <CalendarDayComponent
                      key={`${currentYear}-${currentMonth}-w${weekIndex}-d${dayIndex}-${day?.fullDate || 'empty'}`}
                      day={day}
                      isDarkColorScheme={isDarkColorScheme}
                      onPress={() => handleDayPress(day)}
                      isSelected={selectedDay?.fullDate === day?.fullDate}
                    />
                  ))}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Detail Card - shows when a day is tapped */}
      {detailDay && (
        <DetailCard
          key={`detail-${detailDay.fullDate}-${currentYear}-${currentMonth}`}
          day={detailDay}
          isDarkColorScheme={isDarkColorScheme}
          onClose={() => setDetailDay(null)}
        />
      )}
    </ScrollView>
  );
}
