import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Alert, Linking } from "react-native";
import Constants from "expo-constants";
import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import * as Sentry from "@sentry/react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationPermissionStatus = {
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
  isGranted: boolean;
  tokenSynced: boolean;
  isOptedOut: boolean;
};

type PermissionResult = {
  success: boolean;
  permissionDenied: boolean;
  canAskAgain: boolean;
  isGranted: boolean;
  tokenSynced: boolean;
};

type RegisterNotificationOptions = {
  showAlertOnDenied?: boolean;
  allowPermissionPrompt?: boolean;
  clearTokenWhenDenied?: boolean;
};

type ClearNotificationOptions = {
  setOptOut?: boolean;
};

// ---------------------------------------------------------------------------
// Constants & module-level state
// ---------------------------------------------------------------------------

const NOTIFICATION_OPT_OUT_PREFIX = "notification-opt-out";
const EXPO_PUSH_TOKEN_MAX_RETRIES = 3;

let activeNotificationSync: {
  userId: string;
  promise: Promise<PermissionResult>;
} | null = null;

const FAIL_RESULT: PermissionResult = {
  success: false,
  permissionDenied: false,
  canAskAgain: true,
  isGranted: false,
  tokenSynced: false,
};

const DEFAULT_PERMISSION_STATUS: NotificationPermissionStatus = {
  status: Notifications.PermissionStatus.UNDETERMINED,
  canAskAgain: true,
  isGranted: false,
  tokenSynced: false,
  isOptedOut: false,
};

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function retryAsync<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs = 500,
): Promise<{ result: T | null; lastError: Error | null }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, lastError: null };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** attempt),
      );
    }
  }

  return { result: null, lastError };
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as Record<string, Record<string, unknown>>).easConfig?.projectId
  );
}

// ---------------------------------------------------------------------------
// Opt-out persistence (AsyncStorage)
// ---------------------------------------------------------------------------

function getNotificationOptOutKey(userId: string) {
  return `${NOTIFICATION_OPT_OUT_PREFIX}:${userId}`;
}

async function getNotificationOptOut(userId: string) {
  try {
    const value = await AsyncStorage.getItem(getNotificationOptOutKey(userId));
    return value === "true";
  } catch (error) {
    Sentry.captureException(error, {
      extra: { userId, scope: "notification-opt-out-read" },
    });
    return false;
  }
}

async function setNotificationOptOut(userId: string, isOptedOut: boolean) {
  try {
    const storageKey = getNotificationOptOutKey(userId);
    if (isOptedOut) {
      await AsyncStorage.setItem(storageKey, "true");
      return;
    }
    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    Sentry.captureException(error, {
      extra: { userId, isOptedOut, scope: "notification-opt-out-write" },
    });
  }
}

// ---------------------------------------------------------------------------
// Token persistence (Supabase)
// ---------------------------------------------------------------------------

async function hasStoredNotificationToken(userId: string) {
  try {
    await ensureSupabaseInitialized();

    const { data, error } = await supabase
      .from("user_profiles")
      .select("notification_token")
      .eq("user_id", userId)
      .single();

    if (error) {
      Sentry.captureException(new Error(`Read token error: ${error.message}`), {
        extra: { userId, scope: "notification-token-read" },
      });
      return false;
    }

    return Boolean(data?.notification_token);
  } catch (error) {
    Sentry.captureException(error, {
      extra: { userId, scope: "notification-token-read" },
    });
    return false;
  }
}

async function updateStoredNotificationToken(
  userId: string,
  notificationToken: string | null,
) {
  await ensureSupabaseInitialized();

  return supabase
    .from("user_profiles")
    .update({ notification_token: notificationToken })
    .eq("user_id", userId);
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

async function getCurrentPermissionSnapshot() {
  const permission = await Notifications.getPermissionsAsync();

  return {
    status: permission.status,
    canAskAgain: permission.canAskAgain,
    isGranted: permission.granted || permission.status === "granted",
  };
}

function runNotificationSyncLocked(
  userId: string,
  callback: () => Promise<PermissionResult>,
) {
  if (activeNotificationSync?.userId === userId) {
    return activeNotificationSync.promise;
  }

  const promise = callback().finally(() => {
    if (activeNotificationSync?.userId === userId) {
      activeNotificationSync = null;
    }
  });

  activeNotificationSync = { userId, promise };
  return promise;
}

// ---------------------------------------------------------------------------
// Token fetch & save
// ---------------------------------------------------------------------------

async function saveTokenToDatabase(userId: string): Promise<PermissionResult> {
  try {
    const projectId = getProjectId();
    if (!projectId) {
      const error = new Error(
        "Missing EAS projectId. Ensure project is configured in app.config.ts",
      );
      Sentry.captureException(error);
      if (__DEV__) console.error(error.message);
      return FAIL_RESULT;
    }

    const { result: token, lastError } = await retryAsync(async () => {
      const response = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      if (!response.data) throw new Error("Token undefined");
      return response.data;
    }, EXPO_PUSH_TOKEN_MAX_RETRIES);

    if (!token) {
      Sentry.captureException(lastError ?? new Error("Token undefined"), {
        extra: { userId, projectId, scope: "notification-token-fetch" },
      });
      return { ...FAIL_RESULT, canAskAgain: true, isGranted: true };
    }

    const { error } = await updateStoredNotificationToken(userId, token);

    if (error) {
      Sentry.captureException(new Error(`Save error: ${error.message}`));
      return FAIL_RESULT;
    }

    await setNotificationOptOut(userId, false);

    return {
      success: true,
      permissionDenied: false,
      canAskAgain: true,
      isGranted: true,
      tokenSynced: true,
    };
  } catch (err) {
    Sentry.captureException(err, {
      extra: { userId, scope: "notification-token-save" },
    });
    return FAIL_RESULT;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return null;
  return Notifications.setNotificationChannelAsync("skanida-default", {
    name: "Notifikasi Skanida",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getNotificationPermissionStatus(
  userId?: string,
): Promise<NotificationPermissionStatus> {
  try {
    const permission = await getCurrentPermissionSnapshot();
    const [tokenSynced, isOptedOut] = userId
      ? await Promise.all([
          hasStoredNotificationToken(userId),
          getNotificationOptOut(userId),
        ])
      : [false, false];

    return {
      status: permission.status,
      canAskAgain: permission.canAskAgain,
      isGranted: permission.isGranted,
      tokenSynced,
      isOptedOut,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { userId, scope: "notification-permission-status" },
    });
    return DEFAULT_PERMISSION_STATUS;
  }
}

export async function reconcileNotificationState(
  userId: string,
): Promise<NotificationPermissionStatus> {
  let status = await getNotificationPermissionStatus(userId);

  if (status.isGranted && !status.tokenSynced && !status.isOptedOut) {
    await registerAndSaveNotificationToken(userId, {
      showAlertOnDenied: false,
      allowPermissionPrompt: false,
    });
    status = await getNotificationPermissionStatus(userId);
  } else if (!status.isGranted && status.tokenSynced) {
    await clearNotificationToken(userId, { setOptOut: false });
    status = await getNotificationPermissionStatus(userId);
  }

  return status;
}

export async function openNotificationSettings() {
  if (Platform.OS === "android") {
    await Linking.openSettings();
    return;
  }

  await Linking.openURL("app-settings:");
}

export async function clearNotificationToken(
  userId: string,
  options: ClearNotificationOptions = {},
) {
  try {
    try {
      await Notifications.unregisterForNotificationsAsync();
    } catch (error) {
      Sentry.captureException(error, {
        extra: { userId, scope: "notification-unregister" },
      });
    }

    const { error } = await updateStoredNotificationToken(userId, null);
    if (error) {
      Sentry.captureException(new Error(`Clear token error: ${error.message}`));
      return false;
    }

    await setNotificationOptOut(userId, options.setOptOut ?? true);
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

export async function registerAndSaveNotificationToken(
  userId: string,
  options: RegisterNotificationOptions = {},
): Promise<PermissionResult> {
  const {
    showAlertOnDenied = true,
    allowPermissionPrompt = true,
    clearTokenWhenDenied = false,
  } = options;

  return runNotificationSyncLocked(userId, async () => {
    try {
      if (!Device.isDevice) return FAIL_RESULT;

      if (Platform.OS === "android" && Number(Platform.Version) < 33) {
        return await saveTokenToDatabase(userId);
      }

      const permission = await getCurrentPermissionSnapshot();

      if (permission.isGranted) {
        return await saveTokenToDatabase(userId);
      }

      if (!allowPermissionPrompt) {
        if (clearTokenWhenDenied) {
          await clearNotificationToken(userId, { setOptOut: false });
        }
        return {
          ...FAIL_RESULT,
          permissionDenied: true,
          canAskAgain: permission.canAskAgain,
        };
      }

      if (!permission.canAskAgain) {
        if (showAlertOnDenied) {
          Alert.alert(
            "Izin Notifikasi Diperlukan",
            "Aktifkan izin notifikasi di pengaturan perangkat.",
            [
              { text: "Batal", style: "cancel" },
              { text: "Buka Pengaturan", onPress: openNotificationSettings },
            ],
          );
        }
        return { ...FAIL_RESULT, permissionDenied: true, canAskAgain: false };
      }

      const requestResult = await Notifications.requestPermissionsAsync();
      if (requestResult.status !== "granted" && !requestResult.granted) {
        if (showAlertOnDenied) {
          Alert.alert(
            "Izin Notifikasi",
            "Aktifkan notifikasi untuk menerima pembaruan penting.",
          );
        }
        return {
          ...FAIL_RESULT,
          permissionDenied: true,
          canAskAgain: requestResult.canAskAgain,
        };
      }

      return await saveTokenToDatabase(userId);
    } catch (err) {
      Sentry.captureException(err, {
        extra: {
          userId,
          showAlertOnDenied,
          allowPermissionPrompt,
          clearTokenWhenDenied,
          scope: "notification-register",
        },
      });
      return FAIL_RESULT;
    }
  });
}
