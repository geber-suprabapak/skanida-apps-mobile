/**
 * Login Component Migration Example
 * Shows how to migrate the existing Login.tsx from Supabase to Appwrite
 */

import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import useAuthStore from "~/store/authStore";

// === BEFORE: Using Supabase ===
import { supabase } from "~/utils/supabase";

// === AFTER: Using Appwrite ===
import { appwriteAuth } from "~/utils/migration";
import { account } from "~/utils/appwrite";

export function LoginWithSupabase() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const handleLoginSupabase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase login error:", error.message);
        if (error.message === "Email not confirmed") {
          Alert.alert(
            "Error",
            "Email belum dikonfirmasi. Silakan periksa email Anda untuk verifikasi.",
          );
        } else {
          Alert.alert(
            "Error",
            "Login gagal. Periksa kembali email dan password Anda.",
          );
        }
        return;
      }

      if (data?.user) {
        setUser(data.user);
        router.replace("/Dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Terjadi kesalahan saat login");
    } finally {
      setLoading(false);
    }
  };

  return null; // UI components would go here
}

export function LoginWithAppwrite() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const handleLoginAppwrite = async () => {
    try {
      setLoading(true);
      const result = await appwriteAuth.signIn(email, password);

      if (!result.success) {
        console.error("Appwrite login error:", result.message);
        if (result.message.includes("email")) {
          Alert.alert(
            "Error",
            "Email belum dikonfirmasi. Silakan periksa email Anda untuk verifikasi.",
          );
        } else {
          Alert.alert(
            "Error",
            "Login gagal. Periksa kembali email dan password Anda.",
          );
        }
        return;
      }

      // Get user details from Appwrite
      const user = await account.get();
      setUser(user);
      router.replace("/Dashboard");
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Terjadi kesalahan saat login");
    } finally {
      setLoading(false);
    }
  };

  return null; // UI components would go here
}

// === MIGRATION COMPARISON ===
export const loginMigrationComparison = {
  authCall: {
    supabase: `
// Supabase Authentication
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) {
  // Handle error
} else {
  setUser(data.user);
}`,
    appwrite: `
// Appwrite Authentication
const result = await appwriteAuth.signIn(email, password);

if (!result.success) {
  // Handle error
} else {
  const user = await account.get();
  setUser(user);
}`,
  },

  errorHandling: {
    supabase: `
// Supabase Error Handling
if (error) {
  if (error.message === 'Email not confirmed') {
    // Handle email confirmation
  } else {
    // Handle other errors
  }
}`,
    appwrite: `
// Appwrite Error Handling
if (!result.success) {
  if (result.message.includes('email')) {
    // Handle email confirmation
  } else {
    // Handle other errors
  }
}`,
  },

  sessionCheck: {
    supabase: `
// Supabase Session Check
const { data: { session }, error } = await supabase.auth.getSession();
if (session?.user) {
  setUser(session.user);
  router.replace('/Dashboard');
}`,
    appwrite: `
// Appwrite Session Check
const result = await appwriteAuth.getSession();
if (result.success) {
  const user = await account.get();
  setUser(user);
  router.replace('/Dashboard');
}`,
  },
};

/**
 * Migration Steps for Login Component:
 *
 * 1. Replace Supabase import with Appwrite migration utilities
 * 2. Update authentication method calls
 * 3. Adjust error handling for Appwrite response format
 * 4. Update user data structure handling
 * 5. Test login flow thoroughly
 *
 * Key Differences:
 * - Supabase returns { data, error }, Appwrite returns { success, message, data }
 * - Appwrite requires separate call to get user details after authentication
 * - Error message format and handling differs between platforms
 * - Session management approach is similar but API calls are different
 */
