import { useState, useCallback, useMemo } from "react";
import {
  getNotificationPermissionStatus,
  registerAndSaveNotificationToken,
  clearNotificationToken,
  openNotificationSettings,
  reconcileNotificationState,
} from "~/utils/notifications";
import { Alert } from "react-native";

type NotificationState = {
  isGranted: boolean;
  tokenSynced: boolean;
  isOptedOut: boolean;
  canAskAgain: boolean;
  isLoading: boolean;
};

const INITIAL_STATE: NotificationState = {
  isGranted: false,
  tokenSynced: false,
  isOptedOut: false,
  canAskAgain: true,
  isLoading: true,
};

export function useNotificationSettings(userId: string | undefined) {
  const [state, setState] = useState<NotificationState>(INITIAL_STATE);

  const isEnabled = state.isGranted && state.tokenSynced;

  const applyStatus = useCallback(
    (status: {
      canAskAgain: boolean;
      isGranted: boolean;
      isOptedOut: boolean;
      tokenSynced: boolean;
    }) => {
      setState((prev) => ({
        ...prev,
        canAskAgain: status.canAskAgain,
        isGranted: status.isGranted,
        tokenSynced: status.tokenSynced,
        isOptedOut: status.isOptedOut,
      }));
    },
    [],
  );

  const refresh = useCallback(
    async (allowSilentReconcile = true) => {
      if (!userId) {
        setState({ ...INITIAL_STATE, isLoading: false });
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const status = allowSilentReconcile
          ? await reconcileNotificationState(userId)
          : await getNotificationPermissionStatus(userId);

        applyStatus(status);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [applyStatus, userId],
  );

  const toggle = useCallback(async () => {
    if (!userId) return;

    if (isEnabled) {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const success = await clearNotificationToken(userId);
        if (success) {
          const status = await getNotificationPermissionStatus(userId);
          applyStatus(status);
        } else {
          Alert.alert(
            "Error",
            "Gagal menonaktifkan notifikasi. Silakan coba lagi.",
          );
        }
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
      return;
    }

    if (!state.canAskAgain) {
      openNotificationSettings();
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const r = await registerAndSaveNotificationToken(userId, {
        showAlertOnDenied: false,
        allowPermissionPrompt: true,
      });

      const status = await getNotificationPermissionStatus(userId);
      applyStatus(status);

      if (r.permissionDenied && !r.canAskAgain) {
        Alert.alert(
          "Izin Notifikasi",
          "Izin ditolak permanen. Buka pengaturan perangkat.",
          [
            { text: "Batal", style: "cancel" },
            { text: "Buka Pengaturan", onPress: openNotificationSettings },
          ],
        );
      }
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [userId, isEnabled, state.canAskAgain, applyStatus]);

  const subtitle = useMemo(() => {
    if (state.isLoading) return "Memuat...";
    if (isEnabled) return "Notifikasi aktif";
    if (state.isGranted && state.isOptedOut) {
      return "Izin aktif, notifikasi dimatikan di aplikasi";
    }
    if (state.isGranted && !state.tokenSynced) {
      return "Izin aktif, sinkronisasi token diperlukan";
    }
    if (!state.canAskAgain) return "Tap untuk buka Pengaturan HP";
    return "Notifikasi nonaktif";
  }, [state, isEnabled]);

  return {
    isEnabled,
    isLoading: state.isLoading,
    subtitle,
    toggle,
    refresh,
  };
}
