// store/authStore.ts
import * as Sentry from "@sentry/react-native";
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "~/utils/supabase";
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

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  setUser: (user: User | null) => void;
  fetchUserProfile: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,

  // Action to set the user and fetch the profile
  setUser: (user) => {
    set({ user });
    if (user?.id) {
      (async () => {
        await Promise.all([
          get().fetchUserProfile(user.id),
          registerAndSaveNotificationToken(user.id),
        ]);
      })().catch((error) => {
        Sentry.captureException(error);
      });
    } else {
      set({ userProfile: null });
    }
  },

  // Action to fetch user profile from the database with retry logic
  fetchUserProfile: async (userId: string) => {
    const maxRetries = 5;
    const delay = 500; // 500ms delay between retries

    for (let i = 0; i < maxRetries; i++) {
      try {
        const { data, error, status } = await supabase
          .from("user_profiles")
          .select(`*`)
          .eq("user_id", userId)
          .single();

        // If data is found, profile exists. Set it and exit the loop.
        if (data) {
          set({ userProfile: data as UserProfile });
          return; // Success, exit the function
        }

        // If we get an error that is NOT a "resource not found" error, something is wrong.
        if (error && status !== 406) {
          if (__DEV__) console.error("Error fetching user profile:", error.message);
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
        if (__DEV__) console.error("An unexpected error occurred fetching profile:", error);
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
    await supabase.auth.signOut();
    set({ user: null, userProfile: null });
  },
}));

export default useAuthStore;
