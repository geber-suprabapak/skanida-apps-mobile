import { useState, useCallback, useRef } from "react";
import { supabase } from "~/utils/supabase";
import { attendanceCache } from "~/utils/attendanceCache";
import { AttendanceRecord } from "~/components/ui/attendance-calendar/types";

export const useOptimizedMonthlyAttendance = (
  userId: string,
  year: number,
  month: number,
) => {
  const [data, setData] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const lastFetchRef = useRef<{
    userId: string;
    year: number;
    month: number;
  } | null>(null);
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

  const fetchFromServer = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return {};

      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      try {
        console.log(
          `🔄 Fetching attendance data for ${year}-${month + 1} from server...`,
        );

        // Fetch attendance records with abort signal
        const attendancePromise = supabase
          .from("absences")
          .select("id, date, status, reason, photo_url, created_at")
          .eq("user_id", userId)
          .gte("date", startDate)
          .lte("date", endDate);

        // Fetch leave requests with abort signal - using proper timestamp filtering
        const leavePromise = supabase
          .from("perizinan")
          .select(
            "id, tanggal, kategori_izin, deskripsi, link_foto, approval_status",
          )
          .eq("user_id", userId)
          .gte("tanggal", `${startDate}T00:00:00.000Z`)
          .lt(
            "tanggal",
            `${year}-${String(month + 2).padStart(2, "0")}-01T00:00:00.000Z`,
          );

        // Execute both queries in parallel
        const [attendanceResult, leaveResult] = await Promise.all([
          attendancePromise,
          leavePromise,
        ]);

        // Check if request was aborted
        if (signal?.aborted) {
          console.log("Request aborted");
          return {};
        }

        if (attendanceResult.error) throw attendanceResult.error;
        if (leaveResult.error) throw leaveResult.error;

        // Process data
        const processedData: Record<string, AttendanceRecord> = {};

        // Process attendance records (group by date)
        const attendanceByDate: Record<string, any[]> = {};
        attendanceResult.data?.forEach((record) => {
          if (!attendanceByDate[record.date]) {
            attendanceByDate[record.date] = [];
          }
          attendanceByDate[record.date].push(record);
        });

        Object.entries(attendanceByDate).forEach(([date, records]) => {
          const hasCheckIn = records.some(
            (r) => r.status === "Hadir" || r.status === "Datang",
          );
          const checkInRecord = records.find(
            (r) => r.status === "Hadir" || r.status === "Datang",
          );
          const checkOutRecord = records.find((r) => r.status === "Pulang");

          if (hasCheckIn) {
            processedData[date] = {
              id: records[0].id,
              date,
              status: "present",
              checkInTime: checkInRecord?.created_at,
              checkOutTime: checkOutRecord?.created_at,
              description: records[0].reason,
              photo_url: records[0].photo_url,
            };
          }
        });

        // Process leave requests (these override attendance records)
        leaveResult.data?.forEach((leave) => {
          const status = leave.kategori_izin === "sakit" ? "sick" : "leave";
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

        console.log(
          `✅ Successfully fetched and cached ${Object.keys(processedData).length} attendance records`,
        );
        return processedData;
      } catch (error) {
        if (signal?.aborted) {
          console.log("Request was aborted");
          return {};
        }

        console.error("Error fetching attendance data from server:", error);
        throw error;
      }
    },
    [userId, year, month],
  );

  const fetchData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!userId) return;

      // Avoid duplicate requests for the same month unless force refresh
      const currentRequest = { userId, year, month };
      if (
        !forceRefresh &&
        lastFetchRef.current &&
        lastFetchRef.current.userId === currentRequest.userId &&
        lastFetchRef.current.year === currentRequest.year &&
        lastFetchRef.current.month === currentRequest.month
      ) {
        console.log("Skipping duplicate request for same month");
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

        // Skip cache check if force refresh is requested
        if (!forceRefresh) {
          const cachedData = await fetchFromCache();
          if (cachedData) {
            setData(cachedData);
            setLoading(false);
            console.log(`📱 Using cached data for ${year}-${month + 1}`);
            return;
          }
        }

        // Fetch from server
        console.log(
          `🌐 Fetching fresh data for ${year}-${month + 1}${forceRefresh ? " (force refresh)" : ""}`,
        );
        const serverData = await fetchFromServer(signal);

        if (!signal.aborted) {
          setData(serverData);
        }
      } catch (error) {
        if (!signal?.aborted) {
          console.error("Error in fetchData:", error);
          // Fallback to cache if server fails and we don't have data yet
          if (Object.keys(data).length === 0) {
            const cachedData = await fetchFromCache();
            if (cachedData) {
              setData(cachedData);
              console.log("📱 Using stale cache due to server error");
            } else {
              setData({});
            }
          }
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [userId, year, month, fetchFromCache, fetchFromServer, data],
  );

  // Prefetch adjacent months
  const prefetchAdjacentMonths = useCallback(async () => {
    if (!userId) return;

    const adjacentMonths = [
      {
        year: month === 0 ? year - 1 : year,
        month: month === 0 ? 11 : month - 1,
      },
      {
        year: month === 11 ? year + 1 : year,
        month: month === 11 ? 0 : month + 1,
      },
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
              .select(
                "id, tanggal, kategori_izin, deskripsi, link_foto, approval_status",
              )
              .eq("user_id", userId)
              .gte("tanggal", startDate)
              .lte("tanggal", endDate),
          ]);

          if (!attendanceResult.error && !leaveResult.error) {
            // Process and cache the prefetched data
            const processedData: Record<string, AttendanceRecord> = {};

            // Process attendance records
            const attendanceByDate: Record<string, any[]> = {};
            attendanceResult.data?.forEach((record) => {
              if (!attendanceByDate[record.date]) {
                attendanceByDate[record.date] = [];
              }
              attendanceByDate[record.date].push(record);
            });

            Object.entries(attendanceByDate).forEach(([date, records]) => {
              const hasCheckIn = records.some(
                (r) => r.status === "Hadir" || r.status === "Datang",
              );
              const checkInRecord = records.find(
                (r) => r.status === "Hadir" || r.status === "Datang",
              );
              const checkOutRecord = records.find((r) => r.status === "Pulang");

              if (hasCheckIn) {
                processedData[date] = {
                  id: records[0].id,
                  date,
                  status: "present",
                  checkInTime: checkInRecord?.created_at,
                  checkOutTime: checkOutRecord?.created_at,
                  description: records[0].reason,
                  photo_url: records[0].photo_url,
                };
              }
            });

            // Process leave requests
            leaveResult.data?.forEach((leave) => {
              const status = leave.kategori_izin === "sakit" ? "sick" : "leave";
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

  return {
    data,
    loading: loading || cacheLoading,
    refetch: fetchData,
    prefetchAdjacent: prefetchAdjacentMonths,
  };
};
