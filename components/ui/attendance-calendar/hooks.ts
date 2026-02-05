import { useState, useCallback, useRef } from "react";
import { supabase } from "~/utils/supabase";
import { attendanceCache } from "~/utils/attendanceCache";
import { AttendanceRecord } from "~/components/ui/attendance-calendar/types";
import { processAttendanceData } from "~/components/ui/attendance-calendar/utils";

const __DEV__ = process.env.NODE_ENV === "development";

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
      if (__DEV__) console.error("Error fetching from cache:", error);
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
        // Fetch attendance and leave records in parallel
        const [attendanceResult, leaveResult] = await Promise.all([
          supabase
            .from("absences")
            .select("id, date, status, photo_url, created_at")
            .eq("user_id", userId)
            .gte("date", startDate)
            .lte("date", endDate),
          supabase
            .from("perizinan")
            .select(
              "id, tanggal, kategori_izin, deskripsi, link_foto, approval_status",
            )
            .eq("user_id", userId)
            .gte("tanggal", `${startDate}T00:00:00.000Z`)
            .lt(
              "tanggal",
              `${year}-${String(month + 2).padStart(2, "0")}-01T00:00:00.000Z`,
            ),
        ]);

        if (signal?.aborted) return {};

        if (attendanceResult.error) throw attendanceResult.error;
        if (leaveResult.error) throw leaveResult.error;

        // Use shared processing function
        const processedData = processAttendanceData(
          attendanceResult.data,
          leaveResult.data,
        );

        // Cache the results
        await attendanceCache.set(userId, year, month, processedData);

        return processedData;
      } catch (error) {
        if (signal?.aborted) return {};
        if (__DEV__) console.error("Error fetching from server:", error);
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
          if (__DEV__) console.error("Error in fetchData:", error);
          // Fallback to cache if server fails and we don't have data yet
          if (Object.keys(data).length === 0) {
            const cachedData = await fetchFromCache();
            if (cachedData) {
              setData(cachedData);
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
        if (cached) continue;

        const startDate = `${adjYear}-${String(adjMonth + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(adjYear, adjMonth + 1, 0).getDate();
        const endDate = `${adjYear}-${String(adjMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        // Prefetch in background (no loading state)
        const [attendanceResult, leaveResult] = await Promise.all([
          supabase
            .from("absences")
            .select("id, date, status, photo_url, created_at")
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
          // Use shared processing function
          const processedData = processAttendanceData(
            attendanceResult.data,
            leaveResult.data,
          );
          await attendanceCache.set(userId, adjYear, adjMonth, processedData);
        }
      } catch {
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
