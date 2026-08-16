// store/authStore.ts
import * as Sentry from "@sentry/react-native";
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import { registerAndSaveNotificationToken } from "~/utils/notifications";

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

// PERF-L06: Only select columns that are actually used
const USER_PROFILE_COLUMNS =
  "id, user_id, full_name, email, nis, class_name, absence_number, avatar_url, role, gender, notification_token";

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

  // Action to fetch user profile from the database with retry logic
  fetchUserProfile: async (userId: string, signal: AbortSignal) => {
    const maxRetries = 5;
    const delay = 500; // 500ms delay between retries

    for (let i = 0; i < maxRetries; i++) {
      // PERF-H04: Check if fetch was cancelled between retries
      if (signal.aborted) {
        return;
      }

      try {
        const { data, error, status } = await supabase
          .from("user_profiles")
          .select(USER_PROFILE_COLUMNS)
          .eq("user_id", userId)
          .abortSignal(signal)
          .single();

        // PERF-H04: Check if cancelled after network response
        if (signal.aborted) {
          return;
        }

        // If data is found, profile exists. Set it and exit the loop.
        if (data) {
          // SAFETY: Query selected all expected UserProfile columns.
          set({ userProfile: data as UserProfile });
          return; // Success, exit the function
        }

        // If we get an error that is NOT a "resource not found" error, something is wrong.
        if (error && status !== 406) {
          if (__DEV__)
            console.error("Error fetching user profile:", error.message);
          Sentry.captureException(error);
          set({ userProfile: null }); // Clear profile on definitive error
          return;
        }

        // If we are here, it means data is null (profile not found yet).
        // We will wait and retry, unless it's the last attempt.
        if (i < maxRetries - 1) {
          if (__DEV__)
            console.log(
              `Profile not found, attempt ${i + 1}. Retrying in ${delay}ms...`,
            );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        if (__DEV__)
          console.error(
            "An unexpected error occurred fetching profile:",
            error,
          );
        Sentry.captureException(error);
        set({ userProfile: null }); // Clear profile on unexpected error
        return;
      }
    }

    // If the loop completes without finding a profile
    const fetchFailureError = new Error(
      `Failed to fetch user profile for ${userId} after ${maxRetries} attempts.`,
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
