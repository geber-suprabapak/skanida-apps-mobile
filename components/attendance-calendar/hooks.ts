import { useState, useCallback, useEffect, useRef } from "react";
import { AttendanceMap } from "~/components/attendance-calendar/types";
import { processAttendanceData } from "~/components/attendance-calendar/utils";
import { listAttendances, listPermits } from "~/utils/bffMobileApi";

const MONTH_CACHE_TTL_MS = 5 * 60 * 1000;
const monthCache = new Map<
  string,
  { data: AttendanceMap; expiresAt: number }
>();

export const useOptimizedMonthlyAttendance = (
  userId: string,
  year: number,
  month: number,
) => {
  const key = `${userId}-${year}-${month}`;
  const [state, setState] = useState<{
    key: string;
    data: AttendanceMap | null;
    loading: boolean;
    error: boolean;
  }>({
    key,
    data: null,
    loading: !!userId,
    error: false,
  });
  const active = useRef<{ key: string; controller: AbortController } | null>(
    null,
  );

  useEffect(
    () => () => {
      active.current?.controller.abort();
      active.current = null;
    },
    [key],
  );

  const refetch = useCallback(
    async (forceRefresh = false) => {
      if (!userId) return;
      if (!forceRefresh && active.current?.key === key) return;
      active.current?.controller.abort();
      active.current = null;

      const cached = monthCache.get(key);
      if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        setState({ key, data: cached.data, loading: false, error: false });
        return;
      }

      const controller = new AbortController();
      active.current = { key, controller };
      setState({ key, data: null, loading: true, error: false });
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
      try {
        const [attendance, permits] = await Promise.all([
          listAttendances({ startDate, endDate }),
          listPermits(),
        ]);
        if (controller.signal.aborted) return;
        const data = processAttendanceData(attendance, permits, {
          startDate,
          endDate,
        });
        monthCache.set(key, {
          data,
          expiresAt: Date.now() + MONTH_CACHE_TTL_MS,
        });
        setState({ key, data, loading: false, error: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (__DEV__)
          console.error("Error fetching attendance history from Astra:", error);
        setState({ key, data: null, loading: false, error: true });
      } finally {
        if (active.current?.controller === controller) active.current = null;
      }
    },
    [userId, year, month, key],
  );

  return {
    ...(state.key === key
      ? state
      : { data: null, loading: !!userId, error: false }),
    refetch,
  };
};
