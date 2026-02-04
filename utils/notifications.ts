import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "~/utils/supabase";

export const NOTIFICATION_CHANNEL_ID = "skanida-default";

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

    return Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: "Notifikasi Skanida",
        importance: Notifications.AndroidImportance.DEFAULT,
    });
}

export async function registerAndSaveNotificationToken(userId: string) {
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } =
        existing === "granted"
            ? { status: existing }
            : await Notifications.requestPermissionsAsync();

    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId,
    });

    await supabase
        .from("user_profiles")
        .update({ notification_token: token })
        .eq("user_id", userId);
}
