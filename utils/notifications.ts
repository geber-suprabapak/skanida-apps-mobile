import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform, Alert, Linking } from "react-native";
import Constants from "expo-constants";
import { supabase } from "~/utils/supabase";
import * as Sentry from "@sentry/react-native";

type PermissionResult = {
  success: boolean;
  permissionDenied: boolean;
  canAskAgain: boolean;
};

const FAIL_RESULT: PermissionResult = {
  success: false,
  permissionDenied: false,
  canAskAgain: true,
};

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

export async function getNotificationPermissionStatus() {
  const s = await Notifications.getPermissionsAsync();
  return { status: s.status, canAskAgain: s.canAskAgain, isGranted: s.granted };
}

export async function openNotificationSettings() {
  Platform.OS === "android"
    ? await Linking.openSettings()
    : await Linking.openURL("app-settings:");
}

export async function clearNotificationToken(userId: string) {
  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({ notification_token: null })
      .eq("user_id", userId);
    if (error) {
      Sentry.captureException(new Error(`Clear token error: ${error.message}`));
      return false;
    }
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

export async function registerAndSaveNotificationToken(
  userId: string,
  showAlertOnDenied = true,
): Promise<PermissionResult> {
  try {
    if (!Device.isDevice) return FAIL_RESULT;

    // Android < 13: permission auto-granted
    if (Platform.OS === "android" && Number(Platform.Version) < 33) {
      return await saveTokenToDatabase(userId);
    }

    const { status: existing, canAskAgain } =
      await Notifications.getPermissionsAsync();

    if (existing === "granted") {
      return await saveTokenToDatabase(userId);
    }

    // Permanently denied
    if (!canAskAgain) {
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
      return { success: false, permissionDenied: true, canAskAgain: false };
    }

    // Request permission
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      if (showAlertOnDenied) {
        Alert.alert(
          "Izin Notifikasi",
          "Aktifkan notifikasi untuk menerima pembaruan penting.",
        );
      }
      return { success: false, permissionDenied: true, canAskAgain: true };
    }

    return await saveTokenToDatabase(userId);
  } catch (err) {
    Sentry.captureException(err);
    return FAIL_RESULT;
  }
}

async function saveTokenToDatabase(userId: string): Promise<PermissionResult> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      Sentry.captureException(new Error("Missing EAS projectId"));
      return FAIL_RESULT;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!token) {
      Sentry.captureException(new Error("Token undefined"));
      return FAIL_RESULT;
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ notification_token: token })
      .eq("user_id", userId);

    if (error) {
      Sentry.captureException(new Error(`Save error: ${error.message}`));
      return FAIL_RESULT;
    }

    return { success: true, permissionDenied: false, canAskAgain: true };
  } catch (err) {
    Sentry.captureException(err);
    return FAIL_RESULT;
  }
}
