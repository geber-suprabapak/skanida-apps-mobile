import { useEffect } from "react";
import { AppState } from "react-native";
import { reconcileNotificationState } from "~/utils/notifications";
import * as Sentry from "@sentry/react-native";

type UseNotificationSyncOptions = {
  userId: string | undefined;
  enabled: boolean;
};

export function useNotificationSync({
  userId,
  enabled,
}: UseNotificationSyncOptions) {
  useEffect(() => {
    if (!enabled || !userId) return;

    let isMounted = true;

    const syncNotificationState = async () => {
      try {
        await reconcileNotificationState(userId);
        if (!isMounted) return;
      } catch (error) {
        Sentry.captureException(error, {
          extra: { userId, scope: "root-notification-reconcile" },
        });
      }
    };

    void syncNotificationState();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncNotificationState();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [enabled, userId]);
}
