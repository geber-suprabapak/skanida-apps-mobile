import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "~/utils/supabase";


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
    }
}

export async function registerAndSaveNotificationToken(
    userId: string,
): Promise<void> {
    if (!Device.isDevice) return;

    try {
        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync({
                ios: { allowAlert: true, allowBadge: true, allowSound: true },
            });
            finalStatus = status;
        }

        if (finalStatus !== "granted") return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) return;

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
            projectId,
        });
        const token = tokenResponse.data;

        await supabase
            .from("user_profiles")
            .update({ notification_token: token })
            .eq("user_id", userId);
    } catch (error) {
        return;
    }
}
