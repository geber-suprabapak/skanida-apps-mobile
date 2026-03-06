import { useState, useCallback, useRef } from "react";
import { supabase } from "~/utils/supabase";
import { AttendanceMap } from "~/components/attendance-calendar/types";
import { processAttendanceData } from "~/components/attendance-calendar/utils";

const __DEV__ = process.env.NODE_ENV === "development";

// PERF-M09: In-memory cache for previously fetched calendar months
const MONTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const monthCache = new Map<
  string,
  { data: AttendanceMap; expiresAt: number }
>();

function getCacheKey(userId: string, year: number, month: number): string {
  return `${userId}-${year}-${month}`;
}

export const useOptimizedMonthlyAttendance = (
  userId: string,
  year: number,
  month: number,
) => {
  const [data, setData] = useState<AttendanceMap>({});
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<{
    userId: string;
    year: number;
    month: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getMonthRange = useCallback((rangeYear: number, rangeMonth: number) => {
    const startDate = `${rangeYear}-${String(rangeMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(rangeYear, rangeMonth + 1, 0).getDate();
    const endDate = `${rangeYear}-${String(rangeMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const nextMonthStart =
      rangeMonth === 11
        ? `${rangeYear + 1}-01-01`
        : `${rangeYear}-${String(rangeMonth + 2).padStart(2, "0")}-01`;
    return { startDate, endDate, nextMonthStart };
  }, []);

  const toUtcStart = useCallback(
    (dateString: string) => `${dateString}T00:00:00.000Z`,
    [],
  );

  const fetchFromServer = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return {};

      const { startDate, endDate, nextMonthStart } = getMonthRange(year, month);

      try {
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
            .gte("tanggal", toUtcStart(startDate))
            .lt("tanggal", toUtcStart(nextMonthStart)),
        ]);

        if (signal?.aborted) return {};

        if (attendanceResult.error) throw attendanceResult.error;
        if (leaveResult.error) throw leaveResult.error;

        const processedData = processAttendanceData(
          attendanceResult.data,
          leaveResult.data,
        );

        return processedData;
      } catch (error) {
        if (signal?.aborted) return {};
        if (__DEV__) console.error("Error fetching from server:", error);
        throw error;
      }
    },
    [userId, year, month, getMonthRange, toUtcStart],
  );

  const fetchData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!userId) return;

      const currentRequest = { userId, year, month };
      const cacheKey = getCacheKey(userId, year, month);

      // PERF-M09: Check in-memory cache first (skip on force refresh)
      if (!forceRefresh) {
        const cached = monthCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          // Still need to check if this is a duplicate of last fetch
          if (
            lastFetchRef.current &&
            lastFetchRef.current.userId === currentRequest.userId &&
            lastFetchRef.current.year === currentRequest.year &&
            lastFetchRef.current.month === currentRequest.month
          ) {
            return;
          }
          lastFetchRef.current = currentRequest;
          setData(cached.data);
          return;
        }

        // Non-cached duplicate check
        if (
          lastFetchRef.current &&
          lastFetchRef.current.userId === currentRequest.userId &&
          lastFetchRef.current.year === currentRequest.year &&
          lastFetchRef.current.month === currentRequest.month
        ) {
          return;
        }
      }

      lastFetchRef.current = currentRequest;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        setLoading(true);

        const serverData = await fetchFromServer(signal);

        if (!signal.aborted) {
          setData(serverData);
          // PERF-M09: Cache the result
          monthCache.set(cacheKey, {
            data: serverData,
            expiresAt: Date.now() + MONTH_CACHE_TTL_MS,
          });
        }
      } catch (error) {
        if (!signal?.aborted) {
          if (__DEV__) console.error("Error in fetchData:", error);
          setData({});
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [userId, year, month, fetchFromServer],
  );

  return {
    data,
    loading,
    refetch: fetchData,
  };
};
