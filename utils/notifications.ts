import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Alert, Linking } from "react-native";
import Constants from "expo-constants";
import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import * as Sentry from "@sentry/react-native";

type NotificationPermissionStatus = {
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
    const s = await Notifications.getPermissionsAsync();
    const [tokenSynced, isOptedOut] = userId
      ? await Promise.all([
          hasStoredNotificationToken(userId),
          getNotificationOptOut(userId),
        ])
      : [false, false];

    return {
      status: s.status,
      canAskAgain: s.canAskAgain,
      isGranted: s.granted,
      tokenSynced,
      isOptedOut,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { userId, scope: "notification-permission-status" },
    });
    return {
      status: Notifications.PermissionStatus.UNDETERMINED,
      canAskAgain: true,
      isGranted: false,
      tokenSynced: false,
      isOptedOut: false,
    };
  }
}

export async function openNotificationSettings() {
  Platform.OS === "android"
    ? await Linking.openSettings()
    : await Linking.openURL("app-settings:");
}

export async function clearNotificationToken(
  userId: string,
  options: ClearNotificationOptions = {},
) {
  try {
    // Ensure Supabase is initialized
    await ensureSupabaseInitialized();

    // Invalidate on Expo push server
    try {
      await Notifications.unregisterForNotificationsAsync();
    } catch (error) {
      Sentry.captureException(error, {
        extra: { userId, scope: "notification-unregister" },
      });
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ notification_token: null })
      .eq("user_id", userId);
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

      // Android < 13: permission auto-granted
      if (Platform.OS === "android" && Number(Platform.Version) < 33) {
        return await saveTokenToDatabase(userId);
      }

      const permission = await Notifications.getPermissionsAsync();

      if (permission.status === "granted" || permission.granted) {
        return await saveTokenToDatabase(userId);
      }

      if (!allowPermissionPrompt) {
        if (clearTokenWhenDenied) {
          await clearNotificationToken(userId, { setOptOut: false });
        }
        return {
          success: false,
          permissionDenied: true,
          canAskAgain: permission.canAskAgain,
          isGranted: false,
          tokenSynced: false,
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
        return {
          success: false,
          permissionDenied: true,
          canAskAgain: false,
          isGranted: false,
          tokenSynced: false,
        };
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
          success: false,
          permissionDenied: true,
          canAskAgain: requestResult.canAskAgain,
          isGranted: false,
          tokenSynced: false,
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

async function saveTokenToDatabase(userId: string): Promise<PermissionResult> {
  try {
    // Ensure Supabase is initialized
    await ensureSupabaseInitialized();

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      Sentry.captureException(new Error("Missing EAS projectId"));
      return FAIL_RESULT;
    }

    let token: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < EXPO_PUSH_TOKEN_MAX_RETRIES; attempt++) {
      try {
        const response = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        if (response.data) {
          token = response.data;
          break;
        }

        lastError = new Error("Token undefined");
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Token fetch failed");
      }

      if (attempt < EXPO_PUSH_TOKEN_MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }

    if (!token) {
      Sentry.captureException(lastError ?? new Error("Token undefined"), {
        extra: { userId, projectId, scope: "notification-token-fetch" },
      });
      return {
        success: false,
        permissionDenied: false,
        canAskAgain: true,
        isGranted: true,
        tokenSynced: false,
      };
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ notification_token: token })
      .eq("user_id", userId);

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
