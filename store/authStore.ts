// store/authStore.ts
import * as Sentry from "@sentry/react-native";
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import { registerAndSaveNotificationToken } from "~/utils/notifications";
import { getProfile } from "~/utils/bffMobileApi";

// Define a more specific type for your user profile based on your table
export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  nis: string | null;
  class_name: string | null;
  absence_number: string | null;
  avatar_url: string | null;
  role: string | null;
  gender: string | null;
  notification_token: string | null;
}

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  setUser: (user: User | null) => void;
  fetchUserProfile: (userId: string, signal: AbortSignal) => Promise<void>;
  logout: () => Promise<void>;
}

// PERF-H04: Track active fetch so it can be cancelled on logout/user change
let activeFetchController: AbortController | null = null;

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,

  // Action to set the user and fetch the profile
  setUser: (user) => {
    // PERF-H04: Cancel any in-flight profile fetch before starting a new one
    if (activeFetchController) {
      activeFetchController.abort();
      activeFetchController = null;
    }

    set({ user });
    if (user?.id) {
      const controller = new AbortController();
      activeFetchController = controller;

      (async () => {
        // Ensure Supabase is initialized before making any calls
        await ensureSupabaseInitialized();

        await Promise.all([
          get().fetchUserProfile(user.id, controller.signal),
          registerAndSaveNotificationToken(user.id, {
            showAlertOnDenied: false,
            allowPermissionPrompt: true,
          }),
        ]);
      })().catch((error) => {
        Sentry.captureException(error);
      });
    } else {
      set({ userProfile: null });
    }
  },

  // Action to fetch user profile from Astra with retry logic
  fetchUserProfile: async (userId: string, signal: AbortSignal) => {
    const maxRetries = 5;
    const delay = 500; // 500ms delay between retries

    for (let i = 0; i < maxRetries; i++) {
      // PERF-H04: Check if fetch was cancelled between retries
      if (signal.aborted) {
        return;
      }

      try {
        const data = await getProfile();

        // PERF-H04: Check if cancelled after network response
        if (signal.aborted) {
          return;
        }

        if (data) {
          set({
            userProfile: {
              id: data.user_id,
              user_id: data.user_id,
              full_name: data.full_name,
              email: data.email,
              nis: data.nis ?? null,
              class_name: data.class_name ?? null,
              absence_number:
                data.absence_number !== undefined &&
                data.absence_number !== null
                  ? String(data.absence_number)
                  : null,
              avatar_url: data.avatar_url,
              role: data.role ?? null,
              gender: data.gender ?? null,
              notification_token: null,
            },
          });
          return; // Success, exit the function
        }

        if (i < maxRetries - 1) {
          if (__DEV__)
            console.log(
              `Profile not found, attempt ${i + 1}. Retrying in ${delay}ms...`,
            );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        if (signal.aborted) return;
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        if (__DEV__)
          console.error(
            "An unexpected error occurred fetching profile from Astra:",
            error,
          );
        Sentry.captureException(error);
        set({ userProfile: null });
        return;
      }
    }

    // If the loop completes without finding a profile
    const fetchFailureError = new Error(
      `Failed to fetch user profile for ${userId} from Astra after ${maxRetries} attempts.`,
    );
    if (__DEV__) console.error(fetchFailureError.message);
    Sentry.captureException(fetchFailureError);
    set({ userProfile: null });
  },

  // Action to sign out and clear the state
  logout: async () => {
    // PERF-H04: Cancel any in-flight profile fetch on logout
    if (activeFetchController) {
      activeFetchController.abort();
      activeFetchController = null;
    }
    await supabase.auth.signOut();
    set({ user: null, userProfile: null });
  },
}));

export default useAuthStore;
