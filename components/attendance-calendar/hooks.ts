import { useState, useCallback, useRef } from "react";
import { AttendanceMap } from "~/components/attendance-calendar/types";
import { processAttendanceData } from "~/components/attendance-calendar/utils";
import { listAttendances, listPermits } from "~/utils/bffMobileApi";

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
    return { startDate, endDate };
  }, []);

  const fetchFromServer = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return {};

      const { startDate, endDate } = getMonthRange(year, month);

      try {
        const [attendanceItems, permitItems] = await Promise.all([
          listAttendances({ startDate, endDate }),
          listPermits(),
        ]);

        if (signal?.aborted) return {};

        const processedData = processAttendanceData(
          attendanceItems,
          permitItems.filter((leave) => leave.approval_status !== "rejected"),
        );

        return processedData;
      } catch (error) {
        if (signal?.aborted) return {};
        if (__DEV__)
          console.error("Error fetching attendance history from Astra:", error);
        throw error;
      }
    },
    [userId, year, month, getMonthRange],
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
