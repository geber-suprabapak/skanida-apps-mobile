import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "~/utils/supabase";

const log = {
    info: (msg: string) => console.log(`[Notifications] ℹ️ ${msg}`),
    error: (msg: string) => console.error(`[Notifications] ❌ ${msg}`),
    success: (msg: string) => console.log(`[Notifications] ✅ ${msg}`),
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
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "Notifikasi Umum",
            description: "Notifikasi umum dari Skanida Apps",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#3B82F6",
            sound: "default",
        });
        log.success("Android notification channel created");
    }
}

export async function registerForPushNotificationsAsync(): Promise<
    string | null
> {
    if (!Device.isDevice) {
        log.error("Push notifications hanya bisa digunakan di device fisik");
        return null;
    }

    try {
        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            log.info("Requesting notification permission...");
            const { status } = await Notifications.requestPermissionsAsync({
                ios: { allowAlert: true, allowBadge: true, allowSound: true },
            });
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            log.error("Notification permission ditolak oleh user");
            return null;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            log.error("Project ID tidak ditemukan di app.config.ts");
            return null;
        }

        log.info("Generating Expo Push Token...");
        const tokenResponse = await Notifications.getExpoPushTokenAsync({
            projectId,
        });
        const token = tokenResponse.data;

        log.success(`Token generated: ${token.substring(0, 30)}...`);
        return token;
    } catch (error) {
        log.error(
            `Failed to get push token: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
    }
}

export async function saveNotificationTokenToSupabase(
    userId: string,
    token: string,
): Promise<boolean> {
    try {
        log.info("Saving notification token to Supabase...");
        const { error } = await supabase
            .from("user_profiles")
            .update({ notification_token: token })
            .eq("user_id", userId);

        if (error) {
            log.error(`Failed to save token: ${error.message}`);
            return false;
        }

        log.success("Notification token saved to Supabase");
        return true;
    } catch (error) {
        log.error(
            `Unexpected error saving token: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
    }
}

export async function registerAndSaveNotificationToken(
    userId: string,
): Promise<void> {
    const token = await registerForPushNotificationsAsync();
    if (token) await saveNotificationTokenToSupabase(userId, token);
}
