import { useState, useCallback, useRef } from "react";
import { supabase } from "~/utils/supabase";
import { attendanceCache } from "~/utils/attendanceCache";
import { AttendanceMap } from "~/components/ui/attendance-calendar/types";
import { processAttendanceData } from "~/components/ui/attendance-calendar/utils";

const __DEV__ = process.env.NODE_ENV === "development";

export const useOptimizedMonthlyAttendance = (
  userId: string,
  year: number,
  month: number,
) => {
  const [data, setData] = useState<AttendanceMap>({});
  const [loading, setLoading] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
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

  const fetchFromCache = useCallback(async () => {
    if (!userId) return null;

    setCacheLoading(true);
    try {
      const cachedData = await attendanceCache.get(userId, year, month);
      return cachedData;
    } catch (error) {
      if (__DEV__) console.error("Error fetching from cache:", error);
      return null;
    } finally {
      setCacheLoading(false);
    }
  }, [userId, year, month]);

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

        await attendanceCache.set(userId, year, month, processedData);

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

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      const hasExistingData = Object.keys(data).length > 0;

      try {
        setLoading(true);

        if (!forceRefresh) {
          const cachedData = await fetchFromCache();
          if (cachedData) {
            setData(cachedData);
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
          if (!hasExistingData) {
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
        const cached = await attendanceCache.get(userId, adjYear, adjMonth);
        if (cached) continue;

        const { startDate, endDate, nextMonthStart } = getMonthRange(
          adjYear,
          adjMonth,
        );

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

        if (!attendanceResult.error && !leaveResult.error) {
          const processedData = processAttendanceData(
            attendanceResult.data,
            leaveResult.data,
          );
          await attendanceCache.set(userId, adjYear, adjMonth, processedData);
        }
      } catch {}
    }
  }, [userId, year, month, getMonthRange, toUtcStart]);

  return {
    data,
    loading: loading || cacheLoading,
    refetch: fetchData,
    prefetchAdjacent: prefetchAdjacentMonths,
  };
};
